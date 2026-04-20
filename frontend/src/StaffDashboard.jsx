import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';
import { loadAndApplyTheme } from './utils/theme';
import MedicalHistory from './components/MedicalHistory';
import BiomarkerChart from './components/BiomarkerChart';
import NormalRanges from "./components/NormalRanges";
import MessagingWidget from './components/MessagingWidget';

import { BIOMARKER_META, getBiomarkerStatus, NormalDistCurve, IconActivity } from './utils/biomarkerData';
import { IconHeart, IconSun, IconDroplet, IconScale, IconFlask, IconCandy } from './utils/biomarkerData';

export default function StaffDashboard() {
    const { user, token, logout, deleteAccount, updateUser } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [activeView, setActiveView] = useState('patients');

    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientBiomarkers, setPatientBiomarkers] = useState(null);
    const [patientAppointments, setPatientAppointments] = useState([]);
    const [historyModal, setHistoryModal] = useState(null);
    const [allAppointments, setAllAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRecommendations, setShowRecommendations] = useState(false);

    const [formBiomarkers, setFormBiomarkers] = useState([]);
    const [formNotes, setFormNotes] = useState('');
    const [formTreatments, setFormTreatments] = useState('');
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [normalRanges, setNormalRanges] = useState([]);

    const [editingProfile, setEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ full_name: '', address: '', location: '' });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileToast, setProfileToast] = useState(null);

    const showProfileToast = (message, type = 'error') => {
        setProfileToast({ message, type });
        setTimeout(() => setProfileToast(null), 2000);
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
            if (res.ok) { updateUser(await res.json()); setEditingProfile(false); showProfileToast('Profile updated', 'success'); }
            else { const data = await res.json(); showProfileToast(data.error || 'Failed to update profile'); }
        } catch { showProfileToast('Failed to update profile'); }
        finally { setProfileSaving(false); }
    };

    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => { fetchInitialData(); loadAndApplyTheme(token); }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [pRes, aRes, nrRes] = await Promise.all([
                api('/api/patients', { headers }),
                api('/api/appointments', { headers }),
                api('/api/normal-ranges', { headers }),
            ]);
            if (pRes.ok) setPatients(await pRes.json());
            if (aRes.ok) setAllAppointments(await aRes.json());
            if (nrRes.ok) setNormalRanges(await nrRes.json());
        } catch (err) { console.error('Failed to fetch data:', err); }
        finally { setLoading(false); }
    };

    const selectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSelectedAppointment(null);
        try {
            const [bioRes, apptRes] = await Promise.all([
                api(`/api/patients/${patient.id}/biomarkers`, { headers }),
                api(`/api/appointments?patient_id=${patient.id}`, { headers }),
            ]);
            if (bioRes.ok) setPatientBiomarkers(await bioRes.json());
            if (apptRes.ok) setPatientAppointments(await apptRes.json());
        } catch (err) { console.error('Failed to fetch patient data:', err); }
    };

    const getUnit = (type) => normalRanges.find(r => r.biomarker_type === type)?.unit || '';

    const openAppointmentForm = (appt) => {
        setSelectedAppointment(appt);
        setFormBiomarkers([]);
        setShowBiomarkerPicker(false);
        setFormNotes(appt.notes || '');
        setFormTreatments(appt.treatments || '');
    };

    const [showBiomarkerPicker, setShowBiomarkerPicker] = useState(false);

    const removeBiomarker = (i) => {
        const type = formBiomarkers[i]?.type;
        if (type === 'blood_pressure_systolic' || type === 'blood_pressure_diastolic') {
            setFormBiomarkers(prev => prev.filter(b => b.type !== 'blood_pressure_systolic' && b.type !== 'blood_pressure_diastolic'));
        } else {
            setFormBiomarkers(prev => prev.filter((_, idx) => idx !== i));
        }
    };
    const updateBiomarker = (i, value) => setFormBiomarkers(prev => {
        const updated = [...prev]; updated[i] = { ...updated[i], value }; return updated;
    });

    const buildBiomarkerOptions = () => {
        const addedTypes = new Set(formBiomarkers.map(b => b.type));
        const options = [];
        const hasSys = normalRanges.find(r => r.biomarker_type === 'blood_pressure_systolic');
        const hasDia = normalRanges.find(r => r.biomarker_type === 'blood_pressure_diastolic');
        if (hasSys && hasDia && !addedTypes.has('blood_pressure_systolic') && !addedTypes.has('blood_pressure_diastolic')) {
            options.push({ label: 'Blood Pressure', types: ['blood_pressure_systolic', 'blood_pressure_diastolic'] });
        } else {
            if (hasSys && !addedTypes.has('blood_pressure_systolic')) options.push({ label: 'Blood Pressure Systolic', types: ['blood_pressure_systolic'] });
            if (hasDia && !addedTypes.has('blood_pressure_diastolic')) options.push({ label: 'Blood Pressure Diastolic', types: ['blood_pressure_diastolic'] });
        }
        normalRanges
            .filter(r => !r.biomarker_type.startsWith('blood_pressure') && !addedTypes.has(r.biomarker_type))
            .forEach(r => options.push({ label: formatBiomarkerName(r.biomarker_type), types: [r.biomarker_type] }));
        return options;
    };

    const addBiomarkerFromPicker = (option) => {
        const newEntries = option.types.map(type => {
            const range = normalRanges.find(r => r.biomarker_type === type);
            return { type, value: '', unit: range?.unit || '', min: range?.min_value, max: range?.max_value };
        });
        setFormBiomarkers(prev => [...prev, ...newEntries]);
        setShowBiomarkerPicker(false);
    };

    const handleSubmitAppointment = async (e) => {
        e.preventDefault();
        if (!selectedAppointment) return;
        setFormSubmitting(true);
        try {
            const res = await api(`/api/appointments/${selectedAppointment.id}`, {
                method: 'PUT', headers,
                body: JSON.stringify({
                    status: 'completed', notes: formNotes, treatments: formTreatments,
                    biomarker_readings: formBiomarkers.filter(b => b.type && b.value !== '').map(b => ({ biomarker_type: b.type, value: parseFloat(b.value), unit: b.unit })),
                }),
            });
            if (res.ok) { setSelectedAppointment(null); fetchInitialData(); if (selectedPatient) selectPatient(selectedPatient); }
            else { const data = await res.json(); alert(data.error || 'Failed to submit'); }
        } catch { alert('Failed to submit appointment'); }
        finally { setFormSubmitting(false); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try { await deleteAccount(); } catch (err) { alert(err.message); setDeleting(false); }
    };

    const formatBiomarkerName = (type) => {
        return BIOMARKER_META[type]?.label || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const getRecommendations = () => {
    if (!patientBiomarkers?.latest || normalRanges.length === 0) return [];

    const recs = [];
    const latest = patientBiomarkers.latest;

    const checks = [
        { key: "blood_pressure_systolic", title: "Reduce Blood Pressure", detail: "Continue medication + 30 min exercise, 5x/week", IconComponent: IconHeart, color: "#e63946"},
        { key: "vitamin_d", title: "Vitamin D Deficiency", detail: "Take 2000 IU daily + Repeat test in 3 months", IconComponent: IconSun, color: "#e9c46a"},
        { key: "cholesterol_total", title: "High Cholesterol", detail: "Diet: Low fat, high fiber + Recheck in 2 months", IconComponent: IconDroplet, color: "#e76f51"},
        { key: "bmi", title: "Weight Management", detail: "Target BMI < 25 + Diet and exercise plan", IconComponent: IconScale, color: "#2a9d8f"},
        { key: "hba1c", title: "Blood Sugar Monitoring", detail: "HbA1c elevated + Monitor carb intake", IconComponent: IconFlask, color: "#264653"},
        { key: "blood_sugar", title: "Blood Glucose Elevated", detail: "Monitor fasting glucose + Dietary adjustments", IconComponent: IconCandy, color: "#f4a261"},
    ];

    for (const chk of checks) {
        if (latest[chk.key]) {
            const { status } = getBiomarkerStatus(
                chk.key,
                latest[chk.key].value,
                normalRanges
            );

            if (status !== "Normal") {
                recs.push(chk);
            }
        }
    }

    return recs;
};

    const pendingAppointments = allAppointments.filter(a => a.status === 'pending');
    const completedAppointments = allAppointments.filter(a => a.status === 'completed');

    const navItems = [
        { id: 'patients', label: 'Patients' },
        { id: 'appointments', label: 'Appointments' },
        { id: 'account', label: 'Account' },
        { id: 'normal_ranges', label: 'Normal Ranges' },
    ];

    return (
        <div className="dashboard staff-dashboard">
            <header className="dashboard-header" style={{ background: 'var(--header-bg-color, var(--white))' }}>
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
                            onClick={() => { setActiveView(item.id); setSelectedPatient(null); setSelectedAppointment(null); if (item.id !== 'normal_ranges') fetchInitialData(); }}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {loading ? (
                    <div className="section-loading">Loading data...</div>
                ) : (
                    <section className="dashboard-content">
                        {/* PATIENTS VIEW */}
                        {activeView === 'patients' && (
                            <div className="tab-panel">
                                <div className="staff-layout">
                                    <div className="patient-list-panel">
                                        <h3 className="section-title">Patients ({patients.length})</h3>
                                        <h4 className="section-label">Select a patient to view dashboard</h4>
                                        <div className="patient-list">
                                            {patients.map(p => (
                                                <div key={p.id} className={`patient-item ${selectedPatient?.id === p.id ? 'active' : ''}`} onClick={() => selectPatient(p)}>
                                                    <div className="patient-name">{p.full_name}</div>
                                                    <div className="patient-email">{p.email}</div>
                                                </div>
                                            ))}
                                            {patients.length === 0 && (<div className="empty-state"><p>No patients registered yet.</p></div>)}
                                        </div>
                                    </div>

                                    <div className="patient-detail-panel">
                                        {selectedPatient ? (
                                            <>
                                                <h3 className="section-title">{selectedPatient.full_name}</h3>
                                                <div className="patient-meta">
                                                    <span className="patient-info-detail">{selectedPatient.email}</span>
                                                    <span className="patient-info-detail">{selectedPatient.location}</span>
                                                </div>

                                                <div className="mb-6">
                                                    <MedicalHistory patientId={selectedPatient.id} userType="staff" />
                                                </div>

                                        {/* ── Recommended Treatments Toggle ── */}
                                            <div className="recommendations-toggle">
                                                <div
                                                    className="recommendations-header"
                                                    onClick={() => setShowRecommendations(prev => !prev)}
                                                >
                                                    <h4>Recommended Treatments</h4>
                                                    <span>{showRecommendations ? "▲" : "▼"}</span>
                                                </div>

                                        {showRecommendations && (
                                            <div className="recommendations-body">
                                                {getRecommendations().length > 0 ? (
                                                    <div className="recommendations-list">
                                                        {getRecommendations().map((rec, i) => (
                                                            <div key={i} className="recommendation-item">
                                                                <div
                                                                    className="recommendation-icon"
                                                                    style={{ background: rec.color + "20", color: rec.color }}
                                                                >
                                                                    <rec.IconComponent color={rec.color} size={16} />
                                                                </div>
                                                                <div className="recommendation-content">
                                                                    <div className="recommendation-title">{rec.title}</div>
                                                                    <div className="recommendation-detail">{rec.detail}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        </div>
                                                    ) : (
                                                        <div className="empty-state">
                                                            <p>All biomarkers within normal range!</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                                {/* Biomarkers - v2 cards with bell curves */}
                                                <h4 className="subsection-title">Biomarkers</h4>
                                                {patientBiomarkers && Object.keys(patientBiomarkers.latest).length > 0 ? (
                                                    <div className="biomarker-grid-v2">
                                                        {Object.entries(patientBiomarkers.latest).map(([type, data]) => {
                                                            const { status, className: statusClass } = getBiomarkerStatus(type, data.value, normalRanges);
                                                            const meta = BIOMARKER_META[type] || {};
                                                            const BmIcon = meta.IconComponent || IconActivity;
                                                            const normalRange = normalRanges.find((r) => r.biomarker_type === type);
                                                            return (
                                                                <div key={type} className="biomarker-card-v2" onClick={() => setHistoryModal(type)}>
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
                                                                        style={{ width: '100%', marginTop: '0.5rem', padding: '0.3rem 0', fontSize: '0.8rem', textDecoration: 'none' }}
                                                                        onClick={e => { e.stopPropagation(); setHistoryModal(type); }}
                                                                    >
                                                                        Details
                                                                    </button>
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
                                                                        <button className="btn-fill-out" onClick={() => openAppointmentForm(appt)}>Fill Out</button>
                                                                    )}
                                                                </div>
                                                                {appt.biomarker_readings?.length > 0 && (
                                                                    <div className="appointment-readings">
                                                                        {appt.biomarker_readings.map(r => (
                                                                            <span key={r.id} className="reading-chip">{formatBiomarkerName(r.biomarker_type)}: {r.value} {r.unit}</span>
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

                        {/* APPOINTMENTS VIEW */}
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
                                                    <button className="btn-fill-out" onClick={() => openAppointmentForm(appt)}>Fill Out</button>
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
                                                            <span key={r.id} className="reading-chip">{formatBiomarkerName(r.biomarker_type)}: {r.value} {r.unit}</span>
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

                        {/* ACCOUNT VIEW */}
                        {activeView === 'account' && (
                            <div className="tab-panel">
                                <div className="account-section">
                                    <h3>Account Settings</h3>
                                    {!editingProfile ? (
                                        <>
                                            <div className="account-info">
                                                <div className="info-row"><span className="info-label">Name</span><span className="info-value">{user?.full_name}</span></div>
                                                <div className="info-row"><span className="info-label">Email</span><span className="info-value">{user?.email}</span></div>
                                                <div className="info-row"><span className="info-label">Location</span><span className="info-value">{user?.location}</span></div>
                                                <div className="info-row"><span className="info-label">Address</span><span className="info-value">{user?.address || 'Not provided'}</span></div>
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
                                                <button type="submit" className="auth-button" style={{ width: 'auto', padding: '0.6rem 1.5rem' }} disabled={profileSaving}>{profileSaving ? 'Saving...' : 'Save Changes'}</button>
                                                <button type="button" className="btn-secondary" onClick={() => setEditingProfile(false)}>Cancel</button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* NORMAL RANGES VIEW */}
                        {activeView === 'normal_ranges' && (
                            <div className="tab-panel">
                                <NormalRanges />
                            </div>
                        )}
                    </section>
                )}
            </main>

            {/* APPOINTMENT FILL-OUT MODAL */}
            {selectedAppointment && (
                <div className="modal-overlay" onClick={() => setSelectedAppointment(null)}>
                    <div className="modal appointment-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Complete Appointment</h3>
                            <button className="modal-close" onClick={() => setSelectedAppointment(null)}>&#10005;</button>
                        </div>
                        <div className="appointment-modal-meta">
                            <span><strong>Patient:</strong> {selectedAppointment.patient_name}</span>
                            <span><strong>Date:</strong> {new Date(selectedAppointment.appointment_date).toLocaleDateString()}</span>
                            <span><strong>Reason:</strong> {selectedAppointment.reason}</span>
                        </div>
                        <form className="appointment-form" onSubmit={handleSubmitAppointment}>
                            <h4>Biomarker Readings</h4>
                            {formBiomarkers.map((b, i) => {
                                const val = parseFloat(b.value);
                                const hasVal = b.value !== '' && !isNaN(val);
                                const isLow  = hasVal && b.min != null && val < b.min;
                                const isHigh = hasVal && b.max != null && val > b.max;
                                const statusColor = hasVal ? (isLow || isHigh ? '#c0392b' : '#27ae60') : undefined;
                                const isSystolic  = b.type === 'blood_pressure_systolic';
                                const isDiastolic = b.type === 'blood_pressure_diastolic';
                                const isFirstBP   = isSystolic && formBiomarkers.some(x => x.type === 'blood_pressure_diastolic');
                                return (
                                    <div key={i}>
                                        {isFirstBP && <p style={{ margin: '0 0 0.4rem', fontWeight: 600, color: 'var(--color-maroon, #7a1c2e)' }}>Blood Pressure</p>}
                                        <div className="form-row" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
                                            <div className="form-group" style={{ flex: 1, marginBottom: '0.25rem' }}>
                                                <label style={{ fontSize: '0.8rem', color: '#555' }}>
                                                    {(isSystolic || isDiastolic) ? (isSystolic ? 'Systolic' : 'Diastolic') : formatBiomarkerName(b.type)}
                                                    {b.min != null && b.max != null && (
                                                        <span style={{ fontWeight: 400, marginLeft: '0.4rem', color: '#888' }}>(normal {b.min}&ndash;{b.max} {b.unit})</span>
                                                    )}
                                                </label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <input type="number" placeholder={b.unit || 'Value'} value={b.value} onChange={e => updateBiomarker(i, e.target.value)} step="any" style={statusColor ? { borderColor: statusColor } : {}} />
                                                    {b.unit && <span style={{ color: '#666', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{b.unit}</span>}
                                                    <button type="button" className="btn-danger" style={{ padding: '0.4rem 0.6rem', flexShrink: 0 }} onClick={() => removeBiomarker(i)} title="Remove">&#10005;</button>
                                                </div>
                                                {hasVal && b.min != null && b.max != null && (
                                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: statusColor }}>
                                                        {isLow ? `Below normal (${(b.min - val).toFixed(1)} ${b.unit} under)` : isHigh ? `Above normal (${(val - b.max).toFixed(1)} ${b.unit} over)` : 'Within normal range'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            <div style={{ position: 'relative', marginBottom: '1rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn-danger" onClick={() => setShowBiomarkerPicker(p => !p)}>Add Biomarker +</button>
                                {showBiomarkerPicker && (
                                    <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #ddd', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: '220px', overflow: 'hidden' }}>
                                        {buildBiomarkerOptions().length === 0 ? (
                                            <div style={{ padding: '0.75rem 1rem', color: '#888', fontSize: '0.9rem' }}>All available biomarkers added</div>
                                        ) : buildBiomarkerOptions().map((opt, idx) => (
                                            <button key={idx} type="button" onClick={() => addBiomarkerFromPicker(opt)}
                                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', borderBottom: idx < buildBiomarkerOptions().length - 1 ? '1px solid #f0f0f0' : 'none' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                            >{opt.label}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-group"><label>Notes</label><textarea rows="3" placeholder="Appointment notes..." value={formNotes} onChange={e => setFormNotes(e.target.value)} /></div>
                            <div className="form-group"><label>Recommended Treatments</label><textarea rows="3" placeholder="e.g. Continue current medication, reduce sodium intake..." value={formTreatments} onChange={e => setFormTreatments(e.target.value)} /></div>
                            <button type="submit" className="auth-button" disabled={formSubmitting}>{formSubmitting ? 'Submitting...' : 'Complete Appointment'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE ACCOUNT MODAL */}
            {showDeleteModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Delete Account?</h3>
                        <p>This action cannot be undone. All your data will be permanently deleted.</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancel</button>
                            <button onClick={handleDelete} className="btn-danger" disabled={deleting}>{deleting ? 'Deleting...' : 'Delete Account'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* BIOMARKER HISTORY MODAL */}
            {historyModal && patientBiomarkers?.history?.[historyModal] && (
                <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
                    <div className="modal history-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{formatBiomarkerName(historyModal)} History</h3>
                            <button className="modal-close" onClick={() => setHistoryModal(null)}>&#10005;</button>
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <BiomarkerChart data={patientBiomarkers.history[historyModal]} type={historyModal} unit={patientBiomarkers.history[historyModal][0]?.unit || ''} />
                        </div>
                        <table className="history-table">
                            <thead><tr><th>Date</th><th>Value</th><th>Status</th><th>Doctor</th></tr></thead>
                            <tbody>
                                {patientBiomarkers.history[historyModal].slice().reverse().map((entry, i) => {
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

            <MessagingWidget />
            {profileToast && (<div className={`toast ${profileToast.type}`}>{profileToast.message}</div>)}
            <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.82rem', fontWeight: 600, color: '#780606', opacity: 0.75 }}>
                version {__APP_VERSION__}-{__BUILD_SHA__}
            </div>
        </div>
    );
}
