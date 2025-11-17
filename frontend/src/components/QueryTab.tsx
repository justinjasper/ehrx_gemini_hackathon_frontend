import { useState, useEffect, useRef } from "react";
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
  const [isProcessingSuggested, setIsProcessingSuggested] = useState(false);
  const answerSectionRef = useRef<HTMLDivElement>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);

  const handleSuggestedQuestionClick = (suggestedQuestion: string) => {
    setQuestion(suggestedQuestion);
  };

  // Auto-scroll to answer section when query result appears
  useEffect(() => {
    if (queryResult && answerSectionRef.current) {
      answerSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [queryResult]);

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
    
    // Check if this is a precomputed question and add delay
    const isPrecomputedQuestion = precomputedAnswers?.questions.some(
      (q) => q.question.toLowerCase().trim() === question.toLowerCase().trim()
    );
    
    if (isPrecomputedQuestion) {
      setIsProcessingSuggested(true);
      // Wait 4 seconds before submitting
      await new Promise((resolve) => setTimeout(resolve, 4000));
      setIsProcessingSuggested(false);
    }
    
    await onSubmit(question.trim());
    setHighlightedElementId(null);
  };

  const matchedElements: MatchedElement[] =
    queryResult?.matched_elements ?? [];

  const isProcessing = loading || isProcessingSuggested;

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <form onSubmit={handleSubmit} style={{ margin: 0 }}>
              <div className="form-group">
                <label htmlFor="question">Question</label>
                <textarea
                  id="question"
                  placeholder="Example: What medications is the patient taking?"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  disabled={isProcessing || !documentId}
                  style={{ minHeight: "200px" }}
                />
              </div>
              <button 
                className="btn" 
                type="submit" 
                disabled={isProcessing || !question}
                style={{ 
                  padding: "0.5rem 1rem", 
                  height: "auto", 
                  minHeight: "2.5rem",
                  width: "100%"
                }}
              >
                {isProcessing ? "Running Query…" : "Submit Query"}
              </button>
            </form>
          </div>

          {precomputedAnswers && precomputedAnswers.questions.length > 0 && (
            <div>
              <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Suggested Questions</h3>
              <div className="suggested-questions" style={{ marginBottom: "1rem" }}>
                {precomputedAnswers.questions.map((q) => (
                  <button
                    key={q.question_id}
                    type="button"
                    className="btn btn--secondary suggested-question-btn"
                    onClick={() => handleSuggestedQuestionClick(q.question)}
                    disabled={isProcessing || !documentId}
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
        </div>
      </div>

      {!documentId && (
        <div className="card">
          Select or upload a document before running queries.
        </div>
      )}

      {queryResult && (
        <div className="grid" ref={answerSectionRef}>
          <div className="card">
            <h3>Answer Summary</h3>
            <p>{queryResult.answer_summary || "No summary provided."}</p>
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
              // Scroll to PDF viewer when View button is clicked
              if (pdfViewerRef.current) {
                setTimeout(() => {
                  pdfViewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }
            }}
          />

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
        </div>
      )}

      {ontologyAvailable ? (
        <div ref={pdfViewerRef}>
          <PDFViewer
            file={pdfFile}
            matchedElements={matchedElements}
            highlightedElementId={highlightedElementId}
            onHighlightChange={(elementId) => setHighlightedElementId(elementId)}
            pageInfoMap={pageInfoMap}
          />
        </div>
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

