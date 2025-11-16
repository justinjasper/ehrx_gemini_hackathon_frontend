import { useState, useEffect } from "react";
import PDFViewer from "./PDFViewer";
import { MatchedElement } from "../types";

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
  const [pageInfoMap] = useState(new Map<number, { width_px?: number; height_px?: number }>());

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
        <div className="modal-body">
          {file ? (
            <PDFViewer
              file={file}
              matchedElements={[]}
              highlightedElementId={null}
              onHighlightChange={() => {}}
              pageInfoMap={pageInfoMap}
            />
          ) : (
            <div className="card">No PDF available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFPreviewModal;

