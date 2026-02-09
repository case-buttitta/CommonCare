import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function PatientDashboard() {
    const { user, logout, deleteAccount } = useAuth();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await deleteAccount();
        } catch (err) {
            alert(err.message);
            setDeleting(false);
        }
    };

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
                    <p>Your patient dashboard is ready.</p>
                </div>

                <section className="dashboard-content">
                    {/* Dashboard content will be added here */}
                </section>

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
            </main>

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
