import type { NextConfig } from 'next';

function securityHeaders() {
  const headers = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  ];

  if (process.env.NODE_ENV === 'production') {
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=15552000' });
  }

  return headers;
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;
