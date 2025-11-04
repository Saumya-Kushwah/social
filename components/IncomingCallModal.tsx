"use client";

import { Phone, PhoneOff, Video, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface IncomingCallModalProps {
  callerName: string;
  callerImage: string | null;
  isVideoCall: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({
  callerName,
  callerImage,
  isVideoCall,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-card rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border">
        <div className="flex flex-col items-center text-center">
          {/* Caller Avatar */}
          <div className="relative mb-6">
            <Avatar className="w-32 h-32 ring-4 ring-primary/20">
              <AvatarImage src={callerImage || ""} alt={callerName} />
              <AvatarFallback className="text-4xl">
                {callerName?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            
            {/* Call Type Icon */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary rounded-full p-3">
              {isVideoCall ? (
                <Video className="w-5 h-5 text-primary-foreground" />
              ) : (
                <PhoneCall className="w-5 h-5 text-primary-foreground" />
              )}
            </div>
          </div>

          {/* Caller Info */}
          <h2 className="text-2xl font-bold mb-2">{callerName}</h2>
          <p className="text-muted-foreground mb-8">
            Incoming {isVideoCall ? "video" : "voice"} call...
          </p>

          {/* Action Buttons */}
          <div className="flex gap-6">
            {/* Reject Button */}
            <Button
              onClick={onReject}
              size="lg"
              variant="destructive"
              className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
            >
              <PhoneOff className="w-6 h-6" />
            </Button>

            {/* Accept Button */}
            <Button
              onClick={onAccept}
              size="lg"
              className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
            >
              <Phone className="w-6 h-6" />
            </Button>
          </div>

          {/* Hint Text */}
          <p className="text-xs text-muted-foreground mt-6">
            Make sure your camera and microphone are connected
          </p>
        </div>
      </div>
    </div>
  );
}