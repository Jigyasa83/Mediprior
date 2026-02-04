import React, { useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        try {
            await axios.post('http://127.0.0.1:8000/api/request-reset-email/', { email });
            setMessage('If an account exists, a reset link has been sent to your email (Check Terminal for now).');
        } catch (error) {
            setMessage('Error sending email. Try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card" style={{maxWidth: '500px'}}>
                <div className="text-center mb-4">
                    <h2 className="theme-title">Reset Password</h2>
                    <p className="text-muted">Enter your email to receive a reset link.</p>
                </div>

                {message && <Alert variant="info">{message}</Alert>}

                <form onSubmit={handleSubmit}>
                    <div className="modern-input-group">
                        <FiMail className="input-icon" />
                        <input 
                            type="email" 
                            className="modern-input" 
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required 
                        />
                    </div>
                    <button type="submit" className="modern-btn" disabled={loading}>
                        {loading ? <Spinner animation="border" size="sm" /> : 'Send Reset Link'}
                    </button>
                </form>

                <div className="text-center mt-4">
                    <Link to="/login" className="text-decoration-none text-muted">
                        <FiArrowLeft /> Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;