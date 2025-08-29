import withPWAInit from 'next-pwa';

// Build regex for Supabase host (used in runtime caching rule)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseHost = '.*';
try {
  supabaseHost = new URL(supabaseUrl).host.replace(/\./g, '\\.');
} catch {
  // leave fallback if env is missing during build
}

const runtimeCaching = [
  {
    urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'google-fonts',
      expiration: { maxEntries: 36, maxAgeSeconds: 60 * 60 * 24 * 365 },
    },
  },
  {
    // Cache Supabase meal photos (public or signed)
    urlPattern: new RegExp(`^https://${supabaseHost}/storage/v1/object/(public|sign)/photos/`),
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'meal-photos',
      expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
];

// Initialize plugin with ALL pwa options here
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: { document: '/offline.html' },
  runtimeCaching,
});

// Export final Next config (no experimental.appDir, no pwa key)
export default withPWA({
  reactStrictMode: true,
});
