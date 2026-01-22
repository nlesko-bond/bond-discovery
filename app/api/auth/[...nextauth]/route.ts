import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, isAuthConfigured } from '@/lib/auth';

// Only create handler if auth is configured
const handler = isAuthConfigured 
  ? NextAuth(authOptions)
  : () => NextResponse.json({ error: 'Auth not configured' }, { status: 503 });

export { handler as GET, handler as POST };
