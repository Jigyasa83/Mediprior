// src/components/chatbot/AiChatWidget.js

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiMessageCircle, FiX, FiSend } from 'react-icons/fi';

const styles = {
    floatingBtn: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px'
    },
    chatWindow: {
        position: 'fixed',
        bottom: '90px',
        right: '20px',
        width: '350px',
        height: '500px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '15px',
        overflow: 'hidden'
    },
    messagesArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '15px',
        background: 'var(--bg-primary)'
    },
    bubble: {
        padding: '10px 15px',
        borderRadius: '15px',
        marginBottom: '10px',
        maxWidth: '85%',
        wordWrap: 'break-word',
        fontSize: '0.9rem'
    },
    botBubble: {
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: '2px'
    },
    userBubble: {
        background: 'var(--accent-primary)',
        color: '#fff',
        alignSelf: 'flex-end',
        borderBottomRightRadius: '2px'
    }
};

function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'bot', text: "Hi! I'm your AI Health Companion. How are you feeling right now?" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    
    // --- NEW: Context State for Memory ---
    const [chatContext, setChatContext] = useState(null); 

    const { authTokens } = useAuth();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isOpen]);

    const sendMessage = async (text, isTool = false) => {
        if (!text.trim()) return;

        // 1. Update UI with User Message immediately
        if (!isTool) {
            setMessages(prev => [...prev, { sender: 'user', text: text }]);
        }
        setInput('');
        setLoading(true);

        try {
            // 2. Prepare Payload (Adding previous_context)
            const basePayload = isTool ? { tool: text } : { message: text };
            
            const payload = {
                ...basePayload,
                previous_context: chatContext // <--- Sending Memory to Backend
            };

            // 3. Send Request (Updated URL to /core/)
            const response = await axios.post('http://127.0.0.1:8000/core/ai-chat/', payload, {
                headers: { Authorization: `Bearer ${authTokens.access}` }
            });

            const data = response.data;

            // 4. Update Memory from Backend Response
            if (data.previous_context) {
                setChatContext(data.previous_context);
            }

            // 5. Update UI with Bot Response
            setMessages(prev => [...prev, { sender: 'bot', text: data.response }]);
            
            // If it was a mood check, maybe show a toast or console log the score
            if (data.mood_score) {
                console.log(`Detected Mood: ${data.emotion} (${data.mood_score}/10)`);
            }

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: "I'm having trouble connecting right now. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    const handleToolClick = (toolKey) => {
        // Send a hidden request for the tool
        sendMessage(toolKey, true);
    };

    if (!isOpen) {
        return (
            <Button 
                className="theme-button" 
                style={styles.floatingBtn} 
                onClick={() => setIsOpen(true)}
            >
                <FiMessageCircle />
            </Button>
        );
    }

    return (
        <Card className="theme-card" style={styles.chatWindow}>
            {/* Header */}
            <div className="p-3 border-bottom d-flex justify-content-between align-items-center" style={{background: 'var(--bg-secondary)'}}>
                <div>
                    <h5 className="m-0 theme-title" style={{fontSize: '1rem'}}>AI Companion</h5>
                    <small className="text-muted">Always here to listen</small>
                </div>
                <Button variant="link" className="text-muted p-0" onClick={() => setIsOpen(false)}>
                    <FiX size={24} />
                </Button>
            </div>

            {/* Messages */}
            <div style={styles.messagesArea} className="d-flex flex-column">
                {messages.map((msg, idx) => (
                    <div key={idx} style={{...styles.bubble, ...(msg.sender === 'bot' ? styles.botBubble : styles.userBubble)}}>
                        {msg.text.split('\n').map((line, i) => (
                            <span key={i}>{line}<br/></span>
                        ))}
                    </div>
                ))}
                {loading && <div className="text-muted small ms-2">Thinking...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* Tools & Input */}
            <div className="p-2 border-top" style={{background: 'var(--bg-secondary)'}}>
                {/* Quick Tools Row */}
                <div className="d-flex justify-content-around mb-2">
                    <Button variant="outline-info" size="sm" style={{fontSize: '0.7rem'}} onClick={() => handleToolClick('breathing')}>
                        🌬️ Breathe
                    </Button>
                    <Button variant="outline-success" size="sm" style={{fontSize: '0.7rem'}} onClick={() => handleToolClick('grounding')}>
                        🌍 Ground
                    </Button>
                    <Button variant="outline-warning" size="sm" style={{fontSize: '0.7rem'}} onClick={() => handleToolClick('affirmation')}>
                        ✨ Affirm
                    </Button>
                </div>

                <InputGroup>
                    <Form.Control
                        placeholder="Type here..."
                        className="theme-input"
                        style={{fontSize: '0.9rem'}}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
                    />
                    <Button className="theme-button" onClick={() => sendMessage(input)} disabled={loading}>
                        <FiSend />
                    </Button>
                </InputGroup>
            </div>
        </Card>
    );
}

export default AIChatbot;