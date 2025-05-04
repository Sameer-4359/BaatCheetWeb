import React, { useRef, useEffect } from 'react';
import { useWebRTC } from '../context/webRTCContext';

const CallInterface = () => {
  const {
    localStream,
    remoteStream,
    callStatus,
    activeCall,
    startCall,
    answerCall,
    endCall
  } = useWebRTC();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="call-interface">
      <div className="video-container">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="remote-video"
        />
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className="local-video"
        />
      </div>
      
      <div className="call-controls">
        {callStatus === 'idle' && (
          <button onClick={() => startCall('TARGET_USER_ID')}>
            Start Call
          </button>
        )}
        
        {callStatus === 'incoming' && (
          <>
            <button onClick={answerCall}>Answer</button>
            <button onClick={endCall}>Decline</button>
          </>
        )}
        
        {(callStatus === 'calling' || callStatus === 'ongoing') && (
          <button onClick={endCall}>End Call</button>
        )}
      </div>
    </div>
  );
};

export default CallInterface;