// src/components/AIChatbot.js
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; 
import { FiMessageCircle, FiX, FiSend, FiTrash2, FiAlertTriangle } from 'react-icons/fi';

const styles = {
    floatingBtn: {
        position: 'fixed', bottom: '20px', right: '20px', borderRadius: '50%',
        width: '60px', height: '60px', zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: '24px'
    },
    chatWindow: {
        position: 'fixed', bottom: '90px', right: '20px', width: '350px',
        height: '500px', zIndex: 1000, display: 'flex', flexDirection: 'column',
        borderRadius: '15px', overflow: 'hidden'
    },
    messagesArea: {
        flex: 1, overflowY: 'auto', padding: '15px', background: 'var(--bg-primary)'
    },
    bubble: {
        padding: '12px 16px', borderRadius: '15px', marginBottom: '10px',
        maxWidth: '85%', wordWrap: 'break-word', fontSize: '0.9rem', lineHeight: '1.4'
    },
    botBubble: {
        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
        alignSelf: 'flex-start', borderBottomLeftRadius: '2px'
    },
    userBubble: {
        background: 'var(--accent-primary)', color: '#fff',
        alignSelf: 'flex-end', borderBottomRightRadius: '2px'
    },
    // --- THIS IS THE RED CARD STYLE ---
    crisisBubble: {
        background: '#fff5f5', color: '#2d3748',
        border: '1px solid #fc8181', alignSelf: 'flex-start',
        borderBottomLeftRadius: '2px', width: '95%'
    }
};

function AIChatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const initialMsg = { sender: 'bot', text: "Hi! I'm your AI Health Companion. How are you feeling right now?" };
    const [messages, setMessages] = useState([initialMsg]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [chatContext, setChatContext] = useState(null); 

    const { authTokens } = useAuth();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages, isOpen]);

    const sendMessage = async (text, isTool = false) => {
        if (!text.trim()) return;
        if (!isTool) setMessages(prev => [...prev, { sender: 'user', text: text }]);
        setInput('');
        setLoading(true);

        try {
            const payload = {
                message: isTool ? "" : text,
                tool: isTool ? text : null,
                previous_context: chatContext 
            };

            const response = await axios.post('http://127.0.0.1:8000/api/ai-chat/', payload, {
                headers: { Authorization: `Bearer ${authTokens?.access}` }
            });

            const data = response.data;
            if (data.previous_context) setChatContext(data.previous_context);
            setMessages(prev => [...prev, { sender: 'bot', text: data.response }]);
            
        } catch (error) {
            console.error("Chat Error", error);
            setMessages(prev => [...prev, { sender: 'bot', text: "I'm having trouble connecting." }]);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = () => { setMessages([initialMsg]); setChatContext(null); };
    const handleToolClick = (toolKey) => { sendMessage(toolKey, true); };

    // --- THIS FUNCTION DRAWS THE RED CARD ---
    const renderMessageContent = (msg) => {
        if (msg.text === "CRISIS_DETECTED") {
            return (
                <div>
                    <div className="d-flex align-items-center mb-2" style={{color: '#c53030', fontWeight: 'bold'}}>
                        <FiAlertTriangle className="me-2" />
                        Crisis Support
                    </div>
                    <p className="mb-2">I'm hearing that you're in a lot of pain. You are not alone.</p>
                    <div className="bg-white p-2 rounded border mb-2" style={{fontSize: '0.85rem'}}>
                        <strong>🚨 Emergency Resources:</strong>
                        <ul className="mb-1 ps-3 mt-1">
                            <li>Emergency: 911 / 112</li>
                            <li>Suicide Helpline: 988</li>
                        </ul>
                    </div>
                    <p className="mb-0 small text-muted">Please reach out to a human immediately.</p>
                </div>
            );
        }
        return msg.text.split('\n').map((line, i) => <span key={i}>{line}<br/></span>);
    };

    if (!isOpen) {
        return (
            <Button className="theme-button" style={styles.floatingBtn} onClick={() => setIsOpen(true)}>
                <FiMessageCircle />
            </Button>
        );
    }

    return (
        <Card className="theme-card" style={styles.chatWindow}>
            <div className="p-3 border-bottom d-flex justify-content-between align-items-center" style={{background: 'var(--bg-secondary)'}}>
                <div>
                    <h5 className="m-0 theme-title" style={{fontSize: '1rem'}}>AI Companion</h5>
                    <small className="text-muted">Always here to listen</small>
                </div>
                <div>
                    <Button variant="link" className="text-muted p-0 me-3" onClick={clearChat}><FiTrash2 size={20}/></Button>
                    <Button variant="link" className="text-muted p-0" onClick={() => setIsOpen(false)}><FiX size={24}/></Button>
                </div>
            </div>

            <div style={styles.messagesArea} className="d-flex flex-column">
                {messages.map((msg, idx) => {
                    const isCrisis = msg.text === "CRISIS_DETECTED";
                    let bubbleStyle = { ...styles.bubble };
                    
                    if (isCrisis) bubbleStyle = { ...bubbleStyle, ...styles.crisisBubble };
                    else if (msg.sender === 'bot') bubbleStyle = { ...bubbleStyle, ...styles.botBubble };
                    else bubbleStyle = { ...bubbleStyle, ...styles.userBubble };

                    return (
                        <div key={idx} style={bubbleStyle}>
                            {renderMessageContent(msg)}
                        </div>
                    );
                })}
                {loading && <div className="text-muted small ms-2">Thinking...</div>}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-2 border-top" style={{background: 'var(--bg-secondary)'}}>
                <div className="d-flex justify-content-around mb-2">
                    <Button variant="outline-info" size="sm" onClick={() => handleToolClick('breathing')}>🌬️ Breathe</Button>
                    <Button variant="outline-success" size="sm" onClick={() => handleToolClick('grounding')}>🌍 Ground</Button>
                    <Button variant="outline-warning" size="sm" onClick={() => handleToolClick('affirmation')}>✨ Affirm</Button>
                </div>
                <InputGroup>
                    <Form.Control placeholder="Type here..." className="theme-input" value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)} />
                    <Button className="theme-button" onClick={() => sendMessage(input)} disabled={loading}><FiSend /></Button>
                </InputGroup>
            </div>
        </Card>
    );
}

export default AIChatbot;