"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Phone,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatUser } from "@/types/chat.types";

interface VideoCallUIProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  callStatus: "calling" | "ringing" | "connected" | "ended";
  otherUser: ChatUser;
  error?: string | null;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleScreenShare: () => void;
  onEndCall: () => void;
}

export default function VideoCallUI({
  localStream,
  remoteStream,
  isVideoEnabled,
  isAudioEnabled,
  isScreenSharing,
  callStatus,
  otherUser,
  error,
  onToggleVideo,
  onToggleAudio,
  onToggleScreenShare,
  onEndCall,
}: VideoCallUIProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [localVideoReady, setLocalVideoReady] = useState(false);
  const remoteStreamAttachedRef = useRef(false);
  const localStreamAttachedRef = useRef(false);

  // Setup local video - ONLY ONCE per stream
  useEffect(() => {
    const videoElement = localVideoRef.current;
    
    if (!videoElement || !localStream) {
      return;
    }

    // Prevent re-attaching the same stream
    if (localStreamAttachedRef.current && videoElement.srcObject === localStream) {
      console.log("⏭️ Local stream already attached, skipping");
      return;
    }

    console.log("🎬 Attaching local stream to video element");
    localStreamAttachedRef.current = true;
    
    videoElement.srcObject = localStream;
    videoElement.muted = true; // Critical: local must be muted
    
    videoElement.onloadedmetadata = () => {
      console.log("✅ Local video metadata loaded:", {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
      });
      setLocalVideoReady(true);
      
      // Play video after metadata loads
      videoElement.play().catch((err) => {
        console.error("❌ Error playing local video:", err);
      });
    };

    videoElement.onplay = () => {
      console.log("▶️ Local video playing");
    };

    return () => {
      console.log("🧹 Cleaning up local video");
      localStreamAttachedRef.current = false;
      setLocalVideoReady(false);
    };
  }, [localStream]); // Only depend on localStream

  // Setup remote video - ONLY ONCE per stream
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    
    if (!videoElement || !remoteStream) {
      return;
    }

    // Prevent re-attaching the same stream
    if (remoteStreamAttachedRef.current && videoElement.srcObject === remoteStream) {
      console.log("⏭️ Remote stream already attached, skipping");
      return;
    }

    console.log("🎬 Attaching remote stream to video element");
    console.log("Remote stream tracks:", remoteStream.getTracks().map(t => 
      `${t.kind}: ${t.enabled} (${t.readyState})`
    ));
    
    remoteStreamAttachedRef.current = true;
    
    videoElement.srcObject = remoteStream;
    videoElement.muted = false; // Remote should not be muted
    
    videoElement.onloadedmetadata = () => {
      console.log("✅ Remote video metadata loaded:", {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
      });
      setRemoteVideoReady(true);
      
      // Play video after metadata loads
      videoElement.play().catch((err) => {
        console.error("❌ Error playing remote video:", err);
        // Retry after delay
        setTimeout(() => {
          videoElement.play().catch(console.error);
        }, 500);
      });
    };

    videoElement.onplay = () => {
      console.log("▶️ Remote video playing");
    };

    videoElement.onerror = (e) => {
      console.error("❌ Remote video error:", e);
    };

    // Monitor track states
    remoteStream.getTracks().forEach(track => {
      track.onended = () => {
        console.warn(`⚠️ Remote ${track.kind} track ended`);
      };
      track.onmute = () => {
        console.warn(`🔇 Remote ${track.kind} track muted`);
      };
      track.onunmute = () => {
        console.log(`🔊 Remote ${track.kind} track unmuted`);
      };
    });

    // Check video dimensions after a delay
    const checkTimer = setTimeout(() => {
      if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        console.error("⚠️ Remote video has no dimensions after 2s!");
        console.error("Track states:", remoteStream.getTracks().map(t => ({
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          muted: t.muted
        })));
      } else {
        console.log("✅ Remote video rendering:", {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight
        });
      }
    }, 2000);

    return () => {
      console.log("🧹 Cleaning up remote video");
      remoteStreamAttachedRef.current = false;
      setRemoteVideoReady(false);
      clearTimeout(checkTimer);
    };
  }, [remoteStream]); // Only depend on remoteStream

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-gray-900">
        {remoteStream && callStatus === "connected" ? (
          <div className="relative w-full h-full">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ 
                transform: 'scaleX(1)',
                backgroundColor: '#1a1a1a',
              }}
            />
            
            {/* Show loading state if video not ready */}
            {!remoteVideoReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                  <p className="text-white/70">Loading video...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Avatar className="w-32 h-32 mb-4">
              <AvatarImage src={otherUser.image || ""} alt={otherUser.name || ""} />
              <AvatarFallback className="text-4xl">
                {otherUser.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <p className="text-white text-2xl font-semibold mb-2">
              {otherUser.name || otherUser.username}
            </p>
            <p className="text-white/70">
              {callStatus === "calling" && "Calling..."}
              {callStatus === "ringing" && "Ringing..."}
              {callStatus === "connected" && "Connecting video..."}
            </p>

            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg px-4 py-2 max-w-md">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && callStatus !== "ended" && (
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 z-10">
            {isVideoEnabled ? (
              <div className="relative w-full h-full">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ 
                    transform: 'scaleX(-1)',
                    backgroundColor: '#1a1a1a'
                  }}
                />
                
                {/* Loading state for local video */}
                {!localVideoReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <VideoOff className="w-8 h-8 text-white/50" />
              </div>
            )}
            
            {!isAudioEnabled && (
              <div className="absolute bottom-2 left-2 bg-red-500 rounded-full p-1">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        )}

        {/* Call Info */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg z-10">
          <p className="text-white text-sm flex items-center gap-2">
            {callStatus === "connected" && remoteVideoReady ? (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Connected
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Connecting...
              </>
            )}
          </p>
        </div>

        {/* Connection Status */}
        {callStatus === "connected" && (
          <div className="absolute top-16 left-4 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-lg z-10">
            <p className="text-white/80 text-xs flex items-center gap-2">
              {isScreenSharing ? (
                <>
                  <Monitor className="w-3 h-3" />
                  Screen sharing
                </>
              ) : (
                <>
                  <Video className="w-3 h-3" />
                  Video call
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gradient-to-t from-black/90 to-transparent">
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={onToggleAudio}
            size="lg"
            variant={isAudioEnabled ? "secondary" : "destructive"}
            className="rounded-full w-14 h-14"
            title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {isAudioEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </Button>

          <Button
            onClick={onToggleVideo}
            size="lg"
            variant={isVideoEnabled ? "secondary" : "destructive"}
            className="rounded-full w-14 h-14"
            title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {isVideoEnabled ? (
              <Video className="w-6 h-6" />
            ) : (
              <VideoOff className="w-6 h-6" />
            )}
          </Button>

          <Button
            onClick={onEndCall}
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
            title="End call"
          >
            <Phone className="w-6 h-6 transform rotate-[135deg]" />
          </Button>

          <Button
            onClick={onToggleScreenShare}
            size="lg"
            variant={isScreenSharing ? "default" : "secondary"}
            className="rounded-full w-14 h-14"
            title={isScreenSharing ? "Stop sharing" : "Share screen"}
            disabled={callStatus !== "connected"}
          >
            <Monitor className="w-6 h-6" />
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-white/50 text-xs">
            {callStatus === "connected" && remoteVideoReady
              ? "Call is active"
              : "Establishing connection..."}
          </p>
        </div>
      </div>

      {/* Debug overlay */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-24 left-4 bg-black/80 text-white text-xs p-3 rounded-lg max-w-xs font-mono z-20">
          <div className="font-bold mb-2">Debug Info:</div>
          <div>Status: {callStatus}</div>
          <div>Local Stream: {localStream ? '✅' : '❌'}</div>
          <div>Local Ready: {localVideoReady ? '✅' : '❌'}</div>
          <div>Remote Stream: {remoteStream ? '✅' : '❌'}</div>
          <div>Remote Ready: {remoteVideoReady ? '✅' : '❌'}</div>
          <div>Video: {isVideoEnabled ? '✅' : '❌'}</div>
          <div>Audio: {isAudioEnabled ? '✅' : '❌'}</div>
          {remoteStream && (
            <div className="mt-1">
              Tracks: {remoteStream.getTracks().map(t => 
                `${t.kind}(${t.readyState})`
              ).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}