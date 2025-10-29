'use client';

import { ChevronLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User } from '@prisma/client';

interface ChatHeaderProps {
  otherUser: User;
  onBack: () => void;
}

export function ChatHeader({ otherUser, onBack }: ChatHeaderProps) {
  const userName = otherUser.name || 'Chat';
  const userImage = otherUser.image || undefined;

  return (
    <div className="flex items-center gap-3 border-b p-4">
      <Button onClick={onBack} variant="ghost" size="icon" className="md:hidden">
        <ChevronLeft className="h-6 w-6" />
        <span className="sr-only">Back</span>
      </Button>
      <Avatar>
        <AvatarImage src={userImage} />
        <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <p className="font-semibold text-primary">{userName}</p>
        {/* You can add a presence status here (e.g., "Active now") */}
        {/* <p className="text-xs text-green-500">Active now</p> */}
      </div>
    </div>
  );
}