'use client';

import { ChevronLeft, Phone, Video } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User } from '@prisma/client';
import { useCall } from './CallProvider'; // Import the useCall hook

interface ChatHeaderProps {
  otherUser: User;
  onBack: () => void;
}

export function ChatHeader({ otherUser, onBack }: ChatHeaderProps) {
  // Get the call functions from the CallProvider
  const { startVoiceCall, startVideoCall } = useCall();

  const userName = otherUser.name || 'Chat';
  const userImage = otherUser.image || undefined;

  // Handlers for starting calls
  const handleVoiceCall = () => {
    startVoiceCall(otherUser);
  };

  const handleVideoCall = () => {
    startVideoCall(otherUser);
  };

  return (
    <div className="flex items-center gap-3 border-b p-4">
      {/* Back Button (Mobile) */}
      <Button onClick={onBack} variant="ghost" size="icon" className="md:hidden">
        <ChevronLeft className="h-6 w-6" />
        <span className="sr-only">Back</span>
      </Button>

      {/* Avatar */}
      <Avatar>
        <AvatarImage src={userImage} />
        <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      {/* User Info */}
      <div className="flex-1 flex flex-col">
        <p className="font-semibold text-primary">{userName}</p>
      </div>

      {/* Call Buttons */}
      <div className="ml-auto flex items-center gap-2">
        <Button
          onClick={handleVoiceCall}
          variant="ghost"
          size="icon"
          className="rounded-full"
        >
          <Phone className="h-5 w-5" />
          <span className="sr-only">Start voice call</span>
        </Button>
        <Button
          onClick={handleVideoCall}
          variant="ghost"
          size="icon"
          className="rounded-full"
        >
          <Video className="h-5 w-5" />
          <span className="sr-only">Start video call</span>
        </Button>
      </div>
    </div>
  );
}