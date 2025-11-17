import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  PDFDocumentProxy
} from "pdfjs-dist";
import { MatchedElement } from "../types";
import worker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = worker;

interface PDFViewerProps {
  file: File | null;
  matchedElements: MatchedElement[];
  highlightedElementId: string | null;
  onHighlightChange: (elementId: string, pageNumber: number) => void;
  pageInfoMap: Map<number, { width_px?: number; height_px?: number }>;
  sortedMatches: MatchedElement[];
  currentIndex: number;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
}

const PDFViewer = ({
  file,
  matchedElements,
  highlightedElementId,
  onHighlightChange,
  pageInfoMap,
  sortedMatches,
  currentIndex,
  onNavigatePrev,
  onNavigateNext
}: PDFViewerProps) => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [originalPageSize, setOriginalPageSize] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) {
      setDoc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    getDocument(url)
      .promise.then((pdf: PDFDocumentProxy) => {
        setDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      })
      .catch((error) => console.error(error));

    return () => {
      URL.revokeObjectURL(url);
      setDoc(null);
    };
  }, [file]);

  useEffect(() => {
    if (!doc) return;

    const renderPage = async () => {
      const page = await doc.getPage(currentPage);
      // Get original page size (scale 1.0) for coordinate transformation
      const originalViewport = page.getViewport({ scale: 1.0 });
      setOriginalPageSize({ width: originalViewport.width, height: originalViewport.height });
      
      // Render at scale 1.5
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context!, viewport }).promise;
      setCanvasSize({ width: viewport.width, height: viewport.height });
    };

    renderPage();
  }, [doc, currentPage]);

  const matchesByPage = useMemo(() => {
    const map = new Map<number, MatchedElement[]>();
    matchedElements.forEach((element) => {
      if (!map.has(element.page_number)) {
        map.set(element.page_number, []);
      }
      map.get(element.page_number)!.push(element);
    });
    return map;
  }, [matchedElements]);

  useEffect(() => {
    if (!matchedElements.length) return;
    const match = matchedElements.find(
      (el) => el.element_id === highlightedElementId
    );
    if (match) {
      setCurrentPage(match.page_number);
    }
  }, [highlightedElementId, matchedElements]);

  if (!file) {
    return (
      <div className="card">
        Upload a PDF during this session to enable PDF preview & overlays.
      </div>
    );
  }

  const pageMatches = matchesByPage.get(currentPage) ?? [];
  const pageInfo = pageInfoMap.get(currentPage);
  const scaleX =
    pageInfo?.width_px && canvasSize.width
      ? canvasSize.width / pageInfo.width_px
      : 1;
  const scaleY =
    pageInfo?.height_px && canvasSize.height
      ? canvasSize.height / pageInfo.height_px
      : 1;

  return (
    <div className="pdf-viewer">
      <div className="section-title">
        <div>
          <h3>PDF Preview</h3>
          <p>Bounding boxes are drawn for the current page.</p>
        </div>
        <div>
          <select
            value={currentPage}
            onChange={(event) => setCurrentPage(Number(event.target.value))}
          >
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
              (page) => (
                <option key={page} value={page}>
                  Page {page}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      <div className="pdf-canvas-wrapper" style={{ position: "relative" }}>
        <canvas ref={canvasRef} />
        {sortedMatches.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              background: "rgba(255, 255, 255, 0.95)",
              padding: "0.5rem",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              zIndex: 10
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              {currentIndex >= 0
                ? `${currentIndex + 1} / ${sortedMatches.length}`
                : `0 / ${sortedMatches.length}`}
            </span>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onNavigatePrev}
              disabled={sortedMatches.length === 0}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              ← Prev
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onNavigateNext}
              disabled={sortedMatches.length === 0}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}
            >
              Next →
            </button>
          </div>
        )}
        {pageMatches.map((element) => {
          if (!element.bbox_pixel || !pageInfo?.width_px || !pageInfo?.height_px) return null;
          const [x0, y0, x1, y1] = element.bbox_pixel;
          
          // bbox_pixel coordinate system (from backend documentation):
          // - Origin: Top-left corner (0, 0)
          // - Y-axis: Increases downward (standard image coordinates)
          // - Format: [x0, y0, x1, y1]
          //   - x0 = Left edge (pixels from left)
          //   - y0 = Top edge (pixels from top)
          //   - x1 = Right edge (pixels from left)
          //   - y1 = Bottom edge (pixels from top)
          // - Units: Pixels relative to rasterized image at 200 DPI
          // - Reference dimensions: pageInfo.width_px × pageInfo.height_px
          //
          // Since bbox_pixel is already in top-left origin coordinates (Y increases downward),
          // we can use the coordinates directly without any Y-flip transformation.
          // We just need to scale from pageInfo dimensions to the rendered canvas dimensions.
          
          // Scale coordinates to match the rendered canvas
          // scaleX and scaleY convert from pageInfo dimensions to canvas dimensions
          const style = {
            position: "absolute" as const,
            left: `${x0 * scaleX}px`,
            top: `${y0 * scaleY}px`,
            width: `${(x1 - x0) * scaleX}px`,
            height: `${(y1 - y0) * scaleY}px`,
            pointerEvents: "auto" as const
          };
          const highlight = highlightedElementId === element.element_id;
          return (
            <div
              key={element.element_id}
              className={`bbox ${highlight ? "bbox--highlighted" : ""}`}
              style={style}
              onClick={() =>
                onHighlightChange(element.element_id, element.page_number)
              }
            />
          );
        })}
      </div>
    </div>
  );
};

export default PDFViewer;

