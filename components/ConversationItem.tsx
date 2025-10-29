"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import type { ConversationWithDetails } from "@/types/chat.types";

interface ConversationItemProps {
  conversation: ConversationWithDetails;
  onClick: () => void;
}

export default function ConversationItem({ conversation, onClick }: ConversationItemProps) {
  const { otherUser, lastMessage, unreadCount } = conversation;

  return (
    <button
      onClick={onClick}
      className="w-full p-4 hover:bg-accent transition-colors flex items-center gap-3 text-left"
    >
      <div className="relative">
        <Avatar className="w-12 h-12">
          <AvatarImage src={otherUser.image || ""} alt={otherUser.username} />
          <AvatarFallback>
            {otherUser.name?.[0] || otherUser.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {otherUser.online && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="font-medium truncate">
            {otherUser.name || otherUser.username}
          </p>
          {lastMessage && (
            <span className="text-xs text-muted-foreground ml-2">
              {formatDistanceToNow(new Date(lastMessage.createdAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground truncate">
            {lastMessage ? lastMessage.content : "Start a conversation"}
          </p>
          {unreadCount > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-medium">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}