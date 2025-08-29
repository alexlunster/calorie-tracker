import withPWAInit from 'next-pwa';

// initialize plugin
const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline.html',
  },
});

// Build regex for Supabase host (optional safety)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseHost = '.*';
try {
  supabaseHost = new URL(supabaseUrl).host.replace(/\./g, '\\.');
} catch {
  // leave fallback
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
    urlPattern: new RegExp(`^https://${supabaseHost}/storage/v1/object/(public|sign)/photos/`),
    handler: 'StaleWhileRevalidate',
    method: 'GET',
    options: {
      cacheName: 'meal-photos',
      expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
    },
  },
];

// Export final config with plugin applied
export default withPWA({
  // your Next.js config here
  reactStrictMode: true,
  experimental: {
    appDir: true,
  },
  pwa: {
    runtimeCaching,
  },
});
