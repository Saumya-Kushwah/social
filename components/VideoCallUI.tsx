"use client";

import { useEffect, useRef } from "react";
import {
  X,
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

  // Setup local video with better error handling
  useEffect(() => {
    const videoElement = localVideoRef.current;
    
    if (videoElement && localStream) {
      console.log("🎬 Attaching local stream to video element");
      console.log("Local stream tracks:", localStream.getTracks().map(t => `${t.kind}: ${t.enabled}`));
      
      // Critical: Set srcObject directly
      videoElement.srcObject = localStream;
      
      // Ensure video plays
      videoElement.play().catch((err) => {
        console.error("❌ Error playing local video:", err);
      });

      // Debug: Check if video is actually playing
      videoElement.onloadedmetadata = () => {
        console.log("✅ Local video metadata loaded", {
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          readyState: videoElement.readyState
        });
      };

      videoElement.onplay = () => {
        console.log("▶️ Local video started playing");
      };
    }

    return () => {
      if (videoElement) {
        console.log("🧹 Cleaning up local video");
        videoElement.srcObject = null;
      }
    };
  }, [localStream]);

  // Setup remote video with better error handling
  useEffect(() => {
    const videoElement = remoteVideoRef.current;
    
    if (videoElement && remoteStream) {
      console.log("🎬 Attaching remote stream to video element");
      console.log("Remote stream tracks:", remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled} (readyState: ${t.readyState})`));
      
      // Critical: Set srcObject directly
      videoElement.srcObject = remoteStream;
      
      // Ensure video plays
      videoElement.play().catch((err) => {
        console.error("❌ Error playing remote video:", err);
        // Try again after a short delay
        setTimeout(() => {
          videoElement.play().catch(console.error);
        }, 100);
      });

      // Debug: Check if video is actually playing
      videoElement.onloadedmetadata = () => {
        console.log("✅ Remote video metadata loaded", {
          videoWidth: videoElement.videoWidth,
          videoHeight: videoElement.videoHeight,
          readyState: videoElement.readyState
        });
        
        // Force play after metadata loads
        if (videoElement.paused) {
          videoElement.play().catch(console.error);
        }
      };

      videoElement.onplay = () => {
        console.log("▶️ Remote video started playing");
      };

      videoElement.onerror = (e) => {
        console.error("❌ Remote video error:", e);
      };

      // Check if video has dimensions after a short delay
      setTimeout(() => {
        if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
          console.error("⚠️ Remote video has no dimensions! Dimensions:", {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight,
            srcObject: videoElement.srcObject,
            tracks: remoteStream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState,
              muted: t.muted
            }))
          });
        } else {
          console.log("✅ Remote video rendering with dimensions:", {
            width: videoElement.videoWidth,
            height: videoElement.videoHeight
          });
        }
      }, 1000);

      // Additional debug for track state changes
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
    }

    return () => {
      if (videoElement) {
        console.log("🧹 Cleaning up remote video");
        videoElement.srcObject = null;
      }
    };
  }, [remoteStream]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative bg-gray-900">
        {remoteStream && callStatus === "connected" ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              style={{ 
                transform: 'scaleX(1)', // Don't mirror remote video
                backgroundColor: '#1a1a1a' 
              }}
            />
            {/* Fallback overlay if video doesn't load */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-white/50 text-center" id="remote-video-fallback">
                {/* This will be hidden by CSS once video plays */}
              </div>
            </div>
          </>
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

            {/* Error display */}
            {error && (
              <div className="mt-4 flex items-center gap-2 bg-red-500/20 border border-red-500 rounded-lg px-4 py-2 max-w-md">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && (
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20">
            {isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ 
                  transform: 'scaleX(-1)', // Mirror local video
                  backgroundColor: '#1a1a1a'
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                <VideoOff className="w-8 h-8 text-white/50" />
              </div>
            )}
            
            {/* Muted indicator */}
            {!isAudioEnabled && (
              <div className="absolute bottom-2 left-2 bg-red-500 rounded-full p-1">
                <MicOff className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
        )}

        {/* Call Info */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
          <p className="text-white text-sm flex items-center gap-2">
            {callStatus === "connected" ? (
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
        {callStatus === "connected" && remoteStream && (
          <div className="absolute top-16 left-4 bg-black/30 backdrop-blur-sm px-3 py-1 rounded-lg">
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
          {/* Toggle Audio */}
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

          {/* Toggle Video */}
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

          {/* End Call */}
          <Button
            onClick={onEndCall}
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
            title="End call"
          >
            <Phone className="w-6 h-6 transform rotate-[135deg]" />
          </Button>

          {/* Screen Share */}
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

        {/* Hints */}
        <div className="mt-4 text-center">
          <p className="text-white/50 text-xs">
            {callStatus === "connected"
              ? "Call is active"
              : "Establishing connection..."}
          </p>
        </div>
      </div>

      {/* Debug overlay (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-20 left-4 bg-black/70 text-white text-xs p-2 rounded max-w-xs">
          <div>Status: {callStatus}</div>
          <div>Local Stream: {localStream ? '✅' : '❌'}</div>
          <div>Remote Stream: {remoteStream ? '✅' : '❌'}</div>
          <div>Video: {isVideoEnabled ? '✅' : '❌'}</div>
          <div>Audio: {isAudioEnabled ? '✅' : '❌'}</div>
          {remoteStream && (
            <div>
              Remote Tracks: {remoteStream.getTracks().map(t => 
                `${t.kind}(${t.readyState})`
              ).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

<style jsx global>{`
  /* Hide the fallback text once video is playing */
  video:not([src=""]) ~ #remote-video-fallback {
    display: none;
  }
`}</style>