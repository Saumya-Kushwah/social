import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "react-hot-toast";
import { syncUser, getUserByClerkId } from "@/actions/user.action";
import SocketProvider from "@/components/SocketProvider";
import CallProvider from "@/components/CallProvider";
import { currentUser } from "@clerk/nextjs/server";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Socially",
  description: "A modern social media application powered by Next.js",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkUser = await currentUser();
  let dbUserId: string | null = null;

  if (clerkUser) {
    await syncUser();
    const dbUser = await getUserByClerkId(clerkUser.id);
    dbUserId = dbUser?.id || null;
  }

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SocketProvider userId={dbUserId}>
              <CallProvider currentUserId={dbUserId}>
                <div className="min-h-screen">
                  <Navbar />

                  <main className="py-8">
                    <div className="max-w-7xl mx-auto px-4">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="hidden lg:block lg:col-span-3">
                          <Sidebar />
                        </div>
                        <div className="lg:col-span-9">{children}</div>
                      </div>
                    </div>
                  </main>
                </div>
                <Toaster />
              </CallProvider>
            </SocketProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}