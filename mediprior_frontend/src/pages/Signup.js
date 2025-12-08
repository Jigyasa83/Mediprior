// src/pages/Signup.js
import React, { useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMail, FiLock, FiUser, FiCheckCircle } from 'react-icons/fi';

function Signup() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [userType, setUserType] = useState('PATIENT'); 
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth(); 

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        const registrationData = { email, password, user_type: userType };

        try {
            await axios.post('http://127.0.0.1:8000/api/register/', registrationData, {
                 headers: { 'Authorization': null }
            });
            await loginUser(email, password);
        } catch (apiError) {
            setLoading(false);
            if (apiError.response && apiError.response.data) {
                const errors = apiError.response.data;
                if (errors.password) setError(errors.password[0]);
                else if (errors.email) setError(`Email Error: ${errors.email[0]}`);
                else setError('Registration failed.');
            } else {
                setError('Server error. Please try again.');
            }
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-container-split">
                {/* --- Left Side: Image --- */}
                <div className="auth-image-side" style={{backgroundImage: "url('https://img.freepik.com/free-photo/medical-banner-with-doctor-working-laptop_23-2149611211.jpg')"}}>
                    <div className="auth-image-content">
                        <h2 className="auth-quote">"Better Healthcare, Closer to You."</h2>
                        <p style={{opacity: 0.9}}>Join Mediprior today to connect with specialists and track your health journey.</p>
                    </div>
                </div>

                {/* --- Right Side: Form --- */}
                <div className="auth-form-side">
                    <div className="auth-header">
                        <h2 className="auth-title">Create Account</h2>
                        <p className="auth-subtitle">Get started with your free account.</p>
                    </div>

                    {error && <Alert variant="danger">{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        {/* User Type Selector */}
                        <div className="d-flex gap-3 mb-4">
                            {['PATIENT', 'DOCTOR'].map((type) => (
                                <div 
                                    key={type}
                                    onClick={() => setUserType(type)}
                                    style={{
                                        flex: 1,
                                        padding: '10px',
                                        border: userType === type ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        backgroundColor: userType === type ? 'rgba(58, 123, 255, 0.05)' : 'transparent',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{fontWeight: 'bold', color: userType === type ? 'var(--accent-primary)' : 'var(--text-secondary)'}}>
                                        {type === 'PATIENT' ? 'Patient' : 'Doctor'}
                                    </div>
                                    {userType === type && <FiCheckCircle style={{color: 'var(--accent-primary)', fontSize: '1.2rem', marginTop: '5px'}}/>}
                                </div>
                            ))}
                        </div>

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
                                placeholder="Password (Min 6 chars)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required 
                            />
                        </div>

                        <button type="submit" className="modern-btn" disabled={loading}>
                            {loading ? <Spinner animation="border" size="sm" /> : 'Create Account'}
                        </button>
                    </form>

                    <div className="text-center mt-4">
                        <p className="text-muted">
                            Already have an account? <Link to="/login" style={{color: 'var(--accent-primary)', fontWeight: 'bold', textDecoration: 'none'}}>Login here</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Signup;