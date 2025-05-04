// import React, { createContext, useContext, useState } from 'react';

// const WebRTCContext = createContext();

// export const WebRTCProvider = ({ children }) => {
//   const [localStream, setLocalStream] = useState(null);
//   const [remoteStream, setRemoteStream] = useState(null);
//   const [callStatus, setCallStatus] = useState('idle');
//   const [activeCall, setActiveCall] = useState(null);
//   const [chatMessages, setChatMessages] = useState([]);

//   const startCall = () => console.log('Start call placeholder');
//   const answerCall = () => console.log('Answer call placeholder');
//   const endCall = () => console.log('End call placeholder');
//   const sendChatMessage = () => console.log('Send message placeholder');

//   const value = {
//     localStream,
//     remoteStream,
//     callStatus,
//     activeCall,
//     chatMessages,
//     startCall,
//     answerCall,
//     endCall,
//     sendChatMessage
//   };

//   return (
//     <WebRTCContext.Provider value={value}>
//       {children}
//     </WebRTCContext.Provider>
//   );
// };

// export const useWebRTC = () => {
//   const context = useContext(WebRTCContext);
//   if (!context) {
//     throw new Error('useWebRTC must be used within a WebRTCProvider');
//   }
//   return context;
// };


import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

const WebRTCContext = createContext();

export const WebRTCProvider = ({ children }) => {
  const { user } = useAuth();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // 'idle', 'calling', 'incoming', 'ongoing'
  const [activeCall, setActiveCall] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const ws = useRef(null);
  const pc = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('token');
    ws.current = new WebSocket(`ws://localhost:5000?token=${token}`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      endCall(); // Clean up any ongoing call
    };
  }, [user]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'offer':
        handleIncomingCall(data);
        break;
      case 'answer':
        handleAnswer(data);
        break;
      case 'candidate':
        handleCandidate(data);
        break;
      case 'chat':
        handleIncomingChat(data);
        break;
      case 'online-users':
        setOnlineUsers(data.users);
        break;
      case 'end-call':
        handleRemoteEndCall();
        break;
      case 'busy':
        handleBusySignal();
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const startCall = async (recipientId) => {
    if (callStatus !== 'idle') return;

    try {
      setCallStatus('calling');
      setActiveCall({ recipientId, initiator: true });
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      
      // Create peer connection
      pc.current = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          // Add TURN servers here if needed
        ]
      });

      // Set up event handlers
      pc.current.onicecandidate = handleICECandidate;
      pc.current.ontrack = handleTrack;
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.current.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      
      ws.current.send(JSON.stringify({
        type: 'offer',
        sdp: offer.sdp,
        recipientId,
        callerId: user.id,
        callerName: user.name
      }));
      
    } catch (error) {
      console.error('Error starting call:', error);
      endCall();
    }
  };

  const handleIncomingCall = async (data) => {
    if (callStatus !== 'idle') {
      // Send busy signal if already in a call
      ws.current.send(JSON.stringify({
        type: 'busy',
        recipientId: data.callerId
      }));
      return;
    }

    setCallStatus('incoming');
    setActiveCall({
      callerId: data.callerId,
      callerName: data.callerName,
      initiator: false
    });

    // Create peer connection for incoming call
    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });

    pc.current.onicecandidate = handleICECandidate;
    pc.current.ontrack = handleTrack;

    // Set remote description from offer
    await pc.current.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: data.sdp
    }));
  };

  const answerCall = async () => {
    if (callStatus !== 'incoming' || !pc.current) return;

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setLocalStream(stream);
      
      // Add local stream tracks
      stream.getTracks().forEach(track => {
        pc.current.addTrack(track, stream);
      });

      // Create and send answer
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);

      ws.current.send(JSON.stringify({
        type: 'answer',
        sdp: answer.sdp,
        recipientId: activeCall.callerId
      }));

      setCallStatus('ongoing');
    } catch (error) {
      console.error('Error answering call:', error);
      endCall();
    }
  };

  const endCall = () => {
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    
    // Stop all media tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    setRemoteStream(null);
    setCallStatus('idle');
    
    // Notify other participant if call was active
    if (activeCall && (callStatus === 'ongoing' || callStatus === 'calling')) {
      ws.current.send(JSON.stringify({
        type: 'end-call',
        recipientId: activeCall.initiator ? activeCall.recipientId : activeCall.callerId
      }));
    }
    
    setActiveCall(null);
  };

  const handleRemoteEndCall = () => {
    if (callStatus === 'ongoing') {
      alert('The other participant has ended the call');
    }
    endCall();
  };

  const handleBusySignal = () => {
    if (callStatus === 'calling') {
      alert('The user is busy in another call');
      endCall();
    }
  };

  const handleAnswer = async (data) => {
    if (!pc.current || callStatus !== 'calling') return;
    
    await pc.current.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: data.sdp
    }));
    setCallStatus('ongoing');
  };

  const handleCandidate = (data) => {
    if (pc.current && data.candidate) {
      pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  };

  const handleTrack = (event) => {
    if (event.streams && event.streams[0]) {
      setRemoteStream(event.streams[0]);
    }
  };

  const handleICECandidate = (event) => {
    if (event.candidate && activeCall) {
      ws.current.send(JSON.stringify({
        type: 'candidate',
        candidate: event.candidate,
        recipientId: activeCall.initiator ? activeCall.recipientId : activeCall.callerId
      }));
    }
  };

  const sendChatMessage = (messageText) => {
    if (!activeCall || !ws.current) return;
    
    const recipientId = activeCall.initiator 
      ? activeCall.recipientId 
      : activeCall.callerId;
    
    const message = {
      type: 'chat',
      text: messageText,
      senderId: user.id,
      senderName: user.name,
      recipientId,
      timestamp: new Date().toISOString()
    };
    
    ws.current.send(JSON.stringify(message));
    setChatMessages(prev => [...prev, message]);
  };

  const handleIncomingChat = (data) => {
    setChatMessages(prev => [...prev, data]);
  };

  const value = {
    localStream,
    remoteStream,
    callStatus,
    activeCall,
    chatMessages,
    onlineUsers,
    startCall,
    answerCall,
    endCall,
    sendChatMessage
  };

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  );
};

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};