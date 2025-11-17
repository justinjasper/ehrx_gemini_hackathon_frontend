import { useState } from "react";
import { MatchedElement, PrecomputedAnswer, QueryResponse } from "../types";
import MatchedElementsList from "./MatchedElementsList";
import PDFViewer from "./PDFViewer";

interface QueryTabProps {
  loading: boolean;
  onSubmit: (question: string) => Promise<void> | void;
  queryResult: QueryResponse | null;
  documentId: string;
  pdfFile: File | null;
  pageInfoMap: Map<number, { width_px?: number; height_px?: number }>;
  ontologyAvailable: boolean;
  documents: { document_id: string; total_pages: number }[];
  onSelectDocument: (id: string) => void;
  precomputedAnswers: PrecomputedAnswer | null;
  isPrecomputedAnswer: boolean;
}

const QueryTab = ({
  loading,
  onSubmit,
  queryResult,
  documentId,
  pdfFile,
  pageInfoMap,
  ontologyAvailable,
  documents,
  onSelectDocument,
  precomputedAnswers,
  isPrecomputedAnswer
}: QueryTabProps) => {
  const [question, setQuestion] = useState("");
  const [highlightedElementId, setHighlightedElementId] = useState<
    string | null
  >(null);

  const handleSuggestedQuestionClick = (suggestedQuestion: string) => {
    setQuestion(suggestedQuestion);
    onSubmit(suggestedQuestion);
  };

  const sortedMatches: MatchedElement[] = (queryResult?.matched_elements ?? [])
    .slice()
    .sort((a, b) =>
      a.page_number === b.page_number
        ? (a.element_id || "").localeCompare(b.element_id || "")
        : a.page_number - b.page_number
    );

  const goToMatchAt = (index: number) => {
    if (!sortedMatches.length) return;
    const safeIndex = ((index % sortedMatches.length) + sortedMatches.length) % sortedMatches.length;
    const target = sortedMatches[safeIndex];
    if (target?.element_id) {
      setHighlightedElementId(target.element_id);
    }
  };

  const currentIndex =
    highlightedElementId == null
      ? -1
      : sortedMatches.findIndex((m) => m.element_id === highlightedElementId);

  const gotoPrev = () => {
    if (!sortedMatches.length) return;
    if (currentIndex === -1) {
      goToMatchAt(0);
    } else {
      goToMatchAt(currentIndex - 1);
    }
  };

  const gotoNext = () => {
    if (!sortedMatches.length) return;
    if (currentIndex === -1) {
      goToMatchAt(0);
    } else {
      goToMatchAt(currentIndex + 1);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim() || !documentId) return;
    await onSubmit(question.trim());
    setHighlightedElementId(null);
  };

  const matchedElements: MatchedElement[] =
    queryResult?.matched_elements ?? [];

  return (
    <div className="grid">
      <div className="card">
        <div className="form-group">
          <label htmlFor="queryDocument">Select Processed Document</label>
          <select
            id="queryDocument"
            value={documentId}
            onChange={(e) => onSelectDocument(e.target.value)}
          >
            <option value="">Select a processed document</option>
            {documents.map((d) => (
              <option key={d.document_id} value={d.document_id}>
                {d.document_id} ({d.total_pages} pages)
              </option>
            ))}
          </select>
        </div>
        <form className="grid" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="question">Question</label>
            <textarea
              id="question"
              placeholder="Example: What medications is the patient taking?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={loading || !documentId}
            />
          </div>
          <button className="btn" type="submit" disabled={loading || !question}>
            {loading ? "Running Query…" : "Submit Query"}
          </button>
        </form>
      </div>

      {precomputedAnswers && precomputedAnswers.questions.length > 0 && (
        <div className="card">
          <h3>Suggested Questions</h3>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Click on a question below to use it instantly (precomputed answers):
          </p>
          <div className="suggested-questions">
            {precomputedAnswers.questions.map((q) => (
              <button
                key={q.question_id}
                type="button"
                className="btn btn--secondary suggested-question-btn"
                onClick={() => handleSuggestedQuestionClick(q.question)}
                disabled={loading || !documentId}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: "0.5rem",
                  padding: "0.75rem",
                  whiteSpace: "normal",
                  wordWrap: "break-word"
                }}
              >
                {q.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPrecomputedAnswer && queryResult && (
        <div className="card" style={{ background: "#f0f9ff", border: "1px solid #0ea5e9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.2rem" }}>✓</span>
            <strong>Using Precomputed Answer</strong>
          </div>
          <p className="muted" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            This answer was retrieved instantly from precomputed results.
          </p>
        </div>
      )}

      {!documentId && (
        <div className="card">
          Select or upload a document before running queries.
        </div>
      )}

      {queryResult && (
        <div className="grid">
          <div className="card">
            <h3>Answer Summary</h3>
            <p>{queryResult.answer_summary || "No summary provided."}</p>
          </div>
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <strong>Matches:</strong> {sortedMatches.length}
              {currentIndex >= 0 && sortedMatches.length > 0
                ? ` (showing ${currentIndex + 1} of ${sortedMatches.length})`
                : ""}
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn btn--secondary" onClick={gotoPrev} disabled={!sortedMatches.length}>
                ← Prev
              </button>
              <button type="button" className="btn" onClick={gotoNext} disabled={!sortedMatches.length}>
                Next →
              </button>
            </div>
          </div>

          {queryResult.reasoning && (
            <div className="card">
              <h4>Reasoning</h4>
              <p>{queryResult.reasoning}</p>
            </div>
          )}

          <MatchedElementsList
            elements={matchedElements}
            highlightedElementId={highlightedElementId}
            onHighlight={(elementId, pageNumber) => {
              setHighlightedElementId(elementId);
            }}
          />
        </div>
      )}

      {ontologyAvailable ? (
        <PDFViewer
          file={pdfFile}
          matchedElements={matchedElements}
          highlightedElementId={highlightedElementId}
          onHighlightChange={(elementId) => setHighlightedElementId(elementId)}
          pageInfoMap={pageInfoMap}
        />
      ) : (
        <div className="card">
          PDF preview requires ontology data. Upload a document or switch to the
          Ontology tab first.
        </div>
      )}

      {!pdfFile && (
        <div className="card">
          <strong>Note:</strong> Bounding boxes require the PDF uploaded during
          this session. PDFs from previous sessions are not cached client-side.
        </div>
      )}
    </div>
  );
};

export default QueryTab;

