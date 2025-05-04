import React, { useState, useEffect, useRef } from 'react';
import { useWebRTC } from '../context/webRTCContext';

const ChatInterface = () => {
  const { chatMessages, sendChatMessage, activeCall } = useWebRTC();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && activeCall) {
      sendChatMessage(message);
      setMessage('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!activeCall) {
    return (
      <div className="chat-container">
        <div className="chat-placeholder">
          <p>Start a call to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat with {activeCall.initiator ? activeCall.recipientId : activeCall.callerName}</h3>
      </div>
      
      <div className="chat-messages">
        {chatMessages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.senderId === activeCall.initiator ? activeCall.recipientId : activeCall.callerId ? 'received' : 'sent'}`}
          >
            <div className="message-sender">{msg.senderName}</div>
            <div className="message-text">{msg.text}</div>
            <div className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default ChatInterface;