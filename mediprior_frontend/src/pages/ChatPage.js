// src/pages/ChatPage.js
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';

function ChatPage() {
    const [connections, setConnections] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const { connectionId } = useParams(); // This is the ID from the URL (e.g., 5)
    const { authTokens } = useAuth();
    const navigate = useNavigate();

    // 1. Fetch Connections
    useEffect(() => {
        if (!authTokens) return;
        
        const fetchConnections = async () => {
            setLoading(true);
            try {
                const response = await axios.get('http://127.0.0.1:8000/api/connections/', {
                    headers: { Authorization: `Bearer ${authTokens.access}` }
                });
                // Filter for accepted chats only
                const accepted = response.data.filter(c => c.status === 'ACCEPTED');
                setConnections(accepted);
            } catch (err) {
                console.error(err);
                setError('Could not load chat list.');
            } finally {
                setLoading(false);
            }
        };
        fetchConnections();
    }, [authTokens]);

    // 2. Select Conversation based on URL
    useEffect(() => {
        if (connections.length > 0) {
            if (connectionId) {
                // Find the chat that matches the ID in the URL
                const found = connections.find(c => c.id.toString() === connectionId);
                if (found) {
                    setSelectedConversation(found);
                } else {
                    // ID exists but not found in list (e.g. deleted or invalid)
                    setError("Chat not found or access denied.");
                    setSelectedConversation(null);
                }
            } else {
                // No ID in URL, clear selection
                setSelectedConversation(null);
            }
        }
    }, [connectionId, connections]);

    // 3. Handle clicking a chat
    const handleSelectConversation = (conversation) => {
        navigate(`/chat/${conversation.id}`);
    };

    if (loading && connections.length === 0) {
        return <div className="text-center mt-5"><Spinner animation="border" /></div>;
    }

    return (
        <Row style={{ height: 'calc(100vh - 4rem)' }}>
            <Col lg={4} style={{ height: '100%' }}>
                <ChatList 
                    connections={connections} 
                    onSelectConversation={handleSelectConversation}
                    selectedConversationId={selectedConversation?.id}
                />
            </Col>

            <Col lg={8} style={{ height: '100%' }}>
                {error ? (
                     <Alert variant="danger" className="m-4">{error}</Alert>
                ) : selectedConversation ? (
                    <ChatWindow key={selectedConversation.id} conversation={selectedConversation} />
                ) : (
                    <Card className="theme-card h-100">
                        <Card.Body className="d-flex align-items-center justify-content-center">
                            <div className="text-center text-muted">
                                <h4>Select a conversation</h4>
                                <p>Choose a doctor from the left to start chatting.</p>
                            </div>
                        </Card.Body>
                    </Card>
                )}
            </Col>
        </Row>
    );
}

export default ChatPage;