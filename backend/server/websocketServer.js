const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const setupWebSocketServer = (server) => {
  const wss = new WebSocket.Server({ server });
  const clients = new Map();

  wss.on('connection', (ws, req) => {
    const token = req.url.split('token=')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      
      clients.set(userId, ws);
      console.log(`User connected: ${userId}`);

      // Notify all clients about new connection
      broadcastOnlineUsers();

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleMessage(userId, data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        clients.delete(userId);
        console.log(`User disconnected: ${userId}`);
        broadcastOnlineUsers();
      });

    } catch (error) {
      ws.close(1008, 'Invalid token');
    }
  });

  const handleMessage = (senderId, data) => {
    switch (data.type) {
      case 'offer':
        handleOffer(senderId, data);
        break;
      case 'answer':
        handleAnswer(senderId, data);
        break;
      case 'candidate':
        handleCandidate(senderId, data);
        break;
      case 'end-call':
        handleEndCall(senderId, data);
        break;
      case 'chat':
        handleChat(senderId, data);
        break;
      case 'busy':
        handleBusy(senderId, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const handleOffer = (senderId, data) => {
    const recipientWs = clients.get(data.recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'offer',
        sdp: data.sdp,
        callerId: senderId,
        callerName: data.callerName
      }));
    }
  };

  const handleAnswer = (senderId, data) => {
    const recipientWs = clients.get(data.recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'answer',
        sdp: data.sdp,
        answererId: senderId
      }));
    }
  };

  const handleCandidate = (senderId, data) => {
    const recipientWs = clients.get(data.recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'candidate',
        candidate: data.candidate,
        senderId
      }));
    }
  };

  const handleEndCall = (senderId, data) => {
    const recipientWs = clients.get(data.recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'end-call',
        senderId
      }));
    }
  };

  const handleChat = (senderId, data) => {
    const recipientWs = clients.get(data.recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        ...data,
        senderId
      }));
    }
  };

  const handleBusy = (senderId, data) => {
    const recipientWs = clients.get(data.recipientId);
    if (recipientWs) {
      recipientWs.send(JSON.stringify({
        type: 'busy',
        senderId
      }));
    }
  };

  const broadcastOnlineUsers = () => {
    const onlineUsers = Array.from(clients.keys());
    clients.forEach((ws, userId) => {
      ws.send(JSON.stringify({
        type: 'online-users',
        users: onlineUsers.filter(id => id !== userId)
      }));
    });
  };
};

module.exports = setupWebSocketServer;