import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";
import MedicalHistory from "./components/MedicalHistory";
import BiomarkerChart from "./components/BiomarkerChart";
import MessagingWidget from "./components/MessagingWidget";

// Human-readable names and icons for biomarker types
const BIOMARKER_META = {
  blood_pressure_systolic: { label: "Blood Pressure Systolic", icon: "❤️", color: "#e63946" },
  blood_pressure_diastolic: { label: "Blood Pressure Diastolic", icon: "❤️", color: "#e07a7a" },
  heart_rate: { label: "Heart Rate", icon: "💓", color: "#457b9d" },
  cholesterol_total: { label: "Cholesterol", icon: "🩸", color: "#e76f51" },
  blood_sugar: { label: "Blood Sugar (Glucose)", icon: "🍬", color: "#f4a261" },
  vitamin_d: { label: "Vitamin D", icon: "☀️", color: "#e9c46a" },
  bmi: { label: "BMI", icon: "⚖️", color: "#2a9d8f" },
  hba1c: { label: "HbA1c", icon: "🔬", color: "#264653" },
  kidney_function_egfr: { label: "Kidney Function (eGFR)", icon: "🫘", color: "#6a994e" },
  liver_enzymes_alt: { label: "Liver Enzymes (ALT)", icon: "🧪", color: "#bc6c25" },
  calcium: { label: "Calcium", icon: "🦴", color: "#606c38" },
  hemoglobin: { label: "Hemoglobin", icon: "🩸", color: "#d62828" },
};

function getBiomarkerStatus(type, value, normalRanges) {
  const range = normalRanges.find((r) => r.biomarker_type === type);
  if (!range) return { status: "Unknown", className: "status-unknown" };
  if (value < range.min_value) return { status: "Low", className: "status-low" };
  if (value > range.max_value) {
    // Borderline check: within 10% above max
    const borderline = range.max_value * 1.1;
    if (value <= borderline) return { status: "Borderline", className: "status-borderline" };
    if (type === "bmi" && value >= 25 && value < 30) return { status: "Overweight", className: "status-borderline" };
    if (type === "hba1c" && value > range.max_value && value <= 6.4) return { status: "Elevated", className: "status-elevated" };
    return { status: "High", className: "status-high" };
  }
  return { status: "Normal", className: "status-normal" };
}

function getMiniTrend(history, type) {
  if (!history || !history[type] || history[type].length < 2) return null;
  const data = history[type].slice(-6);
  return data.map((d) => d.value);
}

