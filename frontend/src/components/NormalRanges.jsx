import { useState, useEffect } from "react";
import { api } from "../api";

const BIOMARKER_OPTIONS = [
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "heart_rate",
  "cholesterol_total",
  "blood_sugar",
  "vitamin_d",
  "bmi",
  "hba1c",
  "kidney_function_egfr",
  "liver_enzymes_alt",
  "calcium",
  "hemoglobin",
  "respiratory_rate",
  "oxygen_saturation",
  "temperature",
  "cholesterol_ldl",
  "cholesterol_hdl",
  "triglycerides",
  "weight",
  "height",
];

const BIOMARKER_UNITS = {
  blood_pressure_systolic: ["mmHg"],
  blood_pressure_diastolic: ["mmHg"],
  heart_rate: ["bpm"],
  cholesterol_total: ["mg/dL"],
  blood_sugar: ["mg/dL", "mmol/L"],
  vitamin_d: ["ng/mL"],
  bmi: ["kg/m\u00B2"],
  hba1c: ["%"],
  kidney_function_egfr: ["mL/min"],
  liver_enzymes_alt: ["U/L"],
  calcium: ["mg/dL"],
  hemoglobin: ["g/dL"],
  respiratory_rate: ["breaths/min"],
  oxygen_saturation: ["%"],
  temperature: ["\u00B0F", "\u00B0C"],
  cholesterol_ldl: ["mg/dL"],
  cholesterol_hdl: ["mg/dL"],
  triglycerides: ["mg/dL"],
  weight: ["kg", "lb"],
  height: ["cm", "in"],
};


function evaluateHealthStatus(value, min, max) {
  if (value < min) {
    if (value >= min * 0.95) return { status: "Slightly Low", color: "#e67e00" };
    return { status: "Low", color: "#c0392b" };
  }
  if (value > max) {
    if (value <= max * 1.05) return { status: "Slightly High", color: "#e67e00" };
    return { status: "High", color: "#c0392b" };
  }
  return { status: "Normal", color: "#27ae60" };
}

const emptyForm = { biomarker_type: "", min_value: "", max_value: "", unit: "" };

