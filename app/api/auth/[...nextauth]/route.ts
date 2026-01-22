import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// Allowed email domains for admin access
const ALLOWED_DOMAINS = ['bondsports.co'];

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        const domain = user.email.split('@')[1];
        if (ALLOWED_DOMAINS.includes(domain)) {
          return true;
        }
      }
      return false;
    },
    
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub || '';
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
    maxAge: 7 * 24 * 60 * 60,
  },
  
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
