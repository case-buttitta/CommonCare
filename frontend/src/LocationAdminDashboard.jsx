import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { api } from './api';
import ThemeSettings from './components/ThemeSettings';
import { loadAndApplyTheme } from './utils/theme';
import { getBrand, isCustomBranded, setFavicon } from './utils/locationBranding';

export default function LocationAdminDashboard() {
    const { user, token, logout, deleteAccount, updateUser } = useAuth();
    const [activeView, setActiveView] = useState('users');
    const [location, setLocation] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [addEmail, setAddEmail] = useState('');
    const [addError, setAddError] = useState('');
    const [addSuccess, setAddSuccess] = useState('');
    const [addLoading, setAddLoading] = useState(false);

    const [editingProfile, setEditingProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ full_name: '', address: '', location: '' });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileToast, setProfileToast] = useState(null);

    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    useEffect(() => {
        fetchInitialData();
        loadAndApplyTheme(token);
        if (user?.location_name) setFavicon(user.location_name);
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const locRes = await api('/api/locations/my', { headers });
            if (locRes.ok) {
                const loc = await locRes.json();
                setLocation(loc);
                const usersRes = await api(`/api/locations/${loc.id}/users`, { headers });
                if (usersRes.ok) setUsers(await usersRes.json());
            }
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setAddError('');
        setAddSuccess('');
        if (!addEmail.trim()) return;
        setAddLoading(true);
        try {
            const res = await api(`/api/locations/${location.id}/users`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ email: addEmail.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                setAddSuccess(`${data.full_name} added to location.`);
                setAddEmail('');
                fetchInitialData();
            } else {
                setAddError(data.error || 'Failed to add user');
            }
        } catch {
            setAddError('Failed to add user');
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemoveUser = async (userId, userName) => {
        if (!window.confirm(`Remove ${userName} from this location?`)) return;
        try {
            const res = await api(`/api/locations/${location.id}/users/${userId}`, {
                method: 'DELETE',
                headers,
            });
            if (res.ok) {
                fetchInitialData();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to remove user');
            }
        } catch {
            alert('Failed to remove user');
        }
    };

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
            if (res.ok) {
                updateUser(await res.json());
                setEditingProfile(false);
                showProfileToast('Profile updated', 'success');
            } else {
                const data = await res.json();
                showProfileToast(data.error || 'Failed to update profile');
            }
        } catch {
            showProfileToast('Failed to update profile');
        } finally {
            setProfileSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try { await deleteAccount(); } catch (err) { alert(err.message); setDeleting(false); }
    };

    const navItems = [
        { id: 'users', label: 'Users' },
        { id: 'ui_customization', label: 'UI Customization' },
        { id: 'account', label: 'Account' },
    ];

    const userTypeLabel = (type) => {
        if (type === 'staff') return 'Staff';
        if (type === 'patient') return 'Patient';
        if (type === 'location_admin') return 'Location Admin';
        return type;
    };

    const userTypeBadgeClass = (type) => {
        if (type === 'staff') return 'staff';
        if (type === 'patient') return 'patient';
        return 'location-admin';
    };

    return (
        <div className="dashboard staff-dashboard">
            <header className="dashboard-header" style={{ background: 'var(--header-bg-color, var(--white))' }}>
                <div className="header-left">
                    {isCustomBranded(user?.location_name) ? (() => {
                        const brand = getBrand(user.location_name);
                        const Logo = brand.Logo;
                        return (
                            <div className="header-brand">
                                <Logo size={30} color={brand.color} />
                                <div className="header-brand-title">
                                    {user.location_name}
                                    <span className="header-brand-powered">powered by CommonCare</span>
                                </div>
                            </div>
                        );
                    })() : <h1>CommonCare</h1>}
                    <span className="user-badge location-admin">Location Admin</span>
                </div>
                <div className="header-right">
                    <span className="user-name">{user?.full_name}</span>
                    <button onClick={logout} className="btn-secondary">Sign Out</button>
                </div>
            </header>

            <main className="dashboard-main" style={{ background: 'var(--page-bg-color, var(--bg-light))' }}>
                <div className="welcome-card">
                    <h2>Welcome, {user?.full_name?.split(' ')[0]}!</h2>
                    <p>
                        Managing <strong>{location?.name || 'your location'}</strong>
                        {location?.address && <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>— {location.address}</span>}
                    </p>
                </div>

                <nav className="dashboard-tabs">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`tab-button ${activeView === item.id ? 'active' : ''}`}
                            onClick={() => setActiveView(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {loading ? (
                    <div className="section-loading">Loading data...</div>
                ) : (
                    <section className="dashboard-content">

                        {/* USERS TAB */}
                        {activeView === 'users' && (
                            <div className="tab-panel">
                                <div className="staff-layout">
                                    <div className="patient-list-panel">
                                        <div className="panel-header">
                                            <h3>Location Users</h3>
                                            <span className="patient-count">{users.filter(u => u.id !== user?.id).length} members</span>
                                        </div>

                                        <form onSubmit={handleAddUser} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                                            <div className="form-group" style={{ marginBottom: '6px' }}>
                                                <label>Add user by email</label>
                                                <input
                                                    type="email"
                                                    placeholder="user@example.com"
                                                    value={addEmail}
                                                    onChange={e => { setAddEmail(e.target.value); setAddError(''); setAddSuccess(''); }}
                                                />
                                            </div>
                                            {addError && <div className="auth-error" style={{ marginBottom: '6px' }}>{addError}</div>}
                                            {addSuccess && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '6px' }}>{addSuccess}</div>}
                                            <button type="submit" className="auth-button" style={{ width: 'auto', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }} disabled={addLoading}>
                                                {addLoading ? 'Adding...' : 'Add User'}
                                            </button>
                                        </form>

                                        <div className="patient-list">
                                            {users.filter(u => u.id !== user?.id).length === 0 ? (
                                                <div className="empty-state">No users assigned to this location yet.</div>
                                            ) : (
                                                users.filter(u => u.id !== user?.id).map(u => (
                                                    <div key={u.id} className="patient-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.full_name}</div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                                                            <span className={`user-badge ${userTypeBadgeClass(u.user_type)}`} style={{ fontSize: '0.65rem', padding: '2px 8px', marginTop: '4px', display: 'inline-block' }}>
                                                                {userTypeLabel(u.user_type)}
                                                            </span>
                                                        </div>
                                                        <button
                                                            className="btn-danger"
                                                            style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                                                            onClick={() => handleRemoveUser(u.id, u.full_name)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    <div className="patient-detail-panel">
                                        <div className="section-title">Location Details</div>
                                        <div className="account-info">
                                            <div className="info-row">
                                                <span className="info-label">Location Name</span>
                                                <span className="info-value">{location?.name || '—'}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Address</span>
                                                <span className="info-value">{location?.address || '—'}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Total Members</span>
                                                <span className="info-value">{users.length}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Staff</span>
                                                <span className="info-value">{users.filter(u => u.user_type === 'staff').length}</span>
                                            </div>
                                            <div className="info-row">
                                                <span className="info-label">Patients</span>
                                                <span className="info-value">{users.filter(u => u.user_type === 'patient').length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* UI CUSTOMIZATION TAB */}
                        {activeView === 'ui_customization' && (
                            <div className="tab-panel">
                                <div className="normal-ranges-form-card" style={{ maxWidth: '540px' }}>
                                    <div className="section-title">UI Customization</div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '16px' }}>
                                        Customize the look of CommonCare for all users at <strong>{location?.name}</strong>. Changes are applied immediately for all users at this location.
                                    </p>
                                    <ThemeSettings
                                        locationId={location?.id}
                                        onThemeUpdated={() => {}}
                                    />
                                </div>
                            </div>
                        )}

                        {/* ACCOUNT TAB */}
                        {activeView === 'account' && (
                            <div className="tab-panel">
                                <div className="account-section">
                                    {profileToast && (
                                        <div className={`profile-toast ${profileToast.type}`}>{profileToast.message}</div>
                                    )}
                                    <h3>Account Settings</h3>
                                    {!editingProfile ? (
                                        <>
                                            <div className="account-info">
                                                <div className="info-row"><span className="info-label">Name</span><span className="info-value">{user?.full_name}</span></div>
                                                <div className="info-row"><span className="info-label">Email</span><span className="info-value">{user?.email}</span></div>
                                                <div className="info-row"><span className="info-label">Role</span><span className="info-value">Location Admin</span></div>
                                                <div className="info-row"><span className="info-label">Location</span><span className="info-value">{location?.name || user?.location}</span></div>
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
                    </section>
                )}
            </main>

            {/* DELETE ACCOUNT MODAL */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Delete Account</h3>
                            <button className="modal-close" onClick={() => setShowDeleteModal(false)}>&#10005;</button>
                        </div>
                        <p style={{ padding: '1rem 0' }}>Are you sure you want to delete your account? This cannot be undone.</p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
