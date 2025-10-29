"use client";

import { useState } from "react";
import { X, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ChatUser } from "@/types/chat.types";
import { getOrCreateConversation } from "@/actions/chat.action";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface NewChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mutualFollowers: ChatUser[];
  currentUserId: string;
}

export default function NewChatDialog({
  isOpen,
  onClose,
  mutualFollowers,
  currentUserId,
}: NewChatDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  if (!isOpen) return null;

  const filteredUsers = mutualFollowers.filter(
    (user) =>
      user.id !== currentUserId &&
      (user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleUserSelect = async (user: ChatUser) => {
    setLoading(user.id);
    try {
      const { conversationId } = await getOrCreateConversation(user.id);
      router.push(`/messages/${conversationId}`);
      onClose();
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to start conversation. Make sure you both follow each other.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">New Message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search mutual followers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-accent rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {mutualFollowers.length === 0 ? (
                <>
                  <p className="mb-2">No mutual followers yet</p>
                  <p className="text-sm">
                    Follow users who also follow you back to start chatting
                  </p>
                </>
              ) : (
                <p>No users found</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  disabled={loading === user.id}
                  className="w-full p-4 hover:bg-accent transition-colors flex items-center gap-3 text-left disabled:opacity-50"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage
                      src={user.image || ""}
                      alt={user.username || "User avatar"}
                    />
                    <AvatarFallback>
                      {user.name?.[0] ||
                        user.username?.[0]?.toUpperCase() ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {user.name || user.username || "User"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{user.username || "user"}
                    </p>
                  </div>
                  {loading === user.id && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}