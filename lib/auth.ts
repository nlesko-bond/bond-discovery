import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Allowed email domains for admin access
const ALLOWED_DOMAINS = ['bondsports.co'];

// Check if auth is configured
export const isAuthConfigured = !!(
  process.env.NEXTAUTH_SECRET &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  providers: isAuthConfigured ? [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ] : [],
  
  callbacks: {
    async signIn({ user, account }) {
      // Only allow specific email domains
      if (user.email) {
        const domain = user.email.split('@')[1];
        if (ALLOWED_DOMAINS.includes(domain)) {
          return true;
        }
      }
      
      // Reject sign-in for unauthorized domains
      return false;
    },
    
    async session({ session, token }) {
      // Add user ID to session
      if (session.user) {
        session.user.id = token.sub || '';
      }
      return session;
    },
    
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  
  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  
  secret: process.env.NEXTAUTH_SECRET,
};

// Type augmentation for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
