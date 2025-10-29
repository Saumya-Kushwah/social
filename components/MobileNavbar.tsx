"use client";

import { BellIcon, HomeIcon, UserIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import ModeToggle from "./ModeToggle";
import { useEffect, useState } from "react";
import { getTotalUnreadCount } from "@/actions/chat.action";
import { useSocket } from "./SocketProvider";

export default function MobileNavbar() {
  const { user, isLoaded } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();

  useEffect(() => {
    if (!user) return;

    // Fetch initial unread count
    getTotalUnreadCount().then(setUnreadCount);
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleNewMessage = () => {
      getTotalUnreadCount().then(setUnreadCount);
    };

    const handleMessageRead = () => {
      getTotalUnreadCount().then(setUnreadCount);
    };

    socket.on("new-message", handleNewMessage);
    socket.on("message-read", handleMessageRead);

    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("message-read", handleMessageRead);
    };
  }, [socket, user]);

  if (!isLoaded) return null;

  return (
    <div className="md:hidden flex items-center space-x-2">
      <ModeToggle />

      <Button variant="ghost" size="icon" asChild>
        <Link href="/">
          <HomeIcon className="w-5 h-5" />
        </Link>
      </Button>

      {user ? (
        <>
          <Button variant="ghost" size="icon" className="relative" asChild>
            <Link href="/messages">
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium text-[10px]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <Button variant="ghost" size="icon" asChild>
            <Link href="/notifications">
              <BellIcon className="w-5 h-5" />
            </Link>
          </Button>

          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`/profile/${
                user.username ?? user.emailAddresses[0].emailAddress.split("@")[0]
              }`}
            >
              <UserIcon className="w-5 h-5" />
            </Link>
          </Button>

          <UserButton />
        </>
      ) : (
        <SignInButton mode="modal">
          <Button variant="default" size="sm">
            Sign In
          </Button>
        </SignInButton>
      )}
    </div>
  );
}