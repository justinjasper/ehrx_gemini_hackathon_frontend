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
  "processing_stats"
]);

const JSONTree = ({ data, label = "root" }: JSONTreeProps) => {
  const [open, setOpen] = useState(true);

  if (!isObject(data) && !Array.isArray(data)) {
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

  return (
    <div className="json-node">
      <div
        className="json-key"
        onClick={() => setOpen((prev) => !prev)}
        role="button"
      >
        {open ? "▼" : "▶"} {label}
      </div>
      {open &&
        entries.map(([key, value]) => (
          <JSONTree key={String(key)} data={value} label={String(key)} />
        ))}
    </div>
  );
};

export default JSONTree;

