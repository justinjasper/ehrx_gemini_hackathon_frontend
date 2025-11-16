import { useState, useEffect, useRef } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  PDFDocumentProxy
} from "pdfjs-dist";
import worker from "pdfjs-dist/build/pdf.worker?url";

GlobalWorkerOptions.workerSrc = worker;

interface PageCanvasProps {
  sourceCanvas: HTMLCanvasElement | undefined;
  pageNum: number;
}

const PageCanvas = ({ sourceCanvas, pageNum }: PageCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && sourceCanvas) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = sourceCanvas.width;
        canvasRef.current.height = sourceCanvas.height;
        ctx.drawImage(sourceCanvas, 0, 0);
      }
    }
  }, [sourceCanvas]);

  if (!sourceCanvas) {
    return (
      <div
        style={{
          width: "600px",
          height: "800px",
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "4px"
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "4px" }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

interface PDFPreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const PDFPreviewModal = ({
  file,
  isOpen,
  onClose,
  title = "PDF Preview"
}: PDFPreviewModalProps) => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [renderedPages, setRenderedPages] = useState<Map<number, HTMLCanvasElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) {
      setDoc(null);
      setTotalPages(0);
      setRenderedPages(new Map());
      return;
    }
    const url = URL.createObjectURL(file);
    getDocument(url)
      .promise.then((pdf: PDFDocumentProxy) => {
        setDoc(pdf);
        setTotalPages(pdf.numPages);
      })
      .catch((error) => console.error(error));

    return () => {
      URL.revokeObjectURL(url);
      setDoc(null);
    };
  }, [file]);

  useEffect(() => {
    if (!doc || !containerRef.current) return;

    const renderAllPages = async () => {
      const newRenderedPages = new Map<number, HTMLCanvasElement>();
      const scale = 1.5;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        try {
          const page = await doc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement("canvas");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          const context = canvas.getContext("2d");
          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            newRenderedPages.set(pageNum, canvas);
          }
        } catch (error) {
          console.error(`Error rendering page ${pageNum}:`, error);
        }
      }

      setRenderedPages(newRenderedPages);
    };

    renderAllPages();
  }, [doc, totalPages]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          {file ? (
            <div
              ref={containerRef}
              style={{
                overflowY: "auto",
                maxHeight: "calc(90vh - 80px)",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem"
              }}
            >
              {totalPages > 0 && renderedPages.size === 0 && (
                <div className="card">Loading PDF pages...</div>
              )}
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => {
                const sourceCanvas = renderedPages.get(pageNum);
                return (
                  <div
                    key={pageNum}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    <div style={{ fontSize: "0.9rem", color: "#64748b" }}>
                      Page {pageNum}
                    </div>
                    <PageCanvas sourceCanvas={sourceCanvas} pageNum={pageNum} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">No PDF available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;

