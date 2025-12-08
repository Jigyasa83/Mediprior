// src/pages/Login.js
import React, { useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiArrowRight } from 'react-icons/fi';

function Login() {
    const { loginUser } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        const result = await loginUser(email, password);
        if (result === 'success') {
            // loginUser handles redirect
        } else {
            setError('Invalid credentials. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-container-split">
                {/* --- Left Side: Image --- */}
                <div className="auth-image-side">
                    <div className="auth-image-content">
                        <h2 className="auth-quote">"Your health is your greatest wealth."</h2>
                        <p style={{opacity: 0.9}}>Access your dashboard to manage appointments, view reports, and consult with top doctors.</p>
                    </div>
                </div>

                {/* --- Right Side: Form --- */}
                <div className="auth-form-side">
                    <div className="auth-header">
                        <h2 className="auth-title">Welcome Back</h2>
                        <p className="auth-subtitle">Please enter your details to sign in.</p>
                    </div>

                    {error && <Alert variant="danger">{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <div className="modern-input-group">
                            <FiMail className="input-icon" />
                            <input 
                                type="email" 
                                className="modern-input" 
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required 
                            />
                        </div>

                        <div className="modern-input-group">
                            <FiLock className="input-icon" />
                            <input 
                                type="password" 
                                className="modern-input" 
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>

                        <div className="d-flex justify-content-between mb-4">
                            <small><Link to="#" className="text-muted text-decoration-none">Forgot Password?</Link></small>
                        </div>

                        <button type="submit" className="modern-btn" disabled={loading}>
                            {loading ? <Spinner animation="border" size="sm" /> : 'Sign In'}
                        </button>
                    </form>

                    <div className="text-center mt-4">
                        <p className="text-muted">
                            Don't have an account? <Link to="/signup" style={{color: 'var(--accent-primary)', fontWeight: 'bold', textDecoration: 'none'}}>Sign up free <FiArrowRight/></Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;