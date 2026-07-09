/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Dev-only workarounds for Next 14 bugs that cause `.next/` cache corruption
  // mid-session, breaking the server with MODULE_NOT_FOUND, missing vendor chunks,
  // missing CSS, and persistent 404s until `.next` is wiped. Production is untouched.
  //
  // 1. Disable server splitChunks in dev so webpack doesn't create per-vendor
  //    chunk files (`.next/server/vendor-chunks/*.js`) that go missing.
  // 2. Switch webpack's filesystem cache to in-memory in dev so the on-disk
  //    `.next/cache/webpack/*.pack.gz` files — which regularly get corrupted
  //    and cause asset-serving 404s — are not used.
  webpack: (config, { isServer, dev }) => {
    if (isServer && dev) {
      config.optimization.splitChunks = false;
    }
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
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
  async redirects() {
    return [
      {
        source: '/embed/memberships/:slug',
        destination: '/memberships/:slug',
        permanent: true,
      },
      {
        source: '/embed/:slug',
        destination: '/:slug',
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      // Discovery pages - cache with revalidation
      {
        source: '/:slug((?!admin|api|documentation(?:/|$)|embed|portal|form-responses|reporting|reservations|_next).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
          },
        ],
      },
      // Portal pages - partner host shell discovery iframe (tracked GTM)
      {
        source: '/portal/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Content-Security-Policy',
            value: 'frame-ancestors *',
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
      // Host kit - unversioned URL live on partner sites; must pick up fixes quickly.
      // Declared after the static-assets rule so this Cache-Control wins for /bond-host/*.
      {
        source: '/bond-host/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
