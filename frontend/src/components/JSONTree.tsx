import { useState } from "react";

interface JSONTreeProps {
  data: unknown;
  label?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const FIELDS_TO_EXCLUDE = new Set([
  "page_info",
  "processing_metadata",
  "confidence",
  "bbox_pixel",
  "bbox_pdf",
  "clinical_metadata",
  "processing_stats",
  "needs_review",
  "element_id",
  "error",
  "confidence_threshold"
]);

// Get type from an object for preview
const getTypePreview = (data: unknown): string => {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.type === "string" && obj.type.trim()) {
      return obj.type;
    }
  }
  return "";
};

const JSONTree = ({ data, label = "root" }: JSONTreeProps) => {
  const [open, setOpen] = useState(true);
  const isRoot = label === "root";

  if (!isObject(data) && !Array.isArray(data)) {
    // Special handling for content fields - display as plain text with line breaks
    if (label === "content" && typeof data === "string") {
      return (
        <div className="json-node">
          <span className="json-key">{label}: </span>
          <span className="json-value" style={{ whiteSpace: "pre-wrap" }}>
            {data}
          </span>
        </div>
      );
    }
    return (
      <div className="json-node">
        <span className="json-key">{label}: </span>
        <span className="json-value">{JSON.stringify(data)}</span>
      </div>
    );
  }

  let entries: [string | number, unknown][];
  
  if (Array.isArray(data)) {
    entries = data.map((item, index) => [index, item]);
  } else {
    // Filter out excluded fields
    entries = Object.entries(data).filter(
      ([key]) => !FIELDS_TO_EXCLUDE.has(key)
    );
  }

  // For array indices, always show type instead of number
  const displayLabel = typeof label === "string" && /^\d+$/.test(label)
    ? (() => {
        const typePreview = getTypePreview(data);
        return typePreview || "";
      })()
    : label;

  // Skip root wrapper - render children directly
  if (isRoot) {
    return (
      <>
        {entries.map(([key, value]) => (
          <JSONTree key={String(key)} data={value} label={String(key)} />
        ))}
      </>
    );
  }

  return (
    <div className="json-node">
      <div
        className="json-key"
        onClick={() => setOpen((prev) => !prev)}
        role="button"
      >
        {open ? "▼" : "▶"} {displayLabel}
      </div>
      {open &&
        entries.map(([key, value]) => (
          <JSONTree key={String(key)} data={value} label={String(key)} />
        ))}
    </div>
  );
};

export default JSONTree;

