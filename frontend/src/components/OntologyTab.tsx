import JSONTree from "./JSONTree";
import { DocumentSummary, OntologyDocument } from "../types";
import { useState } from "react";
import ExportModal from "./ExportModal";

interface OntologyTabProps {
  documents: DocumentSummary[];
  selectedDocument: string;
  onSelectDocument: (id: string) => void;
  ontology: OntologyDocument | null;
  loading: boolean;
  onRefresh: () => void;
}

const OntologyTab = ({
  documents,
  selectedDocument,
  onSelectDocument,
  ontology,
  loading,
  onRefresh
}: OntologyTabProps) => {
  const [exportOpen, setExportOpen] = useState(false);
  const suggestedName =
    ontology?.document_id ? `${ontology.document_id}.json` : "ontology.json";

  return (
    <div className="grid">
      <div className="section-title">
        <div>
          <h2>Ontology Viewer</h2>
          <p>Select a processed document to inspect its structured data.</p>
        </div>
        <button className="btn btn--secondary" onClick={onRefresh}>
          Refresh List
        </button>
      </div>

      <div className="form-group">
        <label htmlFor="documentSelect">Document</label>
        <select
          id="documentSelect"
          value={selectedDocument}
          onChange={(event) => onSelectDocument(event.target.value)}
        >
          <option value="">Select a document</option>
          {documents.map((doc) => (
            <option key={doc.document_id} value={doc.document_id}>
              {doc.document_id} ({doc.total_pages} pages)
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="card">Loading ontology…</div>}

      {!loading && ontology && (
        <div className="grid grid--two-columns">
          <div className="card">
            <h3>Document Summary</h3>
            <p>
              <strong>ID:</strong> {ontology.document_id}
            </p>
            <p>
              <strong>Total Pages:</strong> {ontology.total_pages}
            </p>
            <p>
              <strong>Sub-Documents:</strong>{" "}
              {ontology.sub_documents?.length ?? 0}
            </p>
          </div>

          <div className="card">
            <h3>Patient Demographics</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(ontology.patient_demographics ?? {}, null, 2)}
            </pre>
          </div>

          <div className="json-tree" style={{ gridColumn: "1 / -1" }}>
            <JSONTree data={ontology} />
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setExportOpen(true)}>
              Export to EHR
            </button>
          </div>
        </div>
      )}

      {!loading && !ontology && (
        <div className="card">
          No ontology loaded. Upload a PDF or select a document above.
        </div>
      )}

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        suggestedName={suggestedName}
        onExport={() => {
          // Placeholder: Implement real export integration later.
          setExportOpen(false);
        }}
      />
    </div>
  );
};

export default OntologyTab;

