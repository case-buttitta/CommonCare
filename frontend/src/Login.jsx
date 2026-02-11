import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function Login({ onSwitchToSignup }) {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const quickLogin = (testEmail) => {
        setEmail(testEmail);
        setPassword('password123');
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>CommonCare</h1>
                    <p>Welcome back! Please sign in to continue.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="test-accounts">
                    <div className="test-accounts-header">
                        <span className="test-badge">TEST ENV</span>
                        <span>Test Account Credentials</span>
                    </div>
                    <div className="test-account-row">
                        <div className="test-account-info">
                            <strong>Patient:</strong> patient@test.com
                        </div>
                        <button className="btn-quick-login" onClick={() => quickLogin('patient@test.com')}>Use</button>
                    </div>
                    <div className="test-account-row">
                        <div className="test-account-info">
                            <strong>Staff:</strong> doctor@test.com
                        </div>
                        <button className="btn-quick-login" onClick={() => quickLogin('doctor@test.com')}>Use</button>
                    </div>
                    <div className="test-account-pw">Password: <code>password123</code></div>
                </div>

                <div className="auth-footer">
                    <p>Don't have an account? <button onClick={onSwitchToSignup} className="link-button">Create one</button></p>
                </div>
            </div>
        </div>
    );
}
