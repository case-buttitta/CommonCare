import { useState, useEffect } from "react";

const BIOMARKER_OPTIONS = [
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "heart_rate",
  "respiratory_rate",
  "oxygen_saturation",
  "temperature",
  "blood_glucose",
  "cholesterol_total",
  "cholesterol_ldl",
  "cholesterol_hdl",
  "triglycerides",
  "weight",
  "height",
  "bmi"
];

// Units per biomarker type
const BIOMARKER_UNITS = {
  blood_pressure_systolic: ["mmHg"],
  blood_pressure_diastolic: ["mmHg"],
  heart_rate: ["bpm"],
  respiratory_rate: ["breaths/min"],
  oxygen_saturation: ["%"],
  temperature: ["°F", "°C"],
  blood_glucose: ["mg/dL", "mmol/L"],
  cholesterol_total: ["mg/dL"],
  cholesterol_ldl: ["mg/dL"],
  cholesterol_hdl: ["mg/dL"],
  triglycerides: ["mg/dL"],
  weight: ["kg", "lb"],
  height: ["cm", "in"],
  bmi: ["kg/m²"]
};

// Health Status Evaluator
function evaluateHealthStatus(value, min, max) {
  if (value < min) {
    if (value >= min * 0.95) return { status: "Slightly Low", color: "orange" };
    return { status: "Low", color: "red" };
  }

  if (value > max) {
    if (value <= max * 1.05) return { status: "Slightly High", color: "orange" };
    return { status: "High", color: "red" };
  }

  return { status: "Normal", color: "green" };
}

// Accent strip colors
const ACCENT_COLORS = {
  green: "#4CAF50",
  orange: "#FF9800",
  red: "#F44336",
  default: "#BDBDBD"
};

