// src/pages/MyConnections.js
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Button, Alert, Spinner, ListGroup, Tabs, Tab } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiCheck, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate

function MyConnections() {
    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { user, authTokens, fetchProfile } = useAuth();
    const navigate = useNavigate(); // 2. Initialize hook

    // 3. Use useCallback to prevent infinite loops
    const fetchConnections = useCallback(async () => {
        if (!authTokens) return;
        setLoading(true);
        setError('');
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/connections/', {
                headers: { Authorization: `Bearer ${authTokens.access}` }
            });
            setConnections(response.data);
        } catch (err) {
            console.error('Error fetching connections:', err);
            setError('Could not load connections.');
        } finally {
            setLoading(false);
        }
    }, [authTokens]);

    useEffect(() => {
        if (user) {
            fetchConnections();
        }
    }, [user, fetchConnections]);

    const handleAction = async (connectionId, action) => {
        try {
            await axios.post('http://127.0.0.1:8000/api/connections/', 
                { connection_id: connectionId, action: action },
                { headers: { Authorization: `Bearer ${authTokens.access}` } }
            );
            fetchConnections(); 
            if (fetchProfile) fetchProfile(); 
        } catch (err) {
            console.error('Error managing connection:', err);
            setError('Action failed. Please try again.');
        }
    };
    
    const handleRemove = async (targetUserId) => {
        if (window.confirm("Are you sure you want to remove this connection?")) {
            try {
                // We send the ID of the USER we want to disconnect from
                await axios.delete(`http://127.0.0.1:8000/api/connections/${targetUserId}/`, {
                    headers: { Authorization: `Bearer ${authTokens.access}` }
                });
                fetchConnections(); 
            } catch (err) {
                console.error('Error removing connection:', err);
                setError('Could not remove connection.');
            }
        }
    };

    const getAvatar = (profile) => {
        if (profile?.profile_photo) {
            return `http://127.0.0.1:8000${profile.profile_photo}`;
        }
        const name = profile?.name || (user.user_type === 'PATIENT' ? 'Doctor' : 'Patient');
        return `https://ui-avatars.com/api/?name=${name}&background=3a7bff&color=fff&rounded=true`;
    };

    // --- View for Doctors ---
    const renderDoctorView = () => {
        const pending = connections.filter(c => c.status === 'PENDING');
        const accepted = connections.filter(c => c.status === 'ACCEPTED');

        return (
            <Tabs defaultActiveKey="invitations" id="connections-tabs" className="mb-3" justify>
                <Tab eventKey="invitations" title={`Invitations (${pending.length})`}>
                    <ListGroup>
                        {pending.length > 0 ? pending.map(conn => (
                            <ListGroup.Item key={conn.id} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <img src={getAvatar(conn.patient_profile)} alt="Patient" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px' }} />
                                    <div>
                                        <strong className="theme-title">{conn.patient_profile?.name || 'Patient'}</strong>
                                    </div>
                                </div>
                                <div>
                                    <Button variant="success" className="me-2" onClick={() => handleAction(conn.id, 'ACCEPT')}>
                                        <FiCheck /> Accept
                                    </Button>
                                    <Button variant="danger" onClick={() => handleAction(conn.id, 'REJECT')}>
                                        <FiX /> Reject
                                    </Button>
                                </div>
                            </ListGroup.Item>
                        )) : <p className="text-muted">You have no new invitations.</p>}
                    </ListGroup>
                </Tab>
                <Tab eventKey="patients" title={`My Patients (${accepted.length})`}>
                    <ListGroup>
                        {accepted.length > 0 ? accepted.map(conn => (
                            <ListGroup.Item key={conn.id} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <img src={getAvatar(conn.patient_profile)} alt="Patient" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px' }} />
                                    <div>
                                        <strong className="theme-title">{conn.patient_profile?.name || 'Patient'}</strong>
                                    </div>
                                </div>
                                <div>
                                    {/* 4. Message Button for Doctors */}
                                    <Button 
                                        variant="outline-primary" 
                                        size="sm" 
                                        className="me-2"
                                        onClick={() => navigate(`/chat/${conn.id}`)}
                                    >
                                        Message
                                    </Button>
                                    {/* 5. Remove Button for Doctors (Pass patient ID) */}
                                    {/* Note: conn.patient is just the ID in the serializer, 
                                        so we might need to access it differently depending on serializer depth.
                                        If it fails, we check if we need to adjust the serializer. 
                                        But typically, if it's nested, we need the ID. */}
                                    <Button 
                                        variant="outline-danger" 
                                        size="sm" 
                                        onClick={() => handleRemove(conn.patient_profile.user_id || conn.patient)} 
                                    >
                                        <FiX /> Remove
                                    </Button>
                                </div>
                            </ListGroup.Item>
                        )) : <p className="text-muted">You have no accepted patient connections yet.</p>}
                    </ListGroup>
                </Tab>
            </Tabs>
        );
    };

    // --- View for Patients ---
    const renderPatientView = () => {
        const pending = connections.filter(c => c.status === 'PENDING');
        const accepted = connections.filter(c => c.status === 'ACCEPTED');
        const rejected = connections.filter(c => c.status === 'REJECTED');

        return (
            <Tabs defaultActiveKey="network" id="connections-tabs" className="mb-3" justify>
                <Tab eventKey="network" title={`My Network (${accepted.length})`}>
                    <ListGroup>
                        {accepted.length > 0 ? accepted.map(conn => (
                            <ListGroup.Item key={conn.id} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <img src={getAvatar(conn.doctor_profile)} alt="Doctor" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px' }} />
                                    <div>
                                        <strong className="theme-title">{conn.doctor_profile?.name || 'Doctor'}</strong>
                                        <br/>
                                        <small className="text-muted">{conn.doctor_profile?.specialization || ''}</small>
                                    </div>
                                </div>
                                <div>
                                    {/* 6. Message Button for Patients */}
                                    <Button 
                                        variant="outline-primary" 
                                        size="sm" 
                                        className="me-2" 
                                        onClick={() => navigate(`/chat/${conn.id}`)}
                                    >
                                        Message
                                    </Button>
                                    
                                    <Button 
                                        variant="outline-danger" 
                                        size="sm" 
                                        onClick={() => handleRemove(conn.doctor_profile.user_id)}
                                    >
                                        <FiX /> Remove
                                    </Button>
                                </div>
                            </ListGroup.Item>
                        )) : <p className="text-muted">You have no accepted connections yet.</p>}
                    </ListGroup>
                </Tab>

                <Tab eventKey="requests" title={`Requests Sent (${pending.length})`}>
                    <ListGroup>
                        {pending.length > 0 ? pending.map(conn => (
                            <ListGroup.Item key={conn.id} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <img src={getAvatar(conn.doctor_profile)} alt="Doctor" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px' }} />
                                    <div>
                                        <strong className="theme-title">{conn.doctor_profile?.name || 'Doctor'}</strong>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    onClick={() => handleRemove(conn.doctor_profile.user_id)}
                                >
                                    Cancel Request
                                </Button>
                            </ListGroup.Item>
                        )) : <p className="text-muted">You have no pending requests.</p>}
                    </ListGroup>
                </Tab>
                
                <Tab eventKey="rejected" title={`Rejected (${rejected.length})`}>
                     <ListGroup>
                        {rejected.length > 0 ? rejected.map(conn => (
                            <ListGroup.Item key={conn.id} className="d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <img src={getAvatar(conn.doctor_profile)} alt="Doctor" style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px' }} />
                                    <div>
                                        <strong className="theme-title">{conn.doctor_profile?.name || 'Doctor'}</strong>
                                    </div>
                                </div>
                                <Button 
                                    variant="outline-danger" 
                                    size="sm"
                                    onClick={() => handleRemove(conn.doctor_profile.user_id)}
                                >
                                    Remove
                                </Button>
                            </ListGroup.Item>
                        )) : <p className="text-muted">You have no rejected requests.</p>}
                    </ListGroup>
                </Tab>
            </Tabs>
        );
    };

    if (loading) {
        return <div className="text-center mt-5"><Spinner animation="border" style={{ color: 'var(--accent-primary)' }}/></div>;
    }
    
    return (
        <Container>
            <h1 className="theme-title mb-4">My Connections</h1>
            {error && <Alert variant="danger">{error}</Alert>}
            {user?.user_type === 'DOCTOR' && renderDoctorView()}
            {user?.user_type === 'PATIENT' && renderPatientView()}
        </Container>
    );
}

export default MyConnections;