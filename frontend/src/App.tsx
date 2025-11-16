import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  DocumentSummary,
  MatchedElement,
  OntologyDocument,
  QueryResponse,
  SampleDocument
} from "./types";
import {
  fetchDocuments,
  fetchOntology,
  fetchSampleDocuments,
  fetchSamplePdf,
  processSampleDocument,
  queryDocument,
  uploadDocument
} from "./api";
import UploadTab from "./components/UploadTab";
import OntologyTab from "./components/OntologyTab";
import QueryTab from "./components/QueryTab";

type TabKey = "upload" | "ontology" | "query";

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("upload");
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string>("");
  const [ontology, setOntology] = useState<OntologyDocument | null>(null);
  const [loadingOntology, setLoadingOntology] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cachedPdfFile, setCachedPdfFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [sampleDocuments, setSampleDocuments] = useState<SampleDocument[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [samplesError, setSamplesError] = useState<string | null>(null);
  const [processingSampleId, setProcessingSampleId] = useState<string | null>(
    null
  );
  const samplesFetchedRef = useRef(false);
  const [processedDocumentIds, setProcessedDocumentIds] = useState<string[]>([]);

  const loadDocuments = async () => {
    try {
      const response = await fetchDocuments();
      setDocuments(response.documents ?? []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch documents.");
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (samplesFetchedRef.current) return;
    samplesFetchedRef.current = true;

    const loadSamples = async () => {
      setSamplesLoading(true);
      setSamplesError(null);
      try {
        const response = await fetchSampleDocuments();
        setSampleDocuments(response.samples ?? []);
      } catch (err) {
        console.error(err);
        setSamplesError("Failed to load sample documents.");
      } finally {
        setSamplesLoading(false);
      }
    };

    loadSamples();
  }, []);

  useEffect(() => {
    if (!selectedDocument) {
      setOntology(null);
      return;
    }

    const loadOntologyInner = async () => {
      setLoadingOntology(true);
      setError(null);
      try {
        const data = await fetchOntology(selectedDocument);
        setOntology(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load ontology.");
        setOntology(null);
      } finally {
        setLoadingOntology(false);
      }
    };

    loadOntologyInner();
  }, [selectedDocument]);

  const handleUpload = async (
    file: File,
    pageRange: string,
    documentType: string
  ) => {
    setUploading(true);
    setUploadMessage(null);
    setError(null);
    try {
      const response = await uploadDocument(file, pageRange, documentType);
      await loadDocuments();
      setSelectedDocument(response.document_id);
      setCachedPdfFile(file);
      setActiveTab("ontology");
      setQueryResult(null);
    } catch (err: any) {
      console.error(err);
      const message = err?.message || "Upload failed.";
      setUploadMessage(message);
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleProcessSample = async (
    filename: string,
    pageRange: string,
    documentType: string
  ) => {
    // Simulate processing delay only, then hydrate from preprocessed backend data
    setProcessingSampleId(filename);
    setUploadMessage(null);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 4000));

    try {
      // Fetch preprocessed document id without running heavy processing
      const response = await processSampleDocument(
        filename,
        pageRange,
        documentType
      );

      // Refresh documents and mark this one as processed in UI
      await loadDocuments();
      setProcessedDocumentIds((prev) =>
        prev.includes(response.document_id) ? prev : [...prev, response.document_id]
      );
      setSelectedDocument(response.document_id);

      // Fetch and cache the sample PDF so overlays work in Query tab
      try {
        const pdf = await fetchSamplePdf(filename);
        setCachedPdfFile(pdf);
      } catch (pdfErr) {
        console.warn("Failed to fetch sample PDF for overlays:", pdfErr);
        setCachedPdfFile(null);
      }

      setActiveTab("ontology");
      setQueryResult(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Processing failed.");
    } finally {
      setProcessingSampleId(null);
    }
  };

  const handleQuery = async (question: string) => {
    if (!selectedDocument) return;
    setQueryLoading(true);
    setError(null);
    try {
      const response = await queryDocument(selectedDocument, question);
      setQueryResult(response);
      setActiveTab("query");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Query failed.");
      setQueryResult(null);
    } finally {
      setQueryLoading(false);
    }
  };

  const pageInfoMap = useMemo(() => {
    const map = new Map<number, { width_px?: number; height_px?: number }>();
    ontology?.pages?.forEach((page) => {
      const pageNumber =
        page.page_number ?? page.pageNumber ?? page.page_num ?? 0;
      if (pageNumber && page.page_info) {
        map.set(pageNumber, {
          width_px: page.page_info.width_px,
          height_px: page.page_info.height_px
        });
      }
    });
    return map;
  }, [ontology]);

  const processedDocuments = documents.filter((d) =>
    processedDocumentIds.includes(d.document_id)
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>EHRX Medical Records Import</h1>
        <p>Import faxed medical records, standardize them into EHR-compatible formats, extract insights via natural-language queries.</p>
      </header>

      <div className="tabs">
        {(["upload", "ontology", "query"] as TabKey[]).map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <section className="tab-content">
        {activeTab === "upload" && (
          <UploadTab
            onUpload={handleUpload}
            onProcessSample={handleProcessSample}
            uploading={uploading}
            processingSampleId={processingSampleId}
            samples={sampleDocuments}
            samplesLoading={samplesLoading}
            samplesError={samplesError}
            uploadMessage={uploadMessage}
          />
        )}

        {activeTab === "ontology" && (
          <OntologyTab
            documents={processedDocuments}
            selectedDocument={selectedDocument}
            onSelectDocument={(id) => setSelectedDocument(id)}
            ontology={ontology}
            loading={loadingOntology}
            onRefresh={loadDocuments}
          />
        )}

        {activeTab === "query" && (
          <QueryTab
            loading={queryLoading}
            onSubmit={handleQuery}
            queryResult={queryResult}
            documentId={selectedDocument}
            pdfFile={cachedPdfFile}
            pageInfoMap={pageInfoMap}
            ontologyAvailable={!!ontology}
            documents={processedDocuments}
            onSelectDocument={(id) => setSelectedDocument(id)}
          />
        )}
      </section>
    </div>
  );
}

export default App;

