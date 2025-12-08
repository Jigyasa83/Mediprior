// src/pages/FindDoctors.js
import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Alert, Spinner, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom'; // 1. Import useNavigate

function FindDoctors() {
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [requestStatus, setRequestStatus] = useState({});
    
    const { authTokens } = useAuth();
    const navigate = useNavigate(); // 2. Initialize hook

    // 3. Use useCallback to fix dependency warnings and prevent infinite loops
    const fetchDoctors = useCallback(async () => {
        if (!authTokens) return;
        setLoading(true);
        setError('');
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/doctors/', {
                headers: { Authorization: `Bearer ${authTokens.access}` }
            });
            setDoctors(response.data);
        } catch (err) {
            console.error('Error fetching doctors:', err);
            setError('Could not load doctors list.');
        }
        setLoading(false);
    }, [authTokens]);

    useEffect(() => {
        fetchDoctors();
    }, [fetchDoctors]);

    const handleConnect = async (doctorId) => {
        setRequestStatus(prev => ({ ...prev, [doctorId]: 'Sending...' }));
        try {
            await axios.post('http://127.0.0.1:8000/api/connections/send/', 
                { doctor_id: doctorId }, 
                { headers: { Authorization: `Bearer ${authTokens.access}` } }
            );
            // Refresh the list to get the new "PENDING" status
            fetchDoctors();
        } catch (err) {
            console.error('Error sending connection request:', err);
            setRequestStatus(prev => ({ ...prev, [doctorId]: 'Failed' }));
        }
    };

    const handleRemoveConnection = async (doctorId) => {
        if (window.confirm('Are you sure you want to remove this connection?')) {
            setRequestStatus(prev => ({ ...prev, [doctorId]: 'Removing...' }));
            try {
                await axios.delete(`http://127.0.0.1:8000/api/connections/${doctorId}/`, {
                    headers: { Authorization: `Bearer ${authTokens.access}` }
                });
                fetchDoctors();
            } catch (err) {
                console.error('Error removing connection:', err);
                setRequestStatus(prev => ({ ...prev, [doctorId]: 'Failed' }));
            }
        }
    };

    const renderConnectionButton = (doctor) => {
        const localStatus = requestStatus[doctor.user_id];
        const apiStatus = doctor.connection_status;
        const status = localStatus || apiStatus;

        switch (status) {
            case 'ACCEPTED':
                return (
                    <>
                        {/* 4. NAVIGATE TO CHAT USING CONNECTION ID */}
                        <Button 
                            variant="outline-primary" 
                            size="sm" 
                            className="me-2" 
                            onClick={() => navigate(`/chat/${doctor.connection_id}`)}
                        >
                            Message
                        </Button>
                        
                        <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleRemoveConnection(doctor.user_id)}
                        >
                            Remove Connection
                        </Button>
                    </>
                );
            case 'PENDING':
                return (
                    <Button variant="outline-secondary" disabled>
                        Request Sent
                    </Button>
                );
            case 'Sending...':
            case 'Removing...':
                return (
                    <Button className="theme-button" disabled>
                        <Spinner as="span" animation="border" size="sm" />
                    </Button>
                );
            case 'Failed':
                return (
                    <Button variant="danger" disabled>Failed</Button>
                );
            default: // null (No connection yet) or REJECTED
                return (
                    <Button
                        className="theme-button"
                        onClick={() => handleConnect(doctor.user_id)}
                    >
                        Connect
                    </Button>
                );
        }
    };

    if (loading) {
        return <div className="text-center mt-5"><Spinner animation="border" /></div>;
    }
    if (error) {
        return <Alert variant="danger" className="m-4">{error}</Alert>;
    }

    const getAvatar = (doctor) => {
        if (doctor.profile_photo) {
            return `http://127.0.0.1:8000${doctor.profile_photo}`;
        }
        return `https://ui-avatars.com/api/?name=${doctor.name}&background=3a7bff&color=fff&rounded=true`;
    };

    return (
        <Container className="mt-4">
            <h2 className="theme-title mb-4">Find a Doctor</h2>
            <Row>
                {doctors.length > 0 ? (
                    doctors.map(doctor => (
                        <Col md={6} lg={4} key={doctor.user_id} className="mb-4">
                            <Card className="theme-card h-100">
                                <Card.Body className="d-flex flex-column">
                                    <div className="text-center mb-3">
                                        <img 
                                            src={getAvatar(doctor)} 
                                            alt={doctor.name} 
                                            style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} 
                                        />
                                    </div>
                                    <Card.Title className="theme-title text-center">{doctor.name}</Card.Title>
                                    <Card.Subtitle className="mb-2 text-center" style={{color: 'var(--text-secondary)'}}>
                                        {doctor.specialization}
                                    </Card.Subtitle>
                                    
                                    <ListGroup variant="flush" className="flex-grow-1" style={{backgroundColor: 'transparent'}}>
                                        <ListGroup.Item><strong>Experience:</strong> {doctor.years_of_experience} years</ListGroup.Item>
                                        <ListGroup.Item><strong>Qualification:</strong> {doctor.qualification}</ListGroup.Item>
                                        <ListGroup.Item><small>{doctor.clinic_name || 'Online Practice'}</small></ListGroup.Item>
                                    </ListGroup>
                                    
                                    <div className="mt-3 text-center">
                                        {renderConnectionButton(doctor)}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))
                ) : (
                    <p className="text-muted">No verified doctors are available at this time.</p>
                )}
            </Row>
        </Container>
    );
}

export default FindDoctors;