export default function NormalRanges() {
  const [ranges, setRanges] = useState([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Test values per biomarker
  const [testValues, setTestValues] = useState({});

  const [form, setForm] = useState({
    biomarker_type: "",
    min_value: "",
    max_value: "",
    unit: ""
  });

  const token = localStorage.getItem("token");

  // Fetch existing ranges
  useEffect(() => {
    fetch("/api/normal-ranges", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setRanges(data))
      .catch(err => console.error("GET /normal-ranges failed:", err));
  }, [token]);

  // Handle form changes, including auto-selecting unit
  const handleChange = (e) => {
    const { name, value } = e.target;

    // If biomarker changes → update unit options
    if (name === "biomarker_type") {
      const units = BIOMARKER_UNITS[value] || [];
      setForm(prev => ({
        ...prev,
        biomarker_type: value,
        unit: units.length === 1 ? units[0] : "" // auto-select if only one unit
      }));
      return;
    }

    setForm(prev => ({ ...prev, [name]: value }));
  };

  const startEditing = (range) => {
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
    setForm({
      biomarker_type: "",
      min_value: "",
      max_value: "",
      unit: ""
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this range?")) return;

    const res = await fetch(`/api/normal-ranges/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      setRanges(prev => prev.filter(r => r.id !== id));
    } else {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      alert(error.error || "Failed to delete range");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!form.biomarker_type.trim()) {
      setError("Biomarker type is required.");
      return;
    }

    if (!form.min_value || !form.max_value) {
      setError("Min and Max values are required.");
      return;
    }

    const minVal = parseFloat(form.min_value);
    const maxVal = parseFloat(form.max_value);

    if (isNaN(minVal) || isNaN(maxVal)) {
      setError("Min and Max must be valid numbers.");
      return;
    }

    if (minVal >= maxVal) {
      setError("Min must be LESS than Max.");
      return;
    }

    if (!form.unit.trim()) {
      setError("Unit is required.");
      return;
    }

    const payload = {
      biomarker_type: form.biomarker_type.trim(),
      min_value: minVal,
      max_value: maxVal,
      unit: form.unit.trim()
    };

    // EDIT MODE
    if (editingId !== null) {
      const res = await fetch(`/api/normal-ranges/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const updated = await res.json();
        setRanges(prev => prev.map(r => (r.id === editingId ? updated : r)));
        cancelEditing();
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(errorData.error || "Failed to update normal range");
      }

      return;
    }

    // CREATE MODE
    const res = await fetch("/api/normal-ranges", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const newRange = await res.json();
      setRanges(prev => [...prev, newRange]);

      setForm({
        biomarker_type: "",
        min_value: "",
        max_value: "",
        unit: ""
      });
    } else {
      const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
      setError(errorData.error || "Failed to add normal range");
    }
  };

  // Filtering + sorting
  const filtered = ranges
    .filter(r =>
      r.biomarker_type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.biomarker_type.localeCompare(b.biomarker_type));

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  return (
    <div style={{ padding: "20px" }}>
      <h1>Normal Ranges (Staff Only)</h1>

      {error && (
        <div
          style={{
            background: "#ffe6e6",
            color: "#b30000",
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "15px",
            border: "1px solid #ffcccc"
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: "30px" }}>
        {/* Biomarker dropdown */}
        <select
          name="biomarker_type"
          value={form.biomarker_type}
          onChange={handleChange}
          style={{ padding: "6px", marginBottom: "10px", marginRight: "10px" }}
        >
          <option value="">Select Biomarker Type</option>
          {BIOMARKER_OPTIONS.map(opt => (
            <option key={opt} value={opt}>
              {opt.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <input
          name="min_value"
          placeholder="Normal Min"
          value={form.min_value}
          onChange={handleChange}
          style={{ marginRight: "10px" }}
        />

        <input
          name="max_value"
          placeholder="Normal Max"
          value={form.max_value}
          onChange={handleChange}
          style={{ marginRight: "10px" }}
        />

        {/* Dynamic unit dropdown */}
        <select
          name="unit"
          value={form.unit}
          onChange={handleChange}
          disabled={!form.biomarker_type}
          style={{ padding: "6px", marginBottom: "10px", marginRight: "10px" }}
        >
          <option value="">Select Unit</option>

          {form.biomarker_type &&
            BIOMARKER_UNITS[form.biomarker_type]?.map(unit => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
        </select>

        {/* Auto-calculated average (UI only) */}
        <div style={{ marginTop: "10px", fontStyle: "italic" }}>
          {form.min_value &&
            form.max_value &&
            !isNaN(parseFloat(form.min_value)) &&
            !isNaN(parseFloat(form.max_value)) && (
              <>
                Calculated Average:{" "}
                {(parseFloat(form.min_value) + parseFloat(form.max_value)) / 2}
              </>
            )}
        </div>

        {/* Live Min < Max warning */}
        {form.min_value &&
          form.max_value &&
          parseFloat(form.min_value) >= parseFloat(form.max_value) && (
            <div style={{ color: "red", marginTop: "5px" }}>
              Min must be less than Max
            </div>
          )}

        <button type="submit" style={{ marginTop: "10px" }}>
          {editingId ? "Save Changes" : "Add Normal Range"}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={cancelEditing}
            style={{
              marginLeft: "10px",
              background: "#999",
              color: "white",
              border: "none",
              padding: "6px 10px",
              borderRadius: "4px",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        )}
      </form>

      {/* Search bar */}
      <input
        type="text"
        placeholder="Search biomarker..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1);
        }}
        style={{
          padding: "8px",
          width: "250px",
          marginBottom: "15px",
          borderRadius: "6px",
          border: "1px solid #ccc"
        }}
      />

      <h2>Existing Ranges</h2>
      <ul style={{ padding: 0 }}>
        {paginated.map(r => {
          const unit = r.unit ? ` ${r.unit}` : "";

          // Determine accent strip color
          const testValue = testValues[r.id];
          let accentColor = ACCENT_COLORS.default;

          if (testValue) {
            const value = parseFloat(testValue);
            const result = evaluateHealthStatus(value, r.min_value, r.max_value);
            accentColor = ACCENT_COLORS[result.color] || ACCENT_COLORS.default;
          }

          const average =
            r.min_value != null && r.max_value != null
              ? (r.min_value + r.max_value) / 2
              : null;

          return (
            <li
              key={r.id}
              style={{
                padding: "10px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                marginBottom: "8px",
                background: "#ffffff",
                listStyle: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderLeft: `6px solid ${accentColor}`
              }}
            >
              <div>
                <strong>{r.biomarker_type}</strong>
                <div>
                  Normal Range: {r.min_value}–{r.max_value}
                  {unit}
                </div>
                {average !== null && (
                  <div>
                    Average: {average}
                    {unit}
                  </div>
                )}

                {/* Test patient value + health indicator */}
                <div style={{ marginTop: "10px" }}>
                  <input
                    type="number"
                    placeholder="Test patient value"
                    value={testValues[r.id] || ""}
                    onChange={(e) =>
                      setTestValues(prev => ({ ...prev, [r.id]: e.target.value }))
                    }
                    style={{ width: "150px", marginRight: "10px" }}
                  />

                  {testValues[r.id] && (() => {
                    const value = parseFloat(testValues[r.id]);
                    const result = evaluateHealthStatus(
                      value,
                      r.min_value,
                      r.max_value
                    );

                    const diff =
                      value < r.min_value
                        ? r.min_value - value
                        : value > r.max_value
                        ? value - r.max_value
                        : 0;

                    return (
                      <div style={{ color: result.color, fontWeight: "bold" }}>
                        Status: {result.status}
                        {diff > 0 && (
                          <span style={{ marginLeft: "8px", fontWeight: "normal" }}>
                            ({diff.toFixed(1)} {r.unit} outside normal)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <button
                  onClick={() => startEditing(r)}
                  style={{
                    background: "#4da6ff",
                    color: "white",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    marginRight: "10px"
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => handleDelete(r.id)}
                  style={{
                    background: "#ff4d4d",
                    color: "white",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Pagination */}
      <div
        style={{
          marginTop: "15px",
          display: "flex",
          gap: "10px",
          alignItems: "center"
        }}
      >
        <button
          disabled={safePage === 1}
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
        >
          Previous
        </button>
        <span>
          Page {safePage} of {totalPages}
        </span>
        <button
          disabled={safePage === totalPages}
          onClick={() =>
            setCurrentPage(p => Math.min(totalPages, p + 1))
          }
        >
          Next
        </button>
      </div>
    </div>
  );
}
