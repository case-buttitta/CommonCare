import { useState, useEffect } from "react";
import { api } from "../api";
import "./MedicalHistory.css";
import ConfirmModal from "./ConfirmationModal.jsx";

const MedicalHistory = ({ patientId, userType }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [formData, setFormData] = useState({
    condition: "",
    diagnosis_date: "",
    status: "Active",
    notes: "",
  });

  useEffect(() => {
    fetchHistory();
  }, [patientId]);

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await api(`/api/patients/${patientId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch medical history");

      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const token = localStorage.getItem("token");
      const url = editingId
        ? `/api/history/${editingId}`
        : `/api/patients/${patientId}/history`;

      const method = editingId ? "PUT" : "POST";

      const response = await api(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save record");

      await fetchHistory();
      setShowForm(false);
      resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      const response = await api(`/api/history/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete record");

      fetchHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (record) => {
    setFormData({
      condition: record.condition,
      diagnosis_date: record.diagnosis_date || "",
      status: record.status,
      notes: record.notes || "",
    });
    setEditingId(record.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      condition: "",
      diagnosis_date: "",
      status: "Active",
      notes: "",
    });
    setEditingId(null);
  };

  if (loading) return <div className="loading">Loading history...</div>;

  return (
    <div className="medical-history">
      <div className="header">
        <h2>Medical History</h2>
        {userType === "staff" && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            Add Condition
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {showForm && (
        <form onSubmit={handleSubmit} className="history-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Condition</label>
              <input
                type="text"
                required
                value={formData.condition}
                onChange={(e) =>
                  setFormData({ ...formData, condition: e.target.value })
                }
              />
            </div>

            <div className="form-group">
              <label>Diagnosis Date</label>
              <input
                type="date"
                value={formData.diagnosis_date}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    diagnosis_date: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
                <option value="Active">Active</option>
                <option value="Managed">Managed</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="btn btn-secondary"
            >
              Cancel
            </button>

            <button type="submit" className="btn btn-primary">
              {editingId ? "Update" : "Save"}
            </button>
          </div>
        </form>
      )}
      {/* Confirmation Modal for Deletion */}

      <ConfirmModal
        isOpen={showConfirm}
        title="Delete Record"
        message="Are you sure you want to permanently delete this record?"
        onCancel={() => {
          setShowConfirm(false);
          setDeleteId(null);
        }}
        onConfirm={async () => {
          await handleDelete(deleteId);
          setShowConfirm(false);
          setDeleteId(null);
        }}
      />
      {history.length === 0 ? (
        <p className="empty">No medical history recorded.</p>
      ) : (
        <div className="history-list">
          {history.map((record) => (
            <div key={record.id} className="history-item">
              <div className="history-content">
                <h3>{record.condition}</h3>
                <p className="meta">
                  Diagnosed: {record.diagnosis_date || "N/A"} • Status:
                  <span className={`status ${record.status.toLowerCase()}`}>
                    {record.status}
                  </span>
                </p>
                {record.notes && <p className="notes">{record.notes}</p>}
              </div>

              {userType === "staff" && (
                <div className="actions">
                  <button
                    onClick={() => handleEdit(record)}
                    className="btn-secondary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeleteId(record.id);
                      setShowConfirm(true);
                    }}
                    className="btn-danger"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicalHistory;
