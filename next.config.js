/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  experimental: {
    // Next 14: load from node_modules instead of webpack vendor chunks (avoids missing
    // `.next/server/vendor-chunks/@supabase.js` after interrupted compiles / iCloud on .next).
    serverComponentsExternalPackages: ['pg', '@supabase/supabase-js'],
  },
  
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: 'Bond Discovery',
  },
  
  // Headers for caching and security
  async headers() {
    return [
      // Discovery pages - cache with revalidation
      {
        source: '/:slug((?!admin|api|embed|form-responses|_next).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      // Embed pages - allow iframe embedding
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors *",
          },
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      // Static assets - long cache
      {
        source: '/:path*.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
