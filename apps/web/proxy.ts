import { clerkMiddleware } from '@clerk/nextjs/server';

export const proxy = clerkMiddleware();

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/'],
};
