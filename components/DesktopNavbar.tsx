"use client";

import { BellIcon, HomeIcon, UserIcon, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SignInButton, UserButton } from "@clerk/nextjs";
import ModeToggle from "./ModeToggle";
import { useEffect, useState } from "react";
import { getTotalUnreadCount } from "@/actions/chat.action";
import { useSocket } from "./SocketProvider";

interface DesktopNavbarProps {
  user: {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
    emailAddresses: Array<{ emailAddress: string }>;
  } | null;
}

export default function DesktopNavbar({ user }: DesktopNavbarProps) {
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

  return (
    <div className="hidden md:flex items-center space-x-4">
      <ModeToggle />

      <Button variant="ghost" className="flex items-center gap-2" asChild>
        <Link href="/">
          <HomeIcon className="w-4 h-4" />
          <span className="hidden lg:inline">Home</span>
        </Link>
      </Button>

      {user ? (
        <>
          <Button variant="ghost" className="flex items-center gap-2 relative" asChild>
            <Link href="/messages">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden lg:inline">Messages</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <Button variant="ghost" className="flex items-center gap-2" asChild>
            <Link href="/notifications">
              <BellIcon className="w-4 h-4" />
              <span className="hidden lg:inline">Notifications</span>
            </Link>
          </Button>

          <Button variant="ghost" className="flex items-center gap-2" asChild>
            <Link
              href={`/profile/${
                user.username ?? user.emailAddresses[0].emailAddress.split("@")[0]
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden lg:inline">Profile</span>
            </Link>
          </Button>

          <UserButton />
        </>
      ) : (
        <SignInButton mode="modal">
          <Button variant="default">Sign In</Button>
        </SignInButton>
      )}
    </div>
  );
}