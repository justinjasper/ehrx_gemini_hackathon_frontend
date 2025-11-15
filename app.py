"""
FastAPI web server for Cloud Run deployment.

Provides HTTP endpoints for:
- Health checks
- PDF upload and processing
- Results retrieval
"""

import os
import json
import logging
import tempfile
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import pipeline components
from ehrx.vlm.pipeline import DocumentPipeline
from ehrx.vlm.grouping import SubDocumentGrouper, generate_hierarchical_index
from ehrx.vlm.config import VLMConfig
from ehrx.agent.query import HybridQueryAgent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="EHRX Pipeline API",
    description="EHR extraction pipeline using Google Gemini VLM",
    version="1.0.0"
)

# Configuration
OUTPUT_DIR = Path("/tmp/ehrx_output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Global pipeline instance (initialized lazily)
vlm_config = None
pipeline = None
query_agent = None


def get_pipeline():
    """Get or create pipeline instance."""
    global vlm_config, pipeline
    if pipeline is None:
        vlm_config = VLMConfig.from_env()
        pipeline = DocumentPipeline(
            vlm_config=vlm_config,
            checkpoint_interval=50,
            dpi=200
        )
        logger.info("Pipeline initialized")
    return pipeline


class ProcessRequest(BaseModel):
    """Request model for PDF processing."""
    page_range: Optional[str] = "all"
    document_type: Optional[str] = "Clinical EHR"


class QueryRequest(BaseModel):
    """Request model for querying results."""
    question: str
    document_id: str


@app.get("/")
async def root():
    """Root endpoint - API information."""
    return {
        "service": "EHRX Pipeline API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "process": "/process (POST with PDF file)",
            "query": "/query (POST with question)",
            "results": "/results/{document_id}",
            "docs": "/docs"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for Cloud Run."""
    try:
        # Check if VLM config is accessible
        config = VLMConfig.from_env()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "project_id": config.project_id,
            "model": config.model_name
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@app.post("/process")
async def process_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    page_range: str = "all",
    document_type: str = "Clinical EHR"
):
    """
    Process uploaded PDF through VLM extraction pipeline.
    
    Args:
        file: PDF file to process
        page_range: Page range to process (e.g., "1-10", "all")
        document_type: Type of document for context
    
    Returns:
        Processing job information with document_id
    """
    logger.info(f"Received PDF: {file.filename}, page_range: {page_range}")
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Save uploaded file to temp location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_pdf_path = tmp_file.name
        
        logger.info(f"Saved PDF to: {tmp_pdf_path}")
        
        # Generate document ID
        document_id = f"{Path(file.filename).stem}_{int(datetime.utcnow().timestamp())}"
        output_path = OUTPUT_DIR / document_id
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Process the PDF
        logger.info(f"Starting processing for document: {document_id}")
        
        pipeline_instance = get_pipeline()
        document = pipeline_instance.process_document(
            pdf_path=tmp_pdf_path,
            output_dir=str(output_path),
            page_range=page_range,
            document_context={"document_type": document_type}
        )
        
        # Group sub-documents
        logger.info("Grouping sub-documents")
        grouper = SubDocumentGrouper(confidence_threshold=0.80)
        enhanced_doc = grouper.group_document(document)
        
        # Save enhanced document
        enhanced_path = output_path / f"{document_id}_enhanced.json"
        with open(enhanced_path, 'w') as f:
            json.dump(enhanced_doc, f, indent=2)
        
        # Generate index
        index = generate_hierarchical_index(enhanced_doc)
        index_path = output_path / f"{document_id}_index.json"
        with open(index_path, 'w') as f:
            json.dump(index, f, indent=2)
        
        # Clean up temp file
        os.unlink(tmp_pdf_path)
        
        logger.info(f"Processing complete for document: {document_id}")
        
        return {
            "status": "success",
            "document_id": document_id,
            "processing_stats": document['processing_stats'],
            "sub_documents": len(enhanced_doc.get('sub_documents', [])),
            "results_url": f"/results/{document_id}",
            "query_url": f"/query",
            "message": "PDF processed successfully"
        }
        
    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@app.get("/results/{document_id}")
async def get_results(document_id: str, format: str = "enhanced"):
    """
    Retrieve processing results for a document.
    
    Args:
        document_id: Document identifier from processing
        format: Result format ("enhanced", "index", "full")
    
    Returns:
        Document processing results
    """
    output_path = OUTPUT_DIR / document_id
    
    if not output_path.exists():
        raise HTTPException(status_code=404, detail=f"Document {document_id} not found")
    
    # Determine which file to return
    if format == "enhanced":
        file_path = output_path / f"{document_id}_enhanced.json"
    elif format == "index":
        file_path = output_path / f"{document_id}_index.json"
    elif format == "full":
        file_path = output_path / f"{document_id}_full.json"
    else:
        raise HTTPException(status_code=400, detail=f"Invalid format: {format}")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {format}")
    
    return FileResponse(
        file_path,
        media_type="application/json",
        filename=file_path.name
    )


@app.post("/query")
async def query_document(request: QueryRequest):
    """
    Query a processed document using natural language.
    
    Args:
        request: Query request with question and document_id
    
    Returns:
        Query results with matched elements and answer
    """
    logger.info(f"Query for document {request.document_id}: {request.question}")
    
    # Find the enhanced document
    enhanced_path = OUTPUT_DIR / request.document_id / f"{request.document_id}_enhanced.json"
    
    if not enhanced_path.exists():
        raise HTTPException(
            status_code=404, 
            detail=f"Document {request.document_id} not found. Process a PDF first."
        )
    
    try:
        # Initialize query agent if needed
        global query_agent, vlm_config
        
        if vlm_config is None:
            vlm_config = VLMConfig.from_env()
        
        # Create agent for this query
        agent = HybridQueryAgent(
            schema_path=str(enhanced_path),
            vlm_config=vlm_config
        )
        
        # Execute query
        result = agent.query(request.question)
        
        logger.info(f"Query returned {len(result['matched_elements'])} matches")
        
        return {
            "status": "success",
            "document_id": request.document_id,
            "question": request.question,
            "answer": result.get('answer_summary', ''),
            "reasoning": result.get('reasoning', ''),
            "matched_elements": result['matched_elements'][:5],  # Return top 5
            "total_matches": len(result['matched_elements']),
            "filter_stats": result['filter_stats']
        }
        
    except Exception as e:
        logger.error(f"Query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@app.get("/documents")
async def list_documents():
    """List all processed documents."""
    documents = []
    
    if OUTPUT_DIR.exists():
        for doc_dir in OUTPUT_DIR.iterdir():
            if doc_dir.is_dir():
                enhanced_file = doc_dir / f"{doc_dir.name}_enhanced.json"
                if enhanced_file.exists():
                    try:
                        with open(enhanced_file, 'r') as f:
                            data = json.load(f)
                            documents.append({
                                "document_id": doc_dir.name,
                                "total_pages": data.get('total_pages', 0),
                                "sub_documents": len(data.get('sub_documents', [])),
                                "results_url": f"/results/{doc_dir.name}"
                            })
                    except Exception as e:
                        logger.warning(f"Error reading {doc_dir.name}: {e}")
    
    return {
        "status": "success",
        "total_documents": len(documents),
        "documents": documents
    }


# Cloud Run entry point
if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variable (Cloud Run sets this)
    port = int(os.environ.get("PORT", 8080))
    
    logger.info(f"Starting EHRX Pipeline API on port {port}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )

