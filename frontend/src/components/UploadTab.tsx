import { useState } from "react";
import { SampleDocument } from "../types";
import { fetchSamplePdf } from "../api";
import PDFPreviewModal from "./PDFPreviewModal";

type UploadMode = "sample" | "upload";

interface UploadTabProps {
  onUpload: (file: File, pageRange: string, documentType: string) => void;
  onProcessSample: (
    filename: string,
    pageRange: string,
    documentType: string
  ) => Promise<void>;
  uploading: boolean;
  processingSampleId: string | null;
  samples: SampleDocument[];
  samplesLoading: boolean;
  samplesError: string | null;
  uploadMessage: string | null;
}

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const UploadTab = ({
  onUpload,
  onProcessSample,
  uploading,
  processingSampleId,
  samples,
  samplesLoading,
  samplesError,
  uploadMessage
}: UploadTabProps) => {
  const [mode, setMode] = useState<UploadMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPageRange, setUploadPageRange] = useState("all");
  const [uploadDocumentType, setUploadDocumentType] =
    useState("Clinical EHR");
  const [samplePageRange, setSamplePageRange] = useState("all");
  const [sampleDocumentType, setSampleDocumentType] =
    useState("Clinical EHR");
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const handleUploadSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    onUpload(file, uploadPageRange, uploadDocumentType);
  };

  const handleProcessSample = async (filename: string) => {
    try {
      await onProcessSample(filename, samplePageRange, sampleDocumentType);
    } catch (error) {
      // Error is surfaced by parent; avoid unhandled rejection logs.
      console.error(error);
    }
  };

  const handlePreview = async (filename: string) => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const file = await fetchSamplePdf(filename);
      setPreviewFile(file);
    } catch (error: any) {
      console.error(error);
      setPreviewError(error?.message || "Failed to load PDF preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="mode-toggle">
        <label>
          <input
            type="radio"
            name="upload-mode"
            value="upload"
            checked={mode === "upload"}
            onChange={() => setMode("upload")}
          />
          Upload File
        </label>
        <label>
          <input
            type="radio"
            name="upload-mode"
            value="sample"
            checked={mode === "sample"}
            onChange={() => setMode("sample")}
          />
          Use Sample Doc
        </label>
      </div>

      {uploadMessage && (
        <div className="alert alert--error">{uploadMessage}</div>
      )}

      {mode === "sample" && (
        <div className="card">
          <div className="section-title">
            <div>
              <h3>Bundled Sample Documents</h3>
              <p>Select a PDF to run through the pipeline instantly.</p>
            </div>
          </div>

          {samplesLoading && <p>Loading sample documents…</p>}
          {samplesError && (
            <div className="alert alert--error">{samplesError}</div>
          )}
          {!samplesLoading && samples.length === 0 && !samplesError && (
            <p>No bundled PDFs available.</p>
          )}

          {!samplesLoading && samples.length > 0 && (
            <>
              <div className="table-wrapper">
                <table className="sample-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Size</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((sample) => {
                      const isProcessing =
                        processingSampleId === sample.filename;
                      return (
                        <tr key={sample.id}>
                          <td>
                            <div className="sample-name">
                              <strong>{sample.display_name}</strong>
                              <div className="muted">
                                {sample.filename}
                              </div>
                            </div>
                          </td>
                          <td>{formatBytes(sample.size_bytes)}</td>
                          <td>
                            <div className="sample-actions">
                              <button
                                type="button"
                                className="btn btn--secondary"
                                onClick={() => handlePreview(sample.filename)}
                                disabled={previewLoading}
                              >
                                {previewLoading ? "Loading…" : "Preview"}
                              </button>
                              <button
                                type="button"
                                className="btn"
                                onClick={() =>
                                  handleProcessSample(sample.filename)
                                }
                                disabled={isProcessing}
                              >
                                {isProcessing
                                  ? "Processing…"
                                  : "Process"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {processingSampleId !== null && (
                <p className="muted small-note">
                  Note: Processing will take ~5 minutes.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <PDFPreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => {
          setPreviewFile(null);
          setPreviewError(null);
        }}
        title={previewFile?.name || "PDF Preview"}
      />

      {previewError && (
        <div className="alert alert--error">{previewError}</div>
      )}

      {mode === "upload" && (
        <form className="grid" onSubmit={handleUploadSubmit}>
      <div className="form-group">
        <label htmlFor="file">PDF File</label>
        <input
          id="file"
          type="file"
          accept="application/pdf"
          onChange={(event) =>
            setFile(event.target.files ? event.target.files[0] : null)
          }
          required
          disabled={uploading}
        />
        <small>Maximum size ~32 MB (Cloud Run request limit).</small>
      </div>

      <div className="grid grid--two-columns">
        <div className="form-group">
          <label htmlFor="pageRange">Page Range</label>
          <input
            id="pageRange"
                value={uploadPageRange}
                onChange={(event) => setUploadPageRange(event.target.value)}
            placeholder='Example: "all" or "1-10"'
            disabled={uploading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="documentType">Document Type</label>
          <input
            id="documentType"
                value={uploadDocumentType}
                onChange={(event) => setUploadDocumentType(event.target.value)}
            disabled={uploading}
          />
        </div>
      </div>

      <button
          className="btn"
          type="submit"
          disabled={!file || uploading}
        >
          {uploading ? "Uploading…" : "Upload & Process"}
        </button>
          <p className="muted small-note">
            Note: Uploads will take ~5 minutes.
          </p>

      {!file && (
        <div className="card">
              <strong>Tip:</strong> After upload completes, switch to the
              Ontology tab to explore results, then the Query tab for QA.
        </div>
      )}
    </form>
      )}
    </div>
  );
};

export default UploadTab;

