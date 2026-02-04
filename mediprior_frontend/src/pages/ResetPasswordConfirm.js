import React, { useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';

function ResetPasswordConfirm() {
    const { uid, token } = useParams();
    const navigate = useNavigate();
    
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            await axios.patch('http://127.0.0.1:8000/api/password-reset-complete/', {
                password: password,
                token: token,
                uidb64: uid
            });
            setMessage('Password reset successful! Redirecting to login...');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setError('Invalid or expired link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card" style={{maxWidth: '500px'}}>
                <div className="text-center mb-4">
                    <h2 className="theme-title">New Password</h2>
                    <p className="text-muted">Enter your new strong password.</p>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}
                {message && <Alert variant="success">{message}</Alert>}

                <form onSubmit={handleSubmit}>
                    <div className="modern-input-group">
                        <FiLock className="input-icon" />
                        <input 
                            type="password" 
                            className="modern-input" 
                            placeholder="New Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="modern-input-group">
                        <FiLock className="input-icon" />
                        <input 
                            type="password" 
                            className="modern-input" 
                            placeholder="Confirm New Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required 
                        />
                    </div>
                    <button type="submit" className="modern-btn" disabled={loading}>
                        {loading ? <Spinner animation="border" size="sm" /> : 'Reset Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ResetPasswordConfirm;