export default function NormalRanges() {
  const [ranges, setRanges] = useState([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;
  const [testValues, setTestValues] = useState({});
  const [form, setForm] = useState(emptyForm);

  // Mode: "standard" uses the preset dropdown, "custom" uses free-text inputs
  const [formMode, setFormMode] = useState("standard");

  const token = localStorage.getItem("token");

  useEffect(() => {
    api("/api/normal-ranges", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setRanges(data))
      .catch(err => console.error("GET /normal-ranges failed:", err));
  }, [token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (formMode === "standard" && name === "biomarker_type") {
      const units = BIOMARKER_UNITS[value] || [];
      setForm(prev => ({
        ...prev,
        biomarker_type: value,
        unit: units.length === 1 ? units[0] : ""
      }));
      return;
    }
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const switchMode = (mode) => {
    setFormMode(mode);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const startEditing = (range) => {
    // If the biomarker type is in the standard list, use standard mode; otherwise custom
    const isStandard = BIOMARKER_OPTIONS.includes(range.biomarker_type);
    setFormMode(isStandard ? "standard" : "custom");
    setEditingId(range.id);
    setForm({
      biomarker_type: range.biomarker_type,
      min_value: range.min_value,
      max_value: range.max_value,
      unit: range.unit
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this range?")) return;
    const res = await api(`/api/normal-ranges/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      setRanges(prev => prev.filter(r => r.id !== id));
    } else {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      setError(data.error || "Failed to delete range");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.biomarker_type.trim()) return setError("Biomarker type is required.");
    if (!form.min_value || !form.max_value) return setError("Min and Max values are required.");
    const minVal = parseFloat(form.min_value);
    const maxVal = parseFloat(form.max_value);
    if (isNaN(minVal) || isNaN(maxVal)) return setError("Min and Max must be valid numbers.");
    if (minVal >= maxVal) return setError("Min must be less than Max.");
    if (!form.unit.trim()) return setError("Unit is required.");

    const payload = {
      biomarker_type: form.biomarker_type.trim(),
      min_value: minVal,
      max_value: maxVal,
      unit: form.unit.trim()
    };

    if (editingId !== null) {
      const res = await api(`/api/normal-ranges/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        setRanges(prev => prev.map(r => (r.id === editingId ? updated : r)));
        cancelEditing();
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(data.error || "Failed to update normal range");
      }
      return;
    }

    const res = await api("/api/normal-ranges", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const newRange = await res.json();
      setRanges(prev => {
        const exists = prev.findIndex(r => r.biomarker_type === newRange.biomarker_type);
        if (exists >= 0) {
          const arr = [...prev];
          arr[exists] = newRange;
          return arr;
        }
        return [...prev, newRange];
      });
      setForm(emptyForm);
    } else {
      const data = await res.json().catch(() => ({ error: "Unknown error" }));
      setError(data.error || "Failed to add normal range");
    }
  };

  const filtered = ranges
    .filter(r => r.biomarker_type.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.biomarker_type.localeCompare(b.biomarker_type));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const formatName = (type) =>
    type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="tab-panel">
      <h3 className="section-title">Normal Ranges</h3>

      {error && <div className="form-error-banner">{error}</div>}

      {/* ── Add / Edit Form ── */}
      <div className="normal-ranges-form-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h4 className="subsection-title" style={{ margin: 0 }}>
            {editingId ? "Edit Range" : "Add Normal Range"}
          </h4>
          {!editingId && (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {["standard", "custom"].map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={formMode === mode ? "auth-button" : undefined}
                  style={formMode === mode
                    ? { width: "auto", padding: "0.35rem 0.9rem", fontSize: "0.85rem" }
                    : { width: "auto", padding: "0.35rem 0.9rem", fontSize: "0.85rem", background: "#6c757d", border: "none", color: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }
                  }
                  onClick={() => switchMode(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            {formMode === "standard" ? (
              <>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Biomarker Type</label>
                  <select name="biomarker_type" value={form.biomarker_type} onChange={handleChange}>
                    <option value="">Select biomarker...</option>
                    {BIOMARKER_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{formatName(opt)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Unit</label>
                  <select name="unit" value={form.unit} onChange={handleChange} disabled={!form.biomarker_type}>
                    <option value="">Select unit...</option>
                    {form.biomarker_type && BIOMARKER_UNITS[form.biomarker_type]?.map(unit => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Biomarker Name</label>
                  <input
                    type="text"
                    name="biomarker_type"
                    placeholder="e.g. cortisol, ferritin, vitamin_d"
                    value={form.biomarker_type}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Unit</label>
                  <input
                    type="text"
                    name="unit"
                    placeholder="e.g. ng/mL"
                    value={form.unit}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Normal Min</label>
              <input
                type="number"
                name="min_value"
                placeholder="e.g. 90"
                value={form.min_value}
                onChange={handleChange}
                step="any"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Normal Max</label>
              <input
                type="number"
                name="max_value"
                placeholder="e.g. 120"
                value={form.max_value}
                onChange={handleChange}
                step="any"
              />
            </div>
            {form.min_value && form.max_value && !isNaN(parseFloat(form.min_value)) && !isNaN(parseFloat(form.max_value)) && parseFloat(form.min_value) < parseFloat(form.max_value) && (
              <div className="form-group" style={{ flex: 1 }}>
                <label>Calculated Average</label>
                <input
                  type="text"
                  readOnly
                  value={(parseFloat(form.min_value) + parseFloat(form.max_value)) / 2}
                />
              </div>
            )}
          </div>

          {form.min_value && form.max_value && parseFloat(form.min_value) >= parseFloat(form.max_value) && (
            <p className="form-inline-error">Min must be less than Max</p>
          )}

          <div className="form-actions">
            <button type="submit" className="auth-button" style={{ width: "auto", padding: "0.6rem 1.5rem" }}>
              {editingId ? "Save Changes" : "Add Range"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={cancelEditing}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Search ── */}
      <div className="form-group" style={{ maxWidth: "320px", marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search biomarker..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        />
      </div>

      {/* ── List ── */}
      <h4 className="subsection-title">Existing Ranges ({filtered.length})</h4>
      {paginated.length === 0 ? (
        <div className="empty-state"><p>No normal ranges defined yet.</p></div>
      ) : (
        <div className="normal-ranges-list">
          {paginated.map(r => {
            const unit = r.unit ? ` ${r.unit}` : "";
            const testValue = testValues[r.id];
            let accentColor = "#d0d0d0";
            let statusResult = null;

            if (testValue) {
              statusResult = evaluateHealthStatus(parseFloat(testValue), r.min_value, r.max_value);
              accentColor = statusResult.color;
            }

            const average = r.min_value != null && r.max_value != null
              ? (r.min_value + r.max_value) / 2
              : null;

            return (
              <div key={r.id} className="normal-range-item" style={{ borderLeftColor: accentColor }}>
                <div className="normal-range-info">
                  <div className="normal-range-name">{formatName(r.biomarker_type)}</div>
                  <div className="normal-range-values">
                    <span className="reading-chip">{r.min_value}–{r.max_value}{unit}</span>
                    {average !== null && (
                      <span className="reading-chip">Avg: {average}{unit}</span>
                    )}
                  </div>

                  <div className="normal-range-test">
                    <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: "200px" }}>
                      <input
                        type="number"
                        placeholder={`Test value (${r.unit})`}
                        value={testValues[r.id] || ""}
                        onChange={(e) => setTestValues(prev => ({ ...prev, [r.id]: e.target.value }))}
                      />
                    </div>
                    {statusResult && (
                      <span className="normal-range-status" style={{ color: statusResult.color }}>
                        {statusResult.status}
                        {(() => {
                          const v = parseFloat(testValues[r.id]);
                          const diff = v < r.min_value ? r.min_value - v : v > r.max_value ? v - r.max_value : 0;
                          return diff > 0 ? ` (${diff.toFixed(1)} ${r.unit} outside)` : "";
                        })()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="normal-range-actions">
                  <button className="btn-secondary" onClick={() => startEditing(r)}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDelete(r.id)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn-secondary" disabled={safePage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
            Previous
          </button>
          <span className="pagination-info">Page {safePage} of {totalPages}</span>
          <button className="btn-secondary" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
