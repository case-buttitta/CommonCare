import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import MedicalHistory from './components/MedicalHistory';

export default function StaffDashboard() {
    const { user, token, logout, deleteAccount } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeView, setActiveView] = useState('patients'); // patients | appointments | account

    // Data states
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientBiomarkers, setPatientBiomarkers] = useState(null);
    const [patientAppointments, setPatientAppointments] = useState([]);
    const [allAppointments, setAllAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [loading, setLoading] = useState(true);

    // Appointment form
    const [formSystolic, setFormSystolic] = useState('');
    const [formDiastolic, setFormDiastolic] = useState('');
    const [formNotes, setFormNotes] = useState('');
    const [formSubmitting, setFormSubmitting] = useState(false);

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };


    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [pRes, aRes] = await Promise.all([
                fetch('/api/patients', { headers }),
                fetch('/api/appointments', { headers }),
            ]);
            if (pRes.ok) setPatients(await pRes.json());
            if (aRes.ok) setAllAppointments(await aRes.json());
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const selectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSelectedAppointment(null);
        try {
            const [bioRes, apptRes] = await Promise.all([
                fetch(`/api/patients/${patient.id}/biomarkers`, { headers }),
                fetch(`/api/appointments?patient_id=${patient.id}`, { headers }),
            ]);
            if (bioRes.ok) setPatientBiomarkers(await bioRes.json());
            if (apptRes.ok) setPatientAppointments(await apptRes.json());
        } catch (err) {
            console.error('Failed to fetch patient data:', err);
        }
    };

    const openAppointmentForm = (appt) => {
        setSelectedAppointment(appt);
        setFormSystolic('');
        setFormDiastolic('');
        setFormNotes(appt.notes || '');
    };

    const handleSubmitAppointment = async (e) => {
        e.preventDefault();
        if (!selectedAppointment) return;
        setFormSubmitting(true);

        try {
            const res = await fetch(`/api/appointments/${selectedAppointment.id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    status: 'completed',
                    notes: formNotes,
                    biomarker_readings: [
                        { biomarker_type: 'blood_pressure_systolic', value: parseFloat(formSystolic), unit: 'mmHg' },
                        { biomarker_type: 'blood_pressure_diastolic', value: parseFloat(formDiastolic), unit: 'mmHg' },
                    ],
                }),
            });

            if (res.ok) {
                setSelectedAppointment(null);
                fetchInitialData();
                if (selectedPatient) selectPatient(selectedPatient);
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to submit');
            }
        } catch {
            alert('Failed to submit appointment');
        } finally {
            setFormSubmitting(false);
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

    const pendingAppointments = allAppointments.filter(a => a.status === 'pending');
    const completedAppointments = allAppointments.filter(a => a.status === 'completed');

    const navItems = [
        { id: 'patients', label: 'Patients' },
        { id: 'appointments', label: 'Appointments' },
        { id: 'account', label: 'Account' },
    ];

    return (
        <div className="dashboard staff-dashboard">
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>CommonCare</h1>
                    <span className="user-badge staff">Staff</span>
                </div>
                <div className="header-right">
                    <span className="user-name">{user?.full_name}</span>
                    <button onClick={logout} className="btn-secondary">Sign Out</button>
                </div>
            </header>

            <main className="dashboard-main">
                <div className="welcome-card">
                    <h2>Welcome, {user?.full_name?.split(' ')[0]} {user?.full_name?.split(' ')[2]}!</h2>
                    <p>Manage patients and appointments.</p>
                </div>

                <nav className="dashboard-tabs">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`tab-button ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => { setActiveView(item.id); setSelectedPatient(null); setSelectedAppointment(null); }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {loading ? (
                    <div className="section-loading">Loading data...</div>
                ) : (
                    <section className="dashboard-content">
                        {/* ── PATIENTS VIEW ── */}
                        {activeView === 'patients' && (
                            <div className="tab-panel">
                                <div className="staff-layout">
                                    <div className="patient-list-panel">
                                        <h3 className="section-title">Patients ({patients.length})</h3>
                                        <div className="patient-list">
                                            {patients.map(p => (
                                                <div
                                                    key={p.id}
                                                    className={`patient-item ${selectedPatient?.id === p.id ? 'active' : ''}`}
                                                    onClick={() => selectPatient(p)}
                                                >
                                                    <div className="patient-name">{p.full_name}</div>
                                                    <div className="patient-email">{p.email}</div>
                                                </div>
                                            ))}
                                            {patients.length === 0 && (
                                                <div className="empty-state"><p>No patients registered yet.</p></div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="patient-detail-panel">
                                        {selectedPatient ? (
                                            <>
                                                <h3 className="section-title">{selectedPatient.full_name}</h3>
                                                <div className="patient-meta">
                                                    <span>{selectedPatient.email}</span>
                                                    <span>{selectedPatient.location}</span>
                                                </div>

                                                {/* Medical History */}
                                                <div className="mb-6">
                                                    <MedicalHistory patientId={selectedPatient.id} userType="staff" />
                                                </div>

                                                {/* Biomarkers */}
                                                <h4 className="subsection-title">Biomarkers</h4>
                                                {patientBiomarkers && Object.keys(patientBiomarkers.latest).length > 0 ? (
                                                    <div className="biomarker-grid">
                                                        {Object.entries(patientBiomarkers.latest).map(([type, data]) => {
                                                            const prev = patientBiomarkers.previous?.[type];
                                                            const trend = prev ? data.value - prev.value : null;
                                                            return (
                                                                <div key={type} className="biomarker-card">
                                                                    <div className="biomarker-card-header">
                                                                        <span className="biomarker-label">{formatBiomarkerName(type)}</span>
                                                                    </div>
                                                                    <div className="biomarker-value">
                                                                        {data.value} <span className="biomarker-unit">{data.unit}</span>
                                                                    </div>
                                                                    {trend !== null && (
                                                                        <div className={`biomarker-trend ${trend < 0 ? 'improving' : trend > 0 ? 'worsening' : 'stable'}`}>
                                                                            {trend < 0 ? '↓' : trend > 0 ? '↑' : '→'} {Math.abs(trend).toFixed(1)} from previous
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="empty-state"><p>No biomarker data available.</p></div>
                                                )}

                                                {/* Patient Appointment History */}
                                                <h4 className="subsection-title" style={{ marginTop: '1.5rem' }}>Appointment History</h4>
                                                {patientAppointments.length > 0 ? (
                                                    <div className="appointment-list">
                                                        {patientAppointments.map(appt => (
                                                            <div key={appt.id} className={`appointment-item ${appt.status === 'pending' ? 'pending' : ''}`}>
                                                                <div className="appointment-info">
                                                                    <span className="appointment-date">{new Date(appt.appointment_date).toLocaleDateString()}</span>
                                                                    <span className="appointment-reason">{appt.reason}</span>
                                                                </div>
                                                                <div className="appointment-details">
                                                                    <span className={`appointment-status status-${appt.status}`}>{appt.status}</span>
                                                                    {appt.status === 'pending' && (
                                                                        <button
                                                                            className="btn-fill-out"
                                                                            onClick={() => openAppointmentForm(appt)}
                                                                        >
                                                                            Fill Out
                                                                        </button>
                                                                    )}
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
                                                    <div className="empty-state"><p>No appointments for this patient.</p></div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="empty-state detail-placeholder">
                                                <p>Select a patient from the list to view their details.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── APPOINTMENTS VIEW ── */}
                        {activeView === 'appointments' && (
                            <div className="tab-panel">
                                <h3 className="section-title">Upcoming Appointments ({pendingAppointments.length})</h3>
                                {pendingAppointments.length > 0 ? (
                                    <div className="appointment-list">
                                        {pendingAppointments.map(appt => (
                                            <div key={appt.id} className="appointment-item pending">
                                                <div className="appointment-info">
                                                    <span className="appointment-date">{new Date(appt.appointment_date).toLocaleDateString()}</span>
                                                    <span className="appointment-doctor">{appt.patient_name}</span>
                                                </div>
                                                <div className="appointment-details">
                                                    <span className="appointment-reason">{appt.reason}</span>
                                                    <button
                                                        className="btn-fill-out"
                                                        onClick={() => openAppointmentForm(appt)}
                                                    >
                                                        Fill Out
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state"><p>No upcoming appointments.</p></div>
                                )}

                                <h3 className="section-title" style={{ marginTop: '2rem' }}>Completed ({completedAppointments.length})</h3>
                                {completedAppointments.length > 0 ? (
                                    <div className="appointment-list">
                                        {completedAppointments.map(appt => (
                                            <div key={appt.id} className="appointment-item">
                                                <div className="appointment-info">
                                                    <span className="appointment-date">{new Date(appt.appointment_date).toLocaleDateString()}</span>
                                                    <span className="appointment-doctor">{appt.patient_name}</span>
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
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state"><p>No completed appointments.</p></div>
                                )}
                            </div>
                        )}

                        {/* ── ACCOUNT VIEW ── */}
                        {activeView === 'account' && (
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

            {/* ── APPOINTMENT FILL-OUT MODAL ── */}
            {selectedAppointment && (
                <div className="modal-overlay" onClick={() => setSelectedAppointment(null)}>
                    <div className="modal appointment-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Complete Appointment</h3>
                            <button className="modal-close" onClick={() => setSelectedAppointment(null)}>✕</button>
                        </div>
                        <div className="appointment-modal-meta">
                            <span><strong>Patient:</strong> {selectedAppointment.patient_name}</span>
                            <span><strong>Date:</strong> {new Date(selectedAppointment.appointment_date).toLocaleDateString()}</span>
                            <span><strong>Reason:</strong> {selectedAppointment.reason}</span>
                        </div>
                        <form className="appointment-form" onSubmit={handleSubmitAppointment}>
                            <h4>Blood Pressure Reading</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Systolic (mmHg)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 120"
                                        value={formSystolic}
                                        onChange={e => setFormSystolic(e.target.value)}
                                        required
                                        min="60"
                                        max="250"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Diastolic (mmHg)</label>
                                    <input
                                        type="number"
                                        placeholder="e.g. 80"
                                        value={formDiastolic}
                                        onChange={e => setFormDiastolic(e.target.value)}
                                        required
                                        min="40"
                                        max="150"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea
                                    rows="3"
                                    placeholder="Appointment notes..."
                                    value={formNotes}
                                    onChange={e => setFormNotes(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="auth-button" disabled={formSubmitting}>
                                {formSubmitting ? 'Submitting...' : 'Complete Appointment'}
                            </button>
                        </form>
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
