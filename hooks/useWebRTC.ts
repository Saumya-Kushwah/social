// hooks/useWebRTC.ts - PRODUCTION-READY VERSION
import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "@/components/SocketProvider";
import type { CallStatus, ChatUser } from "@/types/chat.types";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    // TODO: Add TURN servers for production
  ],
};

interface UseWebRTCProps {
  currentUserId: string;
  currentUser: ChatUser;
  onCallEnded?: () => void;
}

export function useWebRTC({
  currentUserId,
  currentUser,
  onCallEnded,
}: UseWebRTCProps) {
  const { socket } = useSocket();

  // UI State
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // WebRTC Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Call State Refs (to avoid stale closures in socket listeners)
  const callIdRef = useRef<string | null>(null);
  const isVideoCallRef = useRef(false);
  const otherUserIdRef = useRef<string | null>(null);
  const isEndingCallRef = useRef(false);
  const isInitiatorRef = useRef(false);

  // ICE Candidate Management
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const isRemoteDescriptionSetRef = useRef(false);
  const iceGatheringCompleteRef = useRef(false);

  // Process queued ICE candidates
  const processIceQueue = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const queue = iceCandidateQueueRef.current;

    if (!pc || queue.length === 0) return;

    console.log(`🧊 Processing ${queue.length} queued ICE candidates...`);

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("✅ Added queued ICE candidate");
      } catch (error: any) {
        if (error.name === "OperationError") {
          console.warn("⚠️ Invalid queued candidate, skipping");
        } else {
          console.error("❌ Error adding queued candidate:", error);
        }
      }
    }
    iceCandidateQueueRef.current = [];
  }, []);

  // End call cleanup
  const endCall = useCallback(() => {
    if (isEndingCallRef.current) return;
    isEndingCallRef.current = true;
    console.log("🔴 Ending call...");

    // Notify other peer
    if (socket && otherUserIdRef.current && callIdRef.current) {
      socket.emit("end-call", {
        to: otherUserIdRef.current,
        callId: callIdRef.current,
      });
    }

    // Stop all tracks
    localStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
      console.log(`🛑 Stopped ${track.kind} track`);
    });
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      console.log("🔌 Peer connection closed");
    }

    // Reset all refs
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    screenStreamRef.current = null;
    otherUserIdRef.current = null;
    callIdRef.current = null;
    isInitiatorRef.current = false;
    isVideoCallRef.current = false;
    isRemoteDescriptionSetRef.current = false;
    iceGatheringCompleteRef.current = false;
    iceCandidateQueueRef.current = [];

    // Reset UI state
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus("idle");
    setCallId(null);
    setOtherUser(null);
    setIsScreenSharing(false);
    setIsVideoEnabled(true);
    setIsAudioEnabled(true);
    setError(null);

    // Allow future calls
    setTimeout(() => {
      isEndingCallRef.current = false;
      console.log("✅ Call cleanup complete");
    }, 500);

    onCallEnded?.();
  }, [socket, onCallEnded]);

  // Create peer connection
  const createPeerConnection = useCallback(
    (activeCallId: string) => {
      console.log("🔧 Creating peer connection for Call ID:", activeCallId);

      // Reset ICE state
      isRemoteDescriptionSetRef.current = false;
      iceGatheringCompleteRef.current = false;
      iceCandidateQueueRef.current = [];

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // ICE Candidate Handler
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidateType = event.candidate.type || "unknown";
          console.log(`🧊 Generated local ICE candidate (${candidateType})`);

          if (socket && otherUserIdRef.current) {
            socket.emit("webrtc-ice-candidate", {
              to: otherUserIdRef.current,
              candidate: event.candidate.toJSON(),
              callId: activeCallId,
            });
            console.log(`📤 Sent ICE candidate to ${otherUserIdRef.current}`);
          }
        } else {
          // ICE gathering complete
          console.log("🧊 ICE gathering complete");
          iceGatheringCompleteRef.current = true;
        }
      };

      // Remote Track Handler
      pc.ontrack = (event) => {
        console.log(`📥 Remote ${event.track.kind} track received`);
        if (event.streams && event.streams[0]) {
          console.log("📺 Setting remote stream");
          setRemoteStream(event.streams[0]);
        }
      };

      // Connection State Handler
      pc.onconnectionstatechange = () => {
        console.log(`🔄 Connection state: ${pc.connectionState}`);

        switch (pc.connectionState) {
          case "connected":
            console.log("✅ WebRTC connection established!");
            setCallStatus("connected");
            setError(null);
            break;
          case "failed":
            console.error("❌ Connection failed");
            setError("Connection failed. Check network/firewall.");
            break;
          case "disconnected":
            console.warn("⚠️ Connection disconnected, attempting to reconnect...");
            break;
          case "closed":
            console.log("🔌 Connection closed");
            if (!isEndingCallRef.current) {
              endCall();
            }
            break;
        }
      };

      // ICE Connection State Handler
      pc.oniceconnectionstatechange = () => {
        console.log(`🧊 ICE connection state: ${pc.iceConnectionState}`);

        if (pc.iceConnectionState === "failed") {
          console.error("❌ ICE connection failed - may need TURN server");
        }
      };

      // ICE Gathering State Handler
      pc.onicegatheringstatechange = () => {
        console.log(`🧊 ICE gathering state: ${pc.iceGatheringState}`);
      };

      return pc;
    },
    [socket, endCall]
  );

  // Get user media
  const getUserMedia = useCallback(async (video: boolean, audio: boolean) => {
    try {
      // Reuse existing stream if available
      if (localStreamRef.current) {
        console.log("♻️ Reusing existing media stream");
        return localStreamRef.current;
      }

      console.log(`🎥 Requesting user media - Video: ${video}, Audio: ${audio}`);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          }
          : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log(`✅ Media stream acquired (${stream.getTracks().length} tracks)`);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error: any) {
      console.error("❌ Media access error:", error);
      const errorMsg =
        error.name === "NotAllowedError"
          ? "Camera/microphone access denied"
          : error.name === "NotFoundError"
            ? "No camera/microphone found"
            : "Could not access camera/microphone";
      setError(errorMsg);
      throw error;
    }
  }, []);

  // Start call (initiator)
  const startCall = useCallback(
    async (user: ChatUser, video: boolean = true) => {
      try {
        console.log(`📞 Starting ${video ? "video" : "audio"} call to ${user.username}`);
        setError(null);
        isEndingCallRef.current = false;
        isInitiatorRef.current = true;

        // Generate call ID
        const newCallId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        callIdRef.current = newCallId;
        isVideoCallRef.current = video;

        // Update UI state
        setCallId(newCallId);
        setIsVideoCall(video);
        setOtherUser(user);
        setCallStatus("calling");
        otherUserIdRef.current = user.id;

        // Get media stream
        const stream = await getUserMedia(video, true);

        // Create peer connection
        const pc = createPeerConnection(newCallId);
        peerConnectionRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          console.log(`➕ Adding local ${track.kind} track`);
          pc.addTrack(track, stream);
        });

        // Initiate call via signaling server
        if (socket) {
          socket.emit("initiate-call", {
            to: user.id,
            callId: newCallId,
            isVideoCall: video,
            callerName: currentUser.name || currentUser.username,
            callerImage: currentUser.image,
          });
          console.log("📤 Call initiation sent");
        }
      } catch (error) {
        console.error("❌ Start call error:", error);
        setCallStatus("idle");
        endCall();
      }
    },
    [socket, getUserMedia, createPeerConnection, currentUser, endCall]
  );

  // Answer call (receiver)
  const answerCall = useCallback(
    async (incomingCallId: string, fromUser: ChatUser, video: boolean) => {
      try {
        console.log(`✅ Answering ${video ? "video" : "audio"} call from ${fromUser.username}`);
        setError(null);
        isEndingCallRef.current = false;
        isInitiatorRef.current = false;

        callIdRef.current = incomingCallId;
        isVideoCallRef.current = video;

        setCallId(incomingCallId);
        setIsVideoCall(video);
        setOtherUser(fromUser);
        setCallStatus("ringing");
        otherUserIdRef.current = fromUser.id;

        // Get media stream
        const stream = await getUserMedia(video, true);

        // Create peer connection
        const pc = createPeerConnection(incomingCallId);
        peerConnectionRef.current = pc;

        // Add local tracks
        stream.getTracks().forEach((track) => {
          console.log(`➕ Adding local ${track.kind} track`);
          pc.addTrack(track, stream);
        });

        // Accept call via signaling server
        if (socket) {
          socket.emit("accept-call", {
            to: fromUser.id,
            callId: incomingCallId,
          });
          console.log("📤 Call acceptance sent");
        }
      } catch (error) {
        console.error("❌ Answer call error:", error);
        rejectCall(incomingCallId, fromUser.id);
      }
    },
    [socket, getUserMedia, createPeerConnection]
  );

  // Reject call
  const rejectCall = useCallback(
    (incomingCallId: string, fromUserId: string) => {
      console.log("❌ Rejecting call");

      if (socket) {
        socket.emit("reject-call", {
          to: fromUserId,
          callId: incomingCallId,
        });
      }

      callIdRef.current = null;
      setCallStatus("idle");
      setCallId(null);
      setOtherUser(null);
      setError(null);
    },
    [socket]
  );

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
        console.log(`📹 Video ${track.enabled ? "enabled" : "disabled"}`);
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
        console.log(`🎤 Audio ${track.enabled ? "enabled" : "disabled"}`);
      }
    }
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        console.log("🖥️ Starting screen share...");
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];

        // Replace video track in peer connection
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) {
          await sender.replaceTrack(videoTrack);
          console.log("✅ Screen share track replaced");
        }

        // Handle user stopping screen share from browser UI
        videoTrack.onended = () => {
          console.log("🖥️ Screen share ended by user");
          toggleScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        console.log("🖥️ Stopping screen share...");

        // Switch back to camera
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        const sender = peerConnectionRef.current
          ?.getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
          console.log("✅ Switched back to camera");
        }

        // Stop screen share tracks
        screenStreamRef.current?.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
        setIsScreenSharing(false);
      }
    } catch (error: any) {
      console.error("❌ Screen share error:", error);
      if (error.name === "NotAllowedError") {
        setError("Screen share permission denied");
      }
    }
  }, [isScreenSharing]);

  // Socket event listeners (registered ONCE, use refs to avoid stale closures)
  useEffect(() => {
    if (!socket) return;

    console.log("🔌 Registering WebRTC socket listeners");

    // 1. Call Accepted -> Create and Send Offer
    const handleCallAccepted = async ({ callId: acceptedId, from }: any) => {
      console.log(`📞 Call accepted by ${from} for call ${acceptedId}`);

      if (
        callIdRef.current === acceptedId &&
        peerConnectionRef.current &&
        isInitiatorRef.current
      ) {
        try {
          console.log("📤 Creating offer...");
          const offer = await peerConnectionRef.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideoCallRef.current,
          });

          await peerConnectionRef.current.setLocalDescription(offer);
          console.log("📤 Local description (offer) set");

          socket.emit("webrtc-offer", {
            to: from,
            offer,
            callId: acceptedId,
          });
          console.log(`📤 Offer sent to ${from}`);
        } catch (error) {
          console.error("❌ Error creating/sending offer:", error);
          setError("Failed to create offer");
        }
      } else {
        console.warn("⚠️ Call accepted event ignored (callId mismatch or not initiator)");
      }
    };

    // 2. Offer Received -> Set Remote Description and Send Answer
    const handleOffer = async ({ offer, from, callId: offerId }: any) => {
      console.log(`📥 Received offer from ${from} for call ${offerId}`);

      if (peerConnectionRef.current && callIdRef.current === offerId) {
        try {
          console.log("📥 Setting remote description (offer)...");
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          );
          isRemoteDescriptionSetRef.current = true;
          console.log("✅ Remote description set");

          // Process any queued ICE candidates
          await processIceQueue();

          console.log("📤 Creating answer...");
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          console.log("📤 Local description (answer) set");

          socket.emit("webrtc-answer", {
            to: from,
            answer,
            callId: offerId,
          });
          console.log(`📤 Answer sent to ${from}`);
        } catch (error) {
          console.error("❌ Error handling offer:", error);
          setError("Failed to handle offer");
        }
      } else {
        console.warn("⚠️ Offer ignored (callId mismatch or no peer connection)");
      }
    };

    // 3. Answer Received -> Set Remote Description
    const handleAnswer = async ({ answer, callId: answerId }: any) => {
      console.log(`📥 Received answer for call ${answerId}`);

      if (peerConnectionRef.current && callIdRef.current === answerId) {
        try {
          console.log("📥 Setting remote description (answer)...");
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          isRemoteDescriptionSetRef.current = true;
          console.log("✅ Remote description set");

          // Process any queued ICE candidates
          await processIceQueue();
        } catch (error) {
          console.error("❌ Error handling answer:", error);
          setError("Failed to handle answer");
        }
      } else {
        console.warn("⚠️ Answer ignored (callId mismatch or no peer connection)");
      }
    };

    // 4. ICE Candidate Received -> Add or Queue
    const handleIceCandidate = async ({ candidate, callId: candidateId }: any) => {
      console.log(`📨 Received remote ICE candidate for call ${candidateId}`);

      if (peerConnectionRef.current && callIdRef.current === candidateId) {
        if (isRemoteDescriptionSetRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
            console.log("✅ ICE candidate added immediately");
          } catch (error: any) {
            if (error.name === "OperationError") {
              console.warn("⚠️ Invalid ICE candidate, skipping");
            } else {
              console.error("❌ Error adding ICE candidate:", error);
            }
          }
        } else {
          console.log("🧊 Queueing ICE candidate (remote description not set yet)");
          iceCandidateQueueRef.current.push(candidate);
        }
      } else {
        console.warn("⚠️ ICE candidate ignored (callId mismatch or no peer connection)");
      }
    };

    // 5. Call Rejected
    const handleCallRejected = () => {
      console.log("❌ Call rejected by peer");
      setError("Call rejected");
      endCall();
    };

    // 7. Call Ended
    const handleCallEnded = () => {
      console.log("📵 Call ended by peer");
      endCall();
    };

    // Register listeners
    socket.on("call-accepted", handleCallAccepted);
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
    socket.on("call-rejected", handleCallRejected);
    socket.on("call-ended", handleCallEnded);

    // Cleanup listeners
    return () => {
      console.log("🔌 Cleaning up WebRTC socket listeners");
      socket.off("call-accepted", handleCallAccepted);
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);
      socket.off("call-rejected", handleCallRejected);
      socket.off("call-ended", handleCallEnded);
    };
  }, [socket, processIceQueue, endCall]);

  return {
    // State
    callStatus,
    callId,
    isVideoCall,
    isVideoEnabled,
    isAudioEnabled,
    isScreenSharing,
    otherUser,
    error,
    localStream,
    remoteStream,

    // Actions
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleVideo,
    toggleAudio,
    toggleScreenShare,
  };
}