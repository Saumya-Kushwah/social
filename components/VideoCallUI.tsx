"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, Monitor, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatUser } from "@/types/chat.types";

interface VideoCallUIProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isScreenSharing: boolean;
  callStatus: "calling" | "ringing" | "connected" | "ended" | "idle";
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
  
  // Debug state to verify stream tracks (Remove in production if needed)
  const [debugInfo, setDebugInfo] = useState<string>("");

  // 1. Handle Remote Stream (The other person)
  useEffect(() => {
    // If we have a ref and a stream, attach it immediately
    if (remoteVideoRef.current && remoteStream) {
        console.log("📺 UI: Attaching remote stream directly");
        const video = remoteVideoRef.current;
        
        video.srcObject = remoteStream;
        
        // Debugging info
        const tracks = remoteStream.getTracks();
        setDebugInfo(`Remote: ${tracks.length} tracks (${tracks.map(t => t.kind).join(', ')})`);

        // Force play
        video.play().catch(e => {
            console.error("Remote video autoplay blocked:", e);
            setDebugInfo(prev => prev + " | Autoplay blocked");
        });
    } else {
        setDebugInfo("No remote stream available yet");
    }
  }, [remoteStream]);

  // 2. Handle Local Stream (You)
  useEffect(() => {
    if (localVideoRef.current && localStream) {
        const video = localVideoRef.current;
        // Only re-assign if changed to avoid flicker
        if (video.srcObject !== localStream) {
            video.srcObject = localStream;
            video.muted = true; // Always mute local
            video.play().catch(console.error);
        }
    }
  }, [localStream]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* REMOTE VIDEO AREA */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden flex items-center justify-center">
        
        {/* The actual video element - Always render if stream exists */}
        {remoteStream ? (
             <video
               ref={remoteVideoRef}
               autoPlay
               playsInline
               className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover'}`}
             />
        ) : (
            /* Fallback UI when no stream */
            <div className="flex flex-col items-center justify-center z-10">
                <Avatar className="w-32 h-32 mb-6 ring-4 ring-white/10">
                <AvatarImage src={otherUser.image || ""} />
                <AvatarFallback className="text-4xl">{otherUser.name?.[0]}</AvatarFallback>
                </Avatar>
                <h3 className="text-white text-2xl font-bold">{otherUser.name}</h3>
                <p className="text-white/60 animate-pulse mt-2 capitalize">
                    {callStatus === 'connected' ? 'Waiting for video...' : `${callStatus}...`}
                </p>
            </div>
        )}

        {/* DEBUG OVERLAY (Top Left) - Helps confirm if tracks exist */}
        <div className="absolute top-20 left-4 bg-black/50 text-white text-[10px] p-2 rounded pointer-events-none z-50 font-mono">
           Status: {callStatus} <br/>
           Debug: {debugInfo}
        </div>
      </div>

      {/* LOCAL VIDEO (PIP) */}
      {localStream && (
        <div className="absolute top-4 right-4 w-32 md:w-48 aspect-[3/4] bg-black rounded-xl overflow-hidden shadow-2xl border border-white/20 z-20">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
          {!isVideoEnabled && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <VideoOff className="text-white" />
             </div>
          )}
        </div>
      )}

      {/* CONTROLS */}
      <div className="bg-gray-950 p-6 pb-8">
        <div className="flex items-center justify-center gap-6">
          <Button onClick={onToggleAudio} variant={isAudioEnabled ? "secondary" : "destructive"} size="icon" className="h-14 w-14 rounded-full">
            {isAudioEnabled ? <Mic /> : <MicOff />}
          </Button>
          <Button onClick={onToggleVideo} variant={isVideoEnabled ? "secondary" : "destructive"} size="icon" className="h-14 w-14 rounded-full">
            {isVideoEnabled ? <Video /> : <VideoOff />}
          </Button>
          <Button onClick={onEndCall} variant="destructive" size="icon" className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-700">
            <Phone className="rotate-[135deg]" />
          </Button>
          <Button onClick={onToggleScreenShare} variant={isScreenSharing ? "default" : "secondary"} size="icon" className="h-14 w-14 rounded-full" disabled={callStatus !== 'connected'}>
             <Monitor />
          </Button>
        </div>
      </div>
    </div>
  );
}