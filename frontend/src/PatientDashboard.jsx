import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import MedicalHistory from './components/MedicalHistory';
import BiomarkerChart from './components/BiomarkerChart';

export default function PatientDashboard() {
    const { user, token, logout, deleteAccount } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Data states
    const [biomarkers, setBiomarkers] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);

    // Booking form
    const [bookingDoctor, setBookingDoctor] = useState('');
    const [bookingDate, setBookingDate] = useState('');
    const [bookingReason, setBookingReason] = useState('');
    const [bookingSubmitting, setBookingSubmitting] = useState(false);

    // History modal
    const [historyModal, setHistoryModal] = useState(null); // biomarker_type string or null

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [bioRes, apptRes, staffRes] = await Promise.all([
                fetch(`/api/patients/${user.id}/biomarkers`, { headers }),
                fetch('/api/appointments', { headers }),
                fetch('/api/staff', { headers }),
            ]);
            if (bioRes.ok) setBiomarkers(await bioRes.json());
            if (apptRes.ok) setAppointments(await apptRes.json());
            if (staffRes.ok) setStaffList(await staffRes.json());
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleBookAppointment = async (e) => {
        e.preventDefault();
        setBookingSubmitting(true);
        try {
            const res = await fetch('/api/appointments', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    doctor_id: parseInt(bookingDoctor),
                    appointment_date: bookingDate,
                    reason: bookingReason,
                }),
            });
            if (res.ok) {
                setBookingDoctor('');
                setBookingDate('');
                setBookingReason('');
                fetchData();
                setActiveTab('appointments');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to book appointment');
            }
        } catch {
            alert('Failed to book appointment');
        } finally {
            setBookingSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteAccount();
        } catch (err) {
            alert(err.message);
            setDeleting(false);
        }
    };

    const formatBiomarkerName = (type) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const pendingAppointments = appointments.filter(a => a.status === 'pending');
    const pastAppointments = appointments.filter(a => a.status !== 'pending');

    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'appointments', label: 'Appointments' },
        { id: 'book', label: 'Book Appointment' },
        { id: 'account', label: 'Account' },
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
                    <h2>Welcome, {user?.full_name?.split(' ')[0]}!</h2>
                    <p>Track your health and manage appointments.</p>
                </div>

                <nav className="dashboard-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
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
                        {activeTab === 'overview' && (
                            <div className="tab-panel">
                                <MedicalHistory patientId={user.id} userType="patient" />

                                <h3 className="section-title">Your Biomarkers</h3>
                                {biomarkers && Object.keys(biomarkers.latest).length > 0 ? (
                                    <>
                                        <div className="biomarker-grid">
                                            {Object.entries(biomarkers.latest).map(([type, data]) => {
                                                const prev = biomarkers.previous?.[type];
                                                const trend = prev ? data.value - prev.value : null;
                                                return (
                                                    <div
                                                        key={type}
                                                        className="biomarker-card"
                                                        onClick={() => setHistoryModal(type)}
                                                    >
                                                        <div className="biomarker-card-header">
                                                            <span className="biomarker-label">{formatBiomarkerName(type)}</span>
                                                            <span className="biomarker-inspect">View Details →</span>
                                                        </div>
                                                        <div className="biomarker-value">
                                                            {data.value} <span className="biomarker-unit">{data.unit}</span>
                                                        </div>
                                                        {trend !== null && (
                                                            <div className={`biomarker-trend ${trend < 0 ? 'improving' : trend > 0 ? 'worsening' : 'stable'}`}>
                                                                {trend < 0 ? '↓' : trend > 0 ? '↑' : '→'} {Math.abs(trend).toFixed(1)} from previous
                                                            </div>
                                                        )}
                                                        <div className="biomarker-date">Last checked: {new Date(data.date).toLocaleDateString()}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Charts Section */}
                                        <div className="mt-8">
                                            <h3 className="section-title">Health Trends</h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {Object.entries(biomarkers.history).map(([type, history]) => (
                                                    <BiomarkerChart
                                                        key={type}
                                                        data={history}
                                                        type={type}
                                                        unit={history[0]?.unit || ''}
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

                                {pendingAppointments.length > 0 && (
                                    <>
                                        <h3 className="section-title" style={{ marginTop: '2rem' }}>Upcoming Appointments</h3>
                                        <div className="appointment-list">
                                            {pendingAppointments.map(appt => (
                                                <div key={appt.id} className="appointment-item pending">
                                                    <div className="appointment-info">
                                                        <span className="appointment-date">{new Date(appt.appointment_date).toLocaleDateString()}</span>
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
                        {activeTab === 'appointments' && (
                            <div className="tab-panel">
                                {pendingAppointments.length > 0 && (
                                    <>
                                        <h3 className="section-title">Upcoming Appointments</h3>
                                        <div className="appointment-list">
                                            {pendingAppointments.map(appt => (
                                                <div key={appt.id} className="appointment-item pending">
                                                    <div className="appointment-info">
                                                        <span className="appointment-date">{new Date(appt.appointment_date).toLocaleDateString()}</span>
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

                                <h3 className="section-title" style={pendingAppointments.length > 0 ? { marginTop: '2rem' } : {}}>
                                    Past Appointments
                                </h3>
                                {pastAppointments.length > 0 ? (
                                    <div className="appointment-list">
                                        {pastAppointments.map(appt => (
                                            <div key={appt.id} className="appointment-item">
                                                <div className="appointment-info">
                                                    <span className="appointment-date">{new Date(appt.appointment_date).toLocaleDateString()}</span>
                                                    <span className="appointment-doctor">with {appt.doctor_name}</span>
                                                </div>
                                                <div className="appointment-details">
                                                    <span className="appointment-reason">{appt.reason}</span>
                                                    <span className={`appointment-status status-${appt.status}`}>{appt.status}</span>
                                                </div>
                                                {appt.biomarker_readings?.length > 0 && (
                                                    <div className="appointment-readings">
                                                        {appt.biomarker_readings.map(r => (
                                                            <span key={r.id} className="reading-chip">
                                                                {formatBiomarkerName(r.biomarker_type)}: {r.value} {r.unit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {appt.notes && <div className="appointment-notes">{appt.notes}</div>}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state"><p>No past appointments.</p></div>
                                )}
                            </div>
                        )}

                        {/* ── BOOK APPOINTMENT TAB ── */}
                        {activeTab === 'book' && (
                            <div className="tab-panel">
                                <h3 className="section-title">Book a New Appointment</h3>
                                <form className="booking-form" onSubmit={handleBookAppointment}>
                                    <div className="form-group">
                                        <label>Doctor</label>
                                        <select
                                            value={bookingDoctor}
                                            onChange={e => setBookingDoctor(e.target.value)}
                                            required
                                        >
                                            <option value="">Select a doctor...</option>
                                            {staffList.map(s => (
                                                <option key={s.id} value={s.id}>{s.full_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Appointment Date & Time</label>
                                        <input
                                            type="datetime-local"
                                            value={bookingDate}
                                            onChange={e => setBookingDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Reason for Visit</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Routine checkup, Follow-up..."
                                            value={bookingReason}
                                            onChange={e => setBookingReason(e.target.value)}
                                        />
                                    </div>
                                    <button type="submit" className="auth-button" disabled={bookingSubmitting}>
                                        {bookingSubmitting ? 'Booking...' : 'Book Appointment'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* ── ACCOUNT TAB ── */}
                        {activeTab === 'account' && (
                            <div className="tab-panel">
                                <div className="account-section">
                                    <h3>Account Settings</h3>
                                    <div className="account-info">
                                        <div className="info-row">
                                            <span className="info-label">Email</span>
                                            <span className="info-value">{user?.email}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Location</span>
                                            <span className="info-value">{user?.location}</span>
                                        </div>
                                        <div className="info-row">
                                            <span className="info-label">Address</span>
                                            <span className="info-value">{user?.address || 'Not provided'}</span>
                                        </div>
                                    </div>
                                    <button onClick={() => setShowDeleteModal(true)} className="btn-danger">
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* ── BIOMARKER HISTORY MODAL ── */}
            {historyModal && biomarkers?.history?.[historyModal] && (
                <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
                    <div className="modal history-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{formatBiomarkerName(historyModal)} History</h3>
                            <button className="modal-close" onClick={() => setHistoryModal(null)}>✕</button>
                        </div>

                        <div className="mb-6">
                            <BiomarkerChart
                                data={biomarkers.history[historyModal]}
                                type={historyModal}
                                unit={biomarkers.history[historyModal][0]?.unit || ''}
                            />
                        </div>
                        <table className="history-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Value</th>
                                    <th>Doctor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {biomarkers.history[historyModal].slice().reverse().map((entry, i) => (
                                    <tr key={i}>
                                        <td>{new Date(entry.date).toLocaleDateString()}</td>
                                        <td><strong>{entry.value}</strong> {entry.unit}</td>
                                        <td>{entry.doctor_name}</td>
                                    </tr>
                                ))}
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
                                {deleting ? 'Deleting...' : 'Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
