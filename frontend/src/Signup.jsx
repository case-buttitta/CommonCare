import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function Signup({ onSwitchToLogin }) {
    const { signup } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        address: '',
        location: 'Charlotte',
        user_type: 'patient'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const { confirmPassword, ...signupData } = formData;
            await signup(signupData);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card signup-card">
                <div className="auth-header">
                    <h1>CommonCare</h1>
                    <p>Create your account to get started.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="full_name">Full Name</label>
                            <input
                                id="full_name"
                                type="text"
                                name="full_name"
                                value={formData.full_name}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Create a password"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Confirm your password"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">Address</label>
                        <input
                            id="address"
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Enter your address"
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="location">Location</label>
                            <select
                                id="location"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                required
                            >
                                <option value="Charlotte">Charlotte</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="user_type">I am a...</label>
                            <select
                                id="user_type"
                                name="user_type"
                                value={formData.user_type}
                                onChange={handleChange}
                                required
                            >
                                <option value="patient">Patient</option>
                                <option value="staff">Staff Member</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>Already have an account? <button onClick={onSwitchToLogin} className="link-button">Sign in</button></p>
                </div>
            </div>
        </div>
    );
}
