import { useEffect, useState } from "react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (params: { name: string; destination: string }) => void;
  suggestedName?: string;
}

type DestinationOption = {
  value: string;
  label: string;
  logo?: string;
};

const DESTINATIONS: DestinationOption[] = [
  { value: "epic", label: "Epic", logo: "/logos/epic.png" },
  { value: "cerner", label: "Cerner", logo: "/logos/cerner.png" },
  { value: "oracle", label: "Oracle", logo: "/logos/oracle.png" },
  { value: "other", label: "Other" }
];

const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  suggestedName
}: ExportModalProps) => {
  const [name, setName] = useState(suggestedName || "");
  const [destination, setDestination] = useState<string>("epic");

  useEffect(() => {
    if (isOpen) {
      setName(suggestedName || "");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, suggestedName]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Export to EHR</h3>
          <button className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          <div className="grid">
            <div className="form-group">
              <label htmlFor="exportName">Name</label>
              <input
                id="exportName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter document name"
              />
            </div>
            <div className="form-group">
              <label>Export to</label>
              <div className="export-options">
                {DESTINATIONS.map((opt) => (
                  <label key={opt.value} className="export-option">
                    <input
                      type="radio"
                      name="export-destination"
                      value={opt.value}
                      checked={destination === opt.value}
                      onChange={() => setDestination(opt.value)}
                    />
                    {opt.logo ? (
                      <div className="export-logo-box">
                        <img
                          src={opt.logo}
                          alt={opt.label}
                          className="export-logo"
                        />
                      </div>
                    ) : (
                      <div className="export-logo-box">
                        <div className="export-logo fallback">{opt.label[0]}</div>
                      </div>
                    )}
                    <span className="export-label">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <button
                className="btn"
                onClick={() => {
                  onExport({ name: name || "Untitled", destination });
                  onClose();
                }}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;


