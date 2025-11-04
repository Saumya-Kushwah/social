import { clerkMiddleware } from '@clerk/nextjs/server';

// Define public routes
export const publicRoutes = [
  '/sign-in', 
  '/sign-up',
  '/api/uploadthing(.*)', // <-- Add this line
  '/api/webhooks(.*)'    // <-- Also add webhooks for services like Stripe
];

// This middleware automatically uses the publicRoutes array
// to protect all other routes.
export default clerkMiddleware();

export const config = {
  // This matcher runs the middleware on all routes
  // except for static files and internal Next.js assets
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};