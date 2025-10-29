'use client';

import { cn } from '@/lib/utils';
import type { MessageWithSender } from '@/types/chat.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNowStrict } from 'date-fns';

interface MessageItemProps {
  message: MessageWithSender;
  isOwnMessage: boolean;
}

export function MessageItem({ message, isOwnMessage }: MessageItemProps) {
  const sender = message.sender;
  const senderName = sender.name || 'User';
  
  // Format the time (e.g., "5m ago")
  const timestamp = formatDistanceToNowStrict(new Date(message.createdAt), {
    addSuffix: true,
  });

  return (
    <div className={cn('flex gap-3', isOwnMessage && 'justify-end')}>
      <div className={cn(isOwnMessage && 'order-2')}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={sender.image || undefined} />
          <AvatarFallback>{senderName.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </div>
      <div
        className={cn(
          'flex flex-col gap-1',
          isOwnMessage && 'items-end'
        )}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-primary">{senderName}</p>
          <p className="text-xs text-muted-foreground">{timestamp}</p>
        </div>
        <div
          className={cn(
            'max-w-xs rounded-lg px-3 py-2 text-sm md:max-w-md',
            isOwnMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          )}
        >
          <p>{message.content}</p>
        </div>
        {/* Optional: Add "Seen" status here */}
      </div>
    </div>
  );
}