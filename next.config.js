/** @type {import('next').NextConfig} */

let APP_URI, AGIXT_SERVER;

let nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: Dangerously allow production builds to successfully complete even if your project has type errors.
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/',
        has: [
          {
            type: 'query',
            key: 'invitation_id',
          },
          {
            type: 'query',
            key: 'email',
          }
        ],
        destination: '/invite?invitation_id=:invitation_id&email=:email&company=:company',
        permanent: false,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_COOKIE_DOMAIN: (() => {
      const domain = ((APP_URI ?? '').split('://')[1] ?? '').split(':')[0];
      const ipPattern = /^(?:\d{1,3}\.){3}\d{1,3}$/;
      return ipPattern.test(domain) ? domain : domain.split('.').reverse().slice(0, 2).reverse().join('.');
    })(),
    PRIVATE_ROUTES: process.env.PRIVATE_ROUTES || '/chat,/team,/settings/',
    AGIXT_SERVER: (AGIXT_SERVER = process.env.AGIXT_SERVER || 'https://api.agixt.dev'),
    NEXT_PUBLIC_AGIXT_SERVER: AGIXT_SERVER,
    NEXT_PUBLIC_ALLOW_EMAIL_SIGN_IN: process.env.ALLOW_EMAIL_SIGN_IN || 'true',
    NEXT_PUBLIC_APP_NAME: process.env.APP_NAME || 'AGiXT',
    NEXT_PUBLIC_APP_DESCRIPTION: process.env.APP_DESCRIPTION || 'An AGiXT application.',
    APP_URI: (APP_URI = process.env.APP_URI || 'http://localhost:3437'),
    NEXT_PUBLIC_APP_URI: APP_URI,
    NEXT_PUBLIC_THEME_DEFAULT_MODE: process.env.DEFAULT_THEME_MODE || 'dark',
    NEXT_PUBLIC_TZ: process.env.TZ || 'America/New_York', // Server timezone
    NEXT_PUBLIC_ADSENSE_ACCOUNT: process.env.ADSENSE_ACCOUNT || '',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
    NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID: process.env.STRIPE_PRICING_TABLE_ID || '',
    // UI Options
    NEXT_PUBLIC_AGIXT_FOOTER_MESSAGE: process.env.AGIXT_FOOTER_MESSAGE || 'Powered by AGiXT',
    NEXT_PUBLIC_AGIXT_RLHF: process.env.AGIXT_RLHF || 'true',
    NEXT_PUBLIC_AGIXT_FILE_UPLOAD_ENABLED: process.env.AGIXT_FILE_UPLOAD_ENABLED || 'true',
    NEXT_PUBLIC_AGIXT_VOICE_INPUT_ENABLED: process.env.AGIXT_VOICE_INPUT_ENABLED || 'true',
    NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING: process.env.AGIXT_ALLOW_MESSAGE_EDITING || 'true',
    NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_DELETION: process.env.AGIXT_ALLOW_MESSAGE_DELETION || 'true',
    NEXT_PUBLIC_AGIXT_SHOW_OVERRIDE_SWITCHES: process.env.AGIXT_SHOW_OVERRIDE_SWITCHES || 'tts,websearch',
    // State Options
    NEXT_PUBLIC_AGIXT_AGENT: process.env.AGIXT_AGENT || 'XT',
  },
  images: AGIXT_SERVER && {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: AGIXT_SERVER.split('://')[1].split(':')[0].split('/')[0],
        port: '',
        pathname: '/outputs/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      optimizeCss: true,
      allowedOrigins: ['*'],
      allowedForwardedHosts: ['*'],
      retryOnError: false, // or a number to set max retries
    },
  },
  // Add PWA headers configuration
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
