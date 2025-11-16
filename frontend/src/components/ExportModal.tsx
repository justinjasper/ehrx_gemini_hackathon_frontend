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
  { value: "epic", label: "Epic", logo: "/logos/EpicLogo.png" },
  { value: "cerner", label: "Cerner", logo: "/logos/CernerLogo.png" },
  { value: "oracle", label: "Oracle", logo: "/logos/OracleLogo.png" },
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
              <label htmlFor="exportDocType">Document Type</label>
              <select
                id="exportDocType"
                onChange={() => {}}
                defaultValue=""
              >
                <option value="" disabled>
                  Select a type
                </option>
                <option>Medical Report</option>
                <option>Appointment Note</option>
                <option>Progress Note</option>
                <option>Discharge Summary</option>
                <option>Lab Results</option>
                <option>Physician Referral</option>
                <option>Imaging Report</option>
                <option>Consent Form</option>
                <option>Immunization Record</option>
              </select>
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
                      <div 
                        className="export-logo-box"
                        style={{
                          width: opt.value === "epic" ? "60px" : "80px",
                          height: opt.value === "epic" ? "42px" : "56px"
                        }}
                      >
                        <img
                          src={opt.logo}
                          alt={opt.label}
                          className="export-logo"
                          onError={(e) => {
                            // Fallback if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="export-logo fallback">${opt.label[0]}</div>`;
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <span className="export-label">{opt.label}</span>
                    )}
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


