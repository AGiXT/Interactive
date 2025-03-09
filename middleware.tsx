import { NextResponse, NextRequest } from 'next/server';
import { useAuth, useJWTQueryParam, useOAuth2 } from './components/idiot/auth/auth.middleware';
import { getRequestedURI } from './components/idiot/auth/utils';
import log from './components/idiot/next-log/log';

export type MiddlewareHook = (req: NextRequest) => Promise<{
  activated: boolean;
  response: NextResponse;
}>;
export const mergeConfigs = (obj1: any, obj2: any): any =>
  Object.keys(obj2).reduce(
    (acc, key) => ({
      ...acc,
      [key]:
        typeof obj2[key] === 'object' && obj2[key] !== null && obj1[key] ? mergeConfigs(obj1[key], obj2[key]) : obj2[key],
    }),
    { ...obj1 },
  );

export const useNextAPIBypass: MiddlewareHook = async (req) => {
  const toReturn = {
    activated: false,
    response: NextResponse.next(),
  };
  if (
    req.nextUrl.pathname.startsWith('/_next/') ||
    req.nextUrl.pathname.startsWith('/api/') ||
    req.nextUrl.pathname === '/favicon.ico'
  ) {
    toReturn.activated = true;
  }
  return toReturn;
};

export const useSocketIOBypass: MiddlewareHook = async (req) => {
  const url = new URL(getRequestedURI(req));

  return {
    activated: url.host === 'socket.io',
    response: NextResponse.next(),
  };
};

export const useDocsPublicAccess: MiddlewareHook = async (req) => {
  if (req.nextUrl.pathname === '/docs') {
    return {
      activated: true,
      response: NextResponse.redirect(new URL('/docs/0-Introduction', req.url)),
    };
  }
  return {
    activated: req.nextUrl.pathname.startsWith('/docs'),
    response: NextResponse.next(),
  };
};

export default async function Middleware(req: NextRequest): Promise<NextResponse> {
  log([`MIDDLEWARE INVOKED AT ${req.nextUrl.pathname}`], {
    server: 1,
  });
  const hooks = [useNextAPIBypass, useDocsPublicAccess, useOAuth2, useJWTQueryParam, useAuth];
  for (const hook of hooks) {
    const hookResult = await hook(req);
    if (hookResult.activated) {
      hookResult.response.headers.set('x-next-pathname', req.nextUrl.pathname);
      return hookResult.response;
    }
  }
  return NextResponse.next({
    headers: {
      'x-next-pathname': req.nextUrl.pathname,
    },
  });
}
