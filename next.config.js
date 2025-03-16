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
    NEXT_PUBLIC_AMAZON_CLIENT_ID: process.env.AMAZON_CLIENT_ID || '',
    NEXT_PUBLIC_AMAZON_SCOPES: process.env.AMAZON_SCOPES || '',
    NEXT_PUBLIC_GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
    NEXT_PUBLIC_GITHUB_SCOPES: process.env.GITHUB_SCOPES || 'repo user:email read:user workflow',
    NEXT_PUBLIC_GITLAB_CLIENT_ID: process.env.GITLAB_CLIENT_ID || '',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    NEXT_PUBLIC_GOOGLE_SCOPES:
      process.env.GOOGLE_SCOPES ||
      'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/gmail.modify',
    NEXT_PUBLIC_MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
    NEXT_PUBLIC_MICROSOFT_SCOPES:
      process.env.MICROSOFT_SCOPES || 'offline_access User.Read Mail.Send Calendars.ReadWrite Calendars.ReadWrite.Shared',
    NEXT_PUBLIC_TESLA_CLIENT_ID: process.env.TESLA_CLIENT_ID || '',
    NEXT_PUBLIC_TESLA_SCOPES:
      process.env.TESLA_SCOPES ||
      'openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_location',
    NEXT_PUBLIC_X_CLIENT_ID: process.env.X_CLIENT_ID || '',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
    NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID: process.env.STRIPE_PRICING_TABLE_ID || '',
    NEXT_PUBLIC_AGIXT_API_KEY: process.env.AGIXT_API_KEY || '',
    NEXT_PUBLIC_AGIXT_CONVERSATION_NAME: process.env.AGIXT_CONVERSATION || '-',
    // UI Options
    NEXT_PUBLIC_AGIXT_FOOTER_MESSAGE: process.env.AGIXT_FOOTER_MESSAGE || 'Powered by AGiXT',
    NEXT_PUBLIC_AGIXT_RLHF: process.env.AGIXT_RLHF || 'true',
    NEXT_PUBLIC_AGIXT_FILE_UPLOAD_ENABLED: process.env.AGIXT_FILE_UPLOAD_ENABLED || 'true',
    NEXT_PUBLIC_AGIXT_VOICE_INPUT_ENABLED: process.env.AGIXT_VOICE_INPUT_ENABLED || 'true',
    NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING: process.env.AGIXT_ALLOW_MESSAGE_EDITING || 'true',
    NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_DELETION: process.env.AGIXT_ALLOW_MESSAGE_DELETION || 'true',
    NEXT_PUBLIC_AGIXT_SHOW_OVERRIDE_SWITCHES: process.env.AGIXT_SHOW_OVERRIDE_SWITCHES || 'tts,websearch',
    // State Options
    NEXT_PUBLIC_AGIXT_AGENT: process.env.AGIXT_AGENT || 'AGiXT',
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
