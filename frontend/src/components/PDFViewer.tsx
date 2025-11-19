import { useEffect, useMemo, useRef, useState } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  PDFDocumentProxy,
  PDFPageProxy
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
  const [viewport, setViewport] = useState<any>(null);
  const [currentPageObj, setCurrentPageObj] = useState<PDFPageProxy | null>(null);
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
      setCurrentPageObj(page);
      
      // Render at scale 1.5 (must match the scale used for transformation)
      const viewportObj = page.getViewport({ scale: 1.5 });
      setViewport(viewportObj);
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      canvas.height = viewportObj.height;
      canvas.width = viewportObj.width;
      await page.render({ canvasContext: context!, viewport: viewportObj }).promise;
      setCanvasSize({ width: viewportObj.width, height: viewportObj.height });
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

      <div className="pdf-canvas-wrapper" style={{ position: "relative", display: "inline-block" }}>
        <canvas ref={canvasRef} style={{ display: "block" }} />
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
          if (!viewport || !currentPageObj) return null;
          
          // Prefer bbox_pdf if available (more accurate with PDF.js viewport)
          // Otherwise fall back to bbox_pixel
          let coords: { left: number; top: number; width: number; height: number } | null = null;
          
          // Prefer bbox_pixel since it's already in screen coordinates (top-left origin)
          // and just needs scaling to match the viewport
          if (element.bbox_pixel && element.bbox_pixel.length === 4) {
            const [x0, y0, x1, y1] = element.bbox_pixel;
            const pageInfo = pageInfoMap.get(currentPage);
            
            if (!pageInfo?.width_px || !pageInfo?.height_px || !currentPageObj) return null;
            
            // bbox_pixel is in pixels relative to the rasterized image at 200 DPI
            // The rasterized image dimensions are in pageInfo.width_px × pageInfo.height_px
            // We need to scale these coordinates to match the PDF.js viewport dimensions
            
            // Get base viewport to understand the actual PDF dimensions in CSS pixels
            const baseViewport = currentPageObj.getViewport({ scale: 1.0 });
            
            // Calculate scale factors
            // The rasterized image (pageInfo) was created at 200 DPI from the PDF
            // PDF.js viewport at scale 1.0 gives dimensions in CSS pixels (96 DPI)
            // The current viewport is at scale 1.5, so it's 1.5x the base viewport
            
            // Calculate the effective DPI ratio: rasterized (200 DPI) vs CSS pixels (96 DPI)
            // Then account for the viewport scale (1.5)
            // Scale = (viewport_scale * CSS_pixel_size) / rasterized_pixel_size
            // Or more simply: viewport dimensions / pageInfo dimensions
            const scaleX = viewport.width / pageInfo.width_px;
            const scaleY = viewport.height / pageInfo.height_px;
            
            // Apply scaling - bbox_pixel coordinates are already in top-left origin, no flip needed
            // The coordinates should align directly with the canvas (0,0 is top-left of canvas)
            const left = x0 * scaleX;
            const top = y0 * scaleY;
            const width = (x1 - x0) * scaleX;
            const height = (y1 - y0) * scaleY;
            
            coords = {
              left,
              top,
              width,
              height
            };
          } else if (element.bbox_pdf && element.bbox_pdf.length === 4 && currentPageObj) {
            // Fallback to bbox_pdf: transform from PDF coordinates to viewport coordinates
            const baseViewport = currentPageObj.getViewport({ scale: 1.0 });
            const [x0_pdf, y0_pdf, x1_pdf, y1_pdf] = element.bbox_pdf;
            const scale = viewport.scale || 1.5;
            
            // PDF.js viewport at scale 1.0 gives dimensions in CSS pixels
            // PDF points to CSS pixels conversion: 1 point = 1/72 inch, 1 CSS pixel = 1/96 inch
            // So: 1 point = (96/72) CSS pixels = 1.333... CSS pixels
            const pdfHeightPoints = baseViewport.height * (72 / 96);
            const pointsToPixels = (96 / 72) * scale;
            
            // Transform coordinates
            const left = x0_pdf * pointsToPixels;
            const right = x1_pdf * pointsToPixels;
            const top = (pdfHeightPoints - y1_pdf) * pointsToPixels;  // y1 is top in PDF
            const bottom = (pdfHeightPoints - y0_pdf) * pointsToPixels; // y0 is bottom in PDF
            
            coords = {
              left,
              top,
              width: right - left,
              height: bottom - top
            };
          } else {
            return null;
          }
          
          if (!coords) return null;
          
          const style = {
            position: "absolute" as const,
            left: `${coords.left}px`,
            top: `${coords.top}px`,
            width: `${coords.width}px`,
            height: `${coords.height}px`,
            pointerEvents: "auto" as const
          };
          
          const highlight = highlightedElementId === element.element_id;
          return (
            <div
              key={element.element_id}
              className={`bbox ${highlight ? "bbox--highlighted" : ""}`}
              style={style}
              onClick={() => {
                // Toggle: if already highlighted, clear it; otherwise set it
                if (highlight) {
                  onHighlightChange("", element.page_number); // Clear highlight
                } else {
                  onHighlightChange(element.element_id, element.page_number);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PDFViewer;