function MiniSparkline({ values, status }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const color = status === "status-normal" ? "#16a34a" :
    status === "status-high" ? "#dc2626" :
      status === "status-low" ? "#2563eb" :
        status === "status-borderline" ? "#d97706" :
          status === "status-elevated" ? "#ea580c" : "#94a3b8";
  return (
    <svg width={w} height={h} className="mini-sparkline">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PatientDashboard() {
  const { user, token, logout, deleteAccount, updateUser } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [biomarkers, setBiomarkers] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [normalRanges, setNormalRanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bookingDoctor, setBookingDoctor] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingReason, setBookingReason] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  const [historyModal, setHistoryModal] = useState(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', address: '', location: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bioRes, apptRes, staffRes, rangesRes] = await Promise.all([
        api(`/api/patients/${user.id}/biomarkers`, { headers }),
        api("/api/appointments", { headers }),
        api("/api/staff", { headers }),
        api("/api/normal-ranges", { headers }),
      ]);
      if (bioRes.ok) setBiomarkers(await bioRes.json());
      if (apptRes.ok) setAppointments(await apptRes.json());
      if (staffRes.ok) setStaffList(await staffRes.json());
      if (rangesRes.ok) setNormalRanges(await rangesRes.json());
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  const startEditProfile = () => {
    setProfileForm({ full_name: user?.full_name || '', address: user?.address || '', location: user?.location || '' });
    setEditingProfile(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const res = await api('/api/auth/profile', { method: 'PUT', headers, body: JSON.stringify(profileForm) });
      if (res.ok) {
        updateUser(await res.json());
        setEditingProfile(false);
        showToast('Profile updated', 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update profile');
      }
    } catch { showToast('Failed to update profile'); }
    finally { setProfileSaving(false); }
  };

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingSubmitting(true);
    try {
      const res = await api("/api/appointments", {
        method: "POST",
        headers,
        body: JSON.stringify({
          doctor_id: parseInt(bookingDoctor),
          appointment_date: bookingDate,
          reason: bookingReason,
        }),
      });
      if (res.ok) {
        setBookingDoctor(""); setBookingDate(""); setBookingReason("");
        fetchData();
        setActiveTab("appointments");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to book appointment");
      }
    } catch { showToast("Failed to book appointment"); }
    finally { setBookingSubmitting(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await deleteAccount(); }
    catch (err) { showToast(err.message); setDeleting(false); }
  };

  const formatBiomarkerName = (type) => {
    return BIOMARKER_META[type]?.label || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const pendingAppointments = appointments.filter((a) => a.status === "pending");
  const pastAppointments = appointments.filter((a) => a.status !== "pending");

  // Get latest appointment treatments for recommended treatments section
  const latestCompletedAppt = pastAppointments.find((a) => a.status === "completed");
  const recommendedTreatments = [];
  if (latestCompletedAppt?.treatments) {
    latestCompletedAppt.treatments.split('.').filter(Boolean).forEach((t, i) => {
      const trimmed = t.trim();
      if (trimmed) recommendedTreatments.push(trimmed);
    });
  }

  // Build recommendation items from medical history-like data and latest biomarkers
  const getRecommendations = () => {
    if (!biomarkers?.latest || normalRanges.length === 0) return [];
    const recs = [];
    const latest = biomarkers.latest;

    // Check each biomarker against ranges
    if (latest.blood_pressure_systolic) {
      const { status } = getBiomarkerStatus("blood_pressure_systolic", latest.blood_pressure_systolic.value, normalRanges);
      if (status !== "Normal") recs.push({
        icon: "❤️", title: "Reduce Blood Pressure",
        detail: "Continue medication • 30 min exercise, 5x/week",
        color: "#e63946"
      });
    }
    if (latest.vitamin_d) {
      const { status } = getBiomarkerStatus("vitamin_d", latest.vitamin_d.value, normalRanges);
      if (status !== "Normal") recs.push({
        icon: "☀️", title: "Vitamin D Deficiency",
        detail: "Take 2000 IU daily • Repeat test in 3 months",
        color: "#e9c46a"
      });
    }
    if (latest.cholesterol_total) {
      const { status } = getBiomarkerStatus("cholesterol_total", latest.cholesterol_total.value, normalRanges);
      if (status !== "Normal") recs.push({
        icon: "🩸", title: "High Cholesterol",
        detail: "Diet: Low fat, high fiber • Recheck in 2 months",
        color: "#e76f51"
      });
    }
    if (latest.bmi) {
      const { status } = getBiomarkerStatus("bmi", latest.bmi.value, normalRanges);
      if (status !== "Normal") recs.push({
        icon: "⚖️", title: "Weight Management",
        detail: "Target BMI < 25 • Diet and exercise plan",
        color: "#2a9d8f"
      });
    }
    if (latest.hba1c) {
      const { status } = getBiomarkerStatus("hba1c", latest.hba1c.value, normalRanges);
      if (status !== "Normal") recs.push({
        icon: "🔬", title: "Blood Sugar Monitoring",
        detail: "HbA1c slightly elevated • Monitor carb intake",
        color: "#264653"
      });
    }
    return recs;
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "appointments", label: "Appointments" },
    { id: "book", label: "Book Appointment" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>CommonCare</h1>
          <span className="user-badge patient">Patient</span>
        </div>
        <div className="header-right">
          <span className="user-name">{user?.full_name}</span>
          <button onClick={logout} className="btn-secondary">Sign Out</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="welcome-card">
          <h2>Welcome, {user?.full_name?.split(" ")[0]}!</h2>
          <p>Track your health and manage appointments.</p>
        </div>

        <nav className="dashboard-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="section-loading">Loading data...</div>
        ) : (
          <section className="dashboard-content">
            {/* ── OVERVIEW TAB ── */}
            {activeTab === "overview" && (
              <div className="tab-panel">
                {/* Two-column layout: Medical History + Recommended Treatments */}
                <div className="overview-top-grid">
                  <div className="overview-left">
                    <MedicalHistory patientId={user.id} userType="patient" />
                  </div>
                  <div className="overview-right">
                    <div className="recommendations-card">
                      <h3 className="section-title">Recommended Treatment</h3>
                      <p className="recommendations-subtitle">Based on your current health</p>
                      {getRecommendations().length > 0 ? (
                        <div className="recommendations-list">
                          {getRecommendations().map((rec, i) => (
                            <div key={i} className="recommendation-item">
                              <div className="recommendation-icon" style={{ background: rec.color + '20', color: rec.color }}>
                                {rec.icon}
                              </div>
                              <div className="recommendation-content">
                                <div className="recommendation-title">{rec.title}</div>
                                <div className="recommendation-detail">{rec.detail}</div>
                              </div>
                              <button className="recommendation-action">View</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: '1rem' }}>
                          <p>All biomarkers within normal range! 🎉</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Biomarker Cards Grid */}
                <div className="biomarker-section-header">
                  <h3 className="section-title">Your Biomarkers</h3>
                </div>
                {biomarkers && Object.keys(biomarkers.latest).length > 0 ? (
                  <>
                    <div className="biomarker-grid-v2">
                      {Object.entries(biomarkers.latest).map(([type, data]) => {
                        const { status, className: statusClass } = getBiomarkerStatus(type, data.value, normalRanges);
                        const trendValues = getMiniTrend(biomarkers.history, type);
                        const meta = BIOMARKER_META[type] || {};
                        return (
                          <div
                            key={type}
                            className="biomarker-card-v2"
                            onClick={() => setHistoryModal(type)}
                          >
                            <div className="bm-card-icon" style={{ color: meta.color || '#64748b' }}>
                              {meta.icon || '📊'}
                            </div>
                            <div className="bm-card-body">
                              <div className="bm-card-label">{formatBiomarkerName(type)}</div>
                              <div className="bm-card-value-row">
                                <span className="bm-card-value">{data.value}</span>
                                <span className="bm-card-unit">{data.unit}</span>
                              </div>
                              <div className="bm-card-bottom">
                                <span className={`bm-status-badge ${statusClass}`}>{status}</span>
                                <MiniSparkline values={trendValues} status={statusClass} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Charts Section */}
                    <div className="charts-section">
                      <h3 className="section-title">Health Trends</h3>
                      <div className="charts-grid">
                        {Object.entries(biomarkers.history).map(([type, history]) => (
                          <BiomarkerChart
                            key={type}
                            data={history}
                            type={type}
                            unit={history[0]?.unit || ""}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <p>No biomarker data yet. Complete an appointment to see your health readings.</p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="quick-actions-section">
                  <h3 className="section-title">Quick Actions</h3>
                  <div className="quick-actions-grid">
                    <button className="quick-action-card" onClick={() => setActiveTab("book")}>
                      <span className="qa-icon">📅</span>
                      <span className="qa-label">Book Appointment</span>
                    </button>
                    <button className="quick-action-card" onClick={() => setActiveTab("appointments")}>
                      <span className="qa-icon">📋</span>
                      <span className="qa-label">View Appointments</span>
                    </button>
                    <button className="quick-action-card" onClick={() => setActiveTab("account")}>
                      <span className="qa-icon">👤</span>
                      <span className="qa-label">Account Settings</span>
                    </button>
                  </div>
                </div>

                {pendingAppointments.length > 0 && (
                  <>
                    <h3 className="section-title" style={{ marginTop: "2rem" }}>Upcoming Appointments</h3>
                    <div className="appointment-list">
                      {pendingAppointments.map((appt) => (
                        <div key={appt.id} className="appointment-item pending">
                          <div className="appointment-info">
                            <span className="appointment-date">
                              {new Date(appt.appointment_date).toLocaleDateString()}
                            </span>
                            <span className="appointment-doctor">with {appt.doctor_name}</span>
                          </div>
                          <span className={`appointment-status status-${appt.status}`}>{appt.status}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── APPOINTMENTS TAB ── */}
            {activeTab === "appointments" && (
              <div className="tab-panel">
                {pendingAppointments.length > 0 && (
                  <>
                    <h3 className="section-title">Upcoming Appointments</h3>
                    <div className="appointment-list">
                      {pendingAppointments.map((appt) => (
                        <div key={appt.id} className="appointment-item pending">
                          <div className="appointment-info">
                            <span className="appointment-date">
                              {new Date(appt.appointment_date).toLocaleDateString()}
                            </span>
                            <span className="appointment-doctor">with {appt.doctor_name}</span>
                          </div>
                          <div className="appointment-details">
                            <span className="appointment-reason">{appt.reason}</span>
                            <span className={`appointment-status status-${appt.status}`}>{appt.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <h3
                  className="section-title"
                  style={pendingAppointments.length > 0 ? { marginTop: "2rem" } : {}}
                >
                  Past Appointments
                </h3>
                {pastAppointments.length > 0 ? (
                  <div className="appointment-list">
                    {pastAppointments.map((appt) => (
                      <div key={appt.id} className="appointment-item">
                        <div className="appointment-info">
                          <span className="appointment-date">
                            {new Date(appt.appointment_date).toLocaleDateString()}
                          </span>
                          <span className="appointment-doctor">with {appt.doctor_name}</span>
                        </div>
                        <div className="appointment-details">
                          <span className="appointment-reason">{appt.reason}</span>
                          <span className={`appointment-status status-${appt.status}`}>{appt.status}</span>
                        </div>
                        {appt.biomarker_readings?.length > 0 && (
                          <div className="appointment-readings">
                            {appt.biomarker_readings.map((r) => (
                              <span key={r.id} className="reading-chip">
                                {formatBiomarkerName(r.biomarker_type)}: {r.value} {r.unit}
                              </span>
                            ))}
                          </div>
                        )}
                        {appt.notes && <div className="appointment-notes">{appt.notes}</div>}
                        {appt.treatments && (
                          <div className="appointment-treatments">
                            <span className="treatments-label">Recommended Treatments:</span> {appt.treatments}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>No past appointments.</p></div>
                )}
              </div>
            )}

            {/* ── BOOK APPOINTMENT TAB ── */}
            {activeTab === "book" && (
              <div className="tab-panel">
                <h3 className="section-title">Book a New Appointment</h3>
                <form className="booking-form" onSubmit={handleBookAppointment}>
                  <div className="form-group">
                    <label>Doctor</label>
                    <select value={bookingDoctor} onChange={(e) => setBookingDoctor(e.target.value)} required>
                      <option value="">Select a doctor...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Appointment Date & Time</label>
                    <input type="datetime-local" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Reason for Visit</label>
                    <input type="text" placeholder="e.g. Routine checkup, Follow-up..." value={bookingReason} onChange={(e) => setBookingReason(e.target.value)} />
                  </div>
                  <button type="submit" className="auth-button" disabled={bookingSubmitting}>
                    {bookingSubmitting ? "Booking..." : "Book Appointment"}
                  </button>
                </form>
              </div>
            )}

            {/* ── ACCOUNT TAB ── */}
            {activeTab === "account" && (
              <div className="tab-panel">
                <div className="account-section">
                  <h3>Account Settings</h3>
                  {!editingProfile ? (
                    <>
                      <div className="account-info">
                        <div className="info-row"><span className="info-label">Name</span><span className="info-value">{user?.full_name}</span></div>
                        <div className="info-row"><span className="info-label">Email</span><span className="info-value">{user?.email}</span></div>
                        <div className="info-row"><span className="info-label">Location</span><span className="info-value">{user?.location}</span></div>
                        <div className="info-row"><span className="info-label">Address</span><span className="info-value">{user?.address || "Not provided"}</span></div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn-secondary" onClick={startEditProfile}>Edit Profile</button>
                        <button onClick={() => setShowDeleteModal(true)} className="btn-danger">Delete Account</button>
                      </div>
                    </>
                  ) : (
                    <form onSubmit={handleSaveProfile}>
                      <div className="form-group"><label>Name</label><input type="text" value={profileForm.full_name} onChange={e => setProfileForm(p => ({ ...p, full_name: e.target.value }))} required /></div>
                      <div className="form-group"><label>Location</label><input type="text" value={profileForm.location} onChange={e => setProfileForm(p => ({ ...p, location: e.target.value }))} /></div>
                      <div className="form-group"><label>Address</label><input type="text" value={profileForm.address} onChange={e => setProfileForm(p => ({ ...p, address: e.target.value }))} /></div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button type="submit" className="auth-button" style={{ width: 'auto', padding: '0.6rem 1.5rem' }} disabled={profileSaving}>
                          {profileSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* ── BIOMARKER HISTORY MODAL ── */}
      {historyModal && biomarkers?.history?.[historyModal] && (
        <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{formatBiomarkerName(historyModal)} History</h3>
              <button className="modal-close" onClick={() => setHistoryModal(null)}>✕</button>
            </div>
            <div className="mb-6">
              <BiomarkerChart
                data={biomarkers.history[historyModal]}
                type={historyModal}
                unit={biomarkers.history[historyModal][0]?.unit || ""}
              />
            </div>
            <table className="history-table">
              <thead>
                <tr><th>Date</th><th>Value</th><th>Status</th><th>Doctor</th></tr>
              </thead>
              <tbody>
                {biomarkers.history[historyModal].slice().reverse().map((entry, i) => {
                  const { status, className: statusClass } = getBiomarkerStatus(historyModal, entry.value, normalRanges);
                  return (
                    <tr key={i}>
                      <td>{new Date(entry.date).toLocaleDateString()}</td>
                      <td><strong>{entry.value}</strong> {entry.unit}</td>
                      <td><span className={`bm-status-badge ${statusClass}`}>{status}</span></td>
                      <td>{entry.doctor_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DELETE ACCOUNT MODAL ── */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Delete Account?</h3>
            <p>This action cannot be undone. All your data will be permanently deleted.</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleDelete} className="btn-danger" disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
      <MessagingWidget />
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}
    </div>
  );
}
