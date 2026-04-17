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
