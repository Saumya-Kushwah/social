// components/NavbarAuth.tsx
"use client";

import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { BellIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import MessageButton from "./MessageButton";

export default function NavbarAuth() {
  const { isSignedIn, user } = useUser();

  // Show this if the user is not logged in
  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <Button variant="default">Sign In</Button>
      </SignInButton>
    );
  }

  // Show this if the user IS logged in
  return (
    <>
      <Button variant="ghost" className="flex items-center gap-2" asChild>
        <Link href="/notifications">
          <BellIcon className="w-4 h-4" />
          <span className="hidden lg:inline">Notifications</span>
        </Link>
      </Button>

      <MessageButton onClick={() => {
        // This will be handled inside MessageButton
      }} />

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
  );
}