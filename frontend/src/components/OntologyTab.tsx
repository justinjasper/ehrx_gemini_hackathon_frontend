import JSONTree from "./JSONTree";
import { DocumentSummary, OntologyDocument } from "../types";
import { useState, useMemo } from "react";
import ExportModal from "./ExportModal";

interface OntologyTabProps {
  documents: DocumentSummary[];
  selectedDocument: string;
  onSelectDocument: (id: string) => void;
  ontology: OntologyDocument | null;
  loading: boolean;
  onRefresh: () => void;
}

// Recursively process data to combine consecutive list_items
const combineConsecutiveListItems = (data: unknown): unknown => {
  if (Array.isArray(data)) {
    const result: unknown[] = [];
    let consecutiveListItems: Record<string, unknown>[] = [];
    
    for (const item of data) {
      if (
        typeof item === "object" &&
        item !== null &&
        "type" in item &&
        (item.type === "list_item" || item.type === "list_items")
      ) {
        consecutiveListItems.push(item as Record<string, unknown>);
      } else {
        // If we have accumulated list_items, combine them first
        if (consecutiveListItems.length > 0) {
          const combined = { ...consecutiveListItems[0] };
          const contents = consecutiveListItems
            .map((li) => li.content)
            .filter((c): c is string => typeof c === "string");
          combined.content = contents.join("\n");
          result.push(combineConsecutiveListItems(combined));
          consecutiveListItems = [];
        }
        result.push(combineConsecutiveListItems(item));
      }
    }
    
    // Handle any remaining consecutive list_items at the end
    if (consecutiveListItems.length > 0) {
      const combined = { ...consecutiveListItems[0] };
      const contents = consecutiveListItems
        .map((li) => li.content)
        .filter((c): c is string => typeof c === "string");
      combined.content = contents.join("\n");
      result.push(combineConsecutiveListItems(combined));
    }
    
    return result;
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const processed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      processed[key] = combineConsecutiveListItems(value);
    }
    return processed;
  }
  
  return data;
};

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

  // Process ontology to combine consecutive list_items
  const processedOntology = useMemo(() => {
    if (!ontology) return null;
    return combineConsecutiveListItems(ontology) as OntologyDocument;
  }, [ontology]);

  return (
    <div className="grid">
      <div className="section-title">
        <div>
          <h2>Ontology Viewer</h2>
          <p>Select a processed document to inspect its structured data.</p>
        </div>
        {ontology && (
          <button className="btn" onClick={() => setExportOpen(true)}>
            Export to EHR
          </button>
        )}
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
            <JSONTree data={processedOntology} />
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

