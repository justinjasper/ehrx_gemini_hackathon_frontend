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
  const [processedDocumentIds, setProcessedDocumentIds] = useState<string[]>(
    []
  );
  const [simulatingProcessingId, setSimulatingProcessingId] = useState<
    string | null
  >(null);

  const loadDocuments = async () => {
    try {
      const response = await fetchDocuments();
      setDocuments(response.documents ?? []);
      if (!selectedDocument && response.documents?.length) {
        setSelectedDocument(response.documents[0].document_id);
      }
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

    const loadOntology = async () => {
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

    loadOntology();
  }, [selectedDocument]);

  // Simulate processing for an existing document without API/LLM call
  const simulateProcessExistingDocument = async (documentId: string) => {
    if (processedDocumentIds.includes(documentId)) return;
    setSimulatingProcessingId(documentId);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    setProcessedDocumentIds((prev) =>
      prev.includes(documentId) ? prev : [...prev, documentId]
    );
    setSimulatingProcessingId(null);
  };

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
    // Do NOT call API here; simulate processing delay then allow ontology selection
    setProcessingSampleId(filename);
    setUploadMessage(null);
    setError(null);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // After delay, mark a placeholder processed item so it can be selected later.
    // We don't know the backend document_id here; processing is just gated in UI.
    setProcessingSampleId(null);
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

  // Only allow selecting documents that have been "processed" in UI
  const processedDocuments = documents.filter((d) =>
    processedDocumentIds.includes(d.document_id)
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>EHRX Pipeline UI</h1>
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

      {/* Processing controls on Upload tab: allow selecting existing docs to process */}
      {activeTab === "upload" && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Process Existing Documents</h3>
          {documents.length === 0 ? (
            <p>No documents found.</p>
          ) : (
            <div className="table-wrapper">
              <table className="sample-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Pages</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const isProcessed = processedDocumentIds.includes(
                      doc.document_id
                    );
                    const isSimulating = simulatingProcessingId === doc.document_id;
                    return (
                      <tr key={doc.document_id}>
                        <td>{doc.document_id}</td>
                        <td>{doc.total_pages}</td>
                        <td>
                          {isProcessed ? (
                            <span className="status-chip status-chip--success">
                              Processed
                            </span>
                          ) : isSimulating ? (
                            <span className="status-chip status-chip--warning">
                              Processing…
                            </span>
                          ) : (
                            <span className="status-chip">Not processed</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn"
                            onClick={() =>
                              simulateProcessExistingDocument(doc.document_id)
                            }
                            disabled={isProcessed || isSimulating}
                          >
                            {isSimulating ? "Processing…" : "Process"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted small-note">
            Note: Processing is simulated and takes ~10 seconds.
          </p>
        </div>
      )}
    </div>
  );
}

export default App;

