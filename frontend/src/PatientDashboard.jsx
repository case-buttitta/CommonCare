import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { api } from "./api";
import MedicalHistory from "./components/MedicalHistory";
import BiomarkerChart from "./components/BiomarkerChart";
import MessagingWidget from "./components/MessagingWidget";

import { BIOMARKER_META, getBiomarkerStatus, NormalDistCurve, IconActivity, IconHeart, IconSun, IconDroplet, IconScale, IconFlask, IconCandy } from './utils/biomarkerData';

const IconCalendar = ({ color = "currentColor", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconClipboard = ({ color = "currentColor", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);
const IconUser = ({ color = "currentColor", size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

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
  const [treatmentModal, setTreatmentModal] = useState(null);

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

  // Build recommendation items from latest biomarkers vs normal ranges
  const getRecommendations = () => {
    if (!biomarkers?.latest || normalRanges.length === 0) return [];
    const recs = [];
    const latest = biomarkers.latest;

    const checks = [
      { key: "blood_pressure_systolic", title: "Reduce Blood Pressure",  detail: "Continue medication + 30 min exercise, 5x/week", IconComponent: IconHeart, color: "#e63946" },
      { key: "vitamin_d",              title: "Vitamin D Deficiency",    detail: "Take 2000 IU daily + Repeat test in 3 months",   IconComponent: IconSun,     color: "#e9c46a" },
      { key: "cholesterol_total",      title: "High Cholesterol",        detail: "Diet: Low fat, high fiber + Recheck in 2 months", IconComponent: IconDroplet, color: "#e76f51" },
      { key: "bmi",                    title: "Weight Management",       detail: "Target BMI < 25 + Diet and exercise plan",        IconComponent: IconScale,   color: "#2a9d8f" },
      { key: "hba1c",                  title: "Blood Sugar Monitoring",  detail: "HbA1c elevated + Monitor carb intake",            IconComponent: IconFlask,   color: "#264653" },
      { key: "blood_sugar",            title: "Blood Glucose Elevated",  detail: "Monitor fasting glucose + Dietary adjustments",   IconComponent: IconCandy,   color: "#f4a261" },
    ];

    for (const chk of checks) {
      if (latest[chk.key]) {
        const { status } = getBiomarkerStatus(chk.key, latest[chk.key].value, normalRanges);
        if (status !== "Normal") {
          recs.push(chk);
        }
      }
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
                {/* Two-column: Medical History + Recommendations */}
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
                          {getRecommendations().map((rec, i) => {
                            const RecIcon = rec.IconComponent;
                            const history = biomarkers.history?.[rec.key];
                            const latestEntry = history?.[history.length - 1];

                            const modalData = {
                              title: rec.title,
                              biomarker: formatBiomarkerName(rec.key),
                              doctor: latestEntry?.doctor_name || "Not Applicable",
                              date: latestEntry ? new Date(latestEntry.date).toLocaleDateString() : "Not Applicable",
                              note: rec.detail,
                              IconComponent: rec.IconComponent,
                              color: rec.color
                            };

                            return (
                              <div key={i} className="recommendation-item"
                              onClick={() => setTreatmentModal(modalData)}
                              >
                                <div className="recommendation-icon" style={{ background: rec.color + '20', color: rec.color }}>
                                  <RecIcon color={rec.color} size={18} />
                                </div>
                                <div className="recommendation-content">
                                  <div className="recommendation-title">{rec.title}</div>
                                  <div className="recommendation-detail">{rec.detail}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="empty-state" style={{ padding: '1rem' }}>
                          <p>All biomarkers within normal range!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Biomarker Cards Grid with Bell Curves */}
                <div className="biomarker-section-header">
                  <h3 className="section-title">Your Biomarkers</h3>
                </div>
                {biomarkers && Object.keys(biomarkers.latest).length > 0 ? (
                  <div className="biomarker-grid-v2">
                    {Object.entries(biomarkers.latest).map(([type, data]) => {
                      const { status, className: statusClass } = getBiomarkerStatus(type, data.value, normalRanges);
                      const meta = BIOMARKER_META[type] || {};
                      const BmIcon = meta.IconComponent || IconActivity;
                      const normalRange = normalRanges.find((r) => r.biomarker_type === type);
                      return (
                        <div
                          key={type}
                          className="biomarker-card-v2"
                          onClick={() => setHistoryModal(type)}
                        >
                          <div className="bm-card-top">
                            <div className="bm-card-icon" style={{ color: meta.color || '#64748b' }}>
                              <BmIcon color={meta.color || '#64748b'} size={18} />
                            </div>
                            <span className={`bm-status-badge ${statusClass}`}>{status}</span>
                          </div>
                          <div className="bm-card-label">{formatBiomarkerName(type)}</div>
                          <div className="bm-card-value-row">
                            <span className="bm-card-value">{data.value}</span>
                            <span className="bm-card-unit">{data.unit}</span>
                          </div>
                          <div className="bm-card-curve">
                            <NormalDistCurve value={data.value} normalRange={normalRange} statusClass={statusClass} type={type} />
                          </div>
                          <button
                            className="btn-secondary"
                            style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem 0', fontSize: '0.8rem' }}
                            onClick={e => { e.stopPropagation(); setHistoryModal(type); }}
                          >
                            Details
                          </button>
                        </div>
                      );
                    })}
                  </div>
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
                      <span className="qa-icon"><IconCalendar color="#780606" size={22} /></span>
                      <span className="qa-label">Book Appointment</span>
                    </button>
                    <button className="quick-action-card" onClick={() => setActiveTab("appointments")}>
                      <span className="qa-icon"><IconClipboard color="#780606" size={22} /></span>
                      <span className="qa-label">View Appointments</span>
                    </button>
                    <button className="quick-action-card" onClick={() => setActiveTab("account")}>
                      <span className="qa-icon"><IconUser color="#780606" size={22} /></span>
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

      {/* ── BIOMARKER HISTORY MODAL (Line Chart) ── */}
      {historyModal && biomarkers?.history?.[historyModal] && (
        <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{formatBiomarkerName(historyModal)} History</h3>
              <button className="modal-close" onClick={() => setHistoryModal(null)}>✕</button>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
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

      {/* ── TREATMENT MODAL ── */}
{treatmentModal && (
  <div className="modal-overlay" onClick={() => setTreatmentModal(null)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      
      {/* ── Modal Header ── */}
      <div className="modal-header">
        <h3>{treatmentModal.title}</h3>
        <button className="modal-close" onClick={() => setTreatmentModal(null)}>✕</button>
      </div>

      {/* ── Modal Body ── */}
      <div
        className="modal-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}
      >
        {/* Icon with circular background */}
        {treatmentModal.IconComponent && (
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: treatmentModal.color + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
            }}
          >
            <treatmentModal.IconComponent color={treatmentModal.color} size={32} />
          </div>
        )}

        {/* Text Details */}
        <div style={{ flex: 1 }}>
          <p><strong>Biomarker:</strong> {treatmentModal.biomarker}</p>
          <p><strong>Current Doctor:</strong> {treatmentModal.doctor}</p>
          <p><strong>Latest Appointment:</strong> {treatmentModal.date}</p>
          <p><strong>Note:</strong> {treatmentModal.note}</p>
        </div>
          <div className="modal-warning" 
          style={{fontSize: '0.6rem'}}>
            ⚠️ Please Consult with your doctor before starting new medications or making major lifestyle changes.
          </div>
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
