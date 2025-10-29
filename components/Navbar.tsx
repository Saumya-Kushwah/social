import Link from "next/link";
import DesktopNavbar from "./DesktopNavbar";
import MobileNavbar from "./MobileNavbar";
import { currentUser } from "@clerk/nextjs/server";
import { syncUser, getUserByClerkId } from "@/actions/user.action";

async function Navbar() {
  const clerkUser = await currentUser();
  let dbUser = null;

  if (clerkUser) {
    await syncUser();
    dbUser = await getUserByClerkId(clerkUser.id);
  }

 const userData = dbUser
  ? {
      id: dbUser.id,
      username: dbUser.username,
      name: dbUser.name,     
      image: dbUser.image,
      // This creates { emailAddress: string }[]
      emailAddresses:
        clerkUser?.emailAddresses.map((email) => ({
          emailAddress: email.emailAddress,
        })) || [],
    }
  : null;

  return (
    <nav className="sticky top-0 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-primary font-mono tracking-wider"
            >
              Socially
            </Link>
          </div>

          <DesktopNavbar user={userData} />
          <MobileNavbar />
        </div>
      </div>
    </nav>
  );
}

export default Navbar;