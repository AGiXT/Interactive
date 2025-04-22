import { NextResponse, NextRequest } from 'next/server';

const authWeb = `${process.env.NEXT_PUBLIC_APP_URI}/user`;

export type MiddlewareHook = (req: NextRequest) => Promise<{
  activated: boolean;
  response: NextResponse;
}>;

export const generateCookieString = (key: string, value: string, age: string): string =>
  `${key}=${value}; Domain=${process.env.NEXT_PUBLIC_COOKIE_DOMAIN}; Path=/; Max-Age=${age}; SameSite=Lax;`;

export const getQueryParams = (req: NextRequest): any =>
  req.url.includes('?')
    ? Object.assign(
        {},
        ...req.url
          .split('?')[1]
          .split('&')
          .map((param) => ({ [param.split('=')[0]]: param.split('=')[1] })),
      )
    : {};

export const getRequestedURI = (req: NextRequest): string => {
  return req.url
    .split('?')[0]
    .replace(/localhost:\d+/, (process.env.APP_URI || '').replace('https://', '').replace('http://', ''));
};

export const getJWT = (req: NextRequest) => {
  const rawJWT = req.cookies.get('jwt')?.value;
  // Strip any and all 'Bearer 's off of JWT.
  const jwt = rawJWT?.split(' ')[rawJWT?.split(' ').length - 1] ?? rawJWT ?? '';
  return jwt;
};

export const verifyJWT = async (jwt: string): Promise<Response> => {
  if (!process.env.SERVERSIDE_AGIXT_SERVER) {
    process.env.SERVERSIDE_AGIXT_SERVER = ['agixt', 'localhost', 'back-end', 'boilerplate', 'back-end-image'].join(',');
  }
  const containerNames = process.env.SERVERSIDE_AGIXT_SERVER.split(',');
  const responses = {} as any;
  const authEndpoint = `${process.env.AGIXT_SERVER}/v1/user`;
  let response;
  for (const containerName of containerNames) {
    const testEndpoint = authEndpoint.replace('localhost', containerName);
    try {
      response = await fetch(testEndpoint, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${jwt}`,
        },
      });

      if (response.status === 200 || [401, 402, 403].includes(response.status)) {
        if (Object.keys(responses).length > 0) {
          containerNames.sort((a, b) => {
            if (a === containerName) {
              return -1;
            } else if (b === containerName) {
              return 1;
            } else {
              return 0;
            }
          });
          process.env.SERVERSIDE_AGIXT_SERVER = containerNames.join(',');
        }
        return response;
      } else {
        responses[testEndpoint] = await response.text();
        console.error(`Failed to contact server at ${testEndpoint}.`);
      }
    } catch (exception) {
      responses[testEndpoint] = exception;
    }
  }
  console.error('Failed to contact any of the following servers: ', JSON.stringify(responses));
  for (const key of Object.keys(responses)) {
    console.error(key, responses[key]);
  }
  return new Response();
};
export const useAuth: MiddlewareHook = async (req) => {
  // Initialize response object to redirect to auth page
  const toReturn = {
    activated: false,
    response: NextResponse.redirect(new URL(authWeb as string), {
      headers: {
        'Set-Cookie': [generateCookieString('jwt', '', '0')], // Always clear JWT on redirect to auth
      },
    }),
  };

  const requestedURI = getRequestedURI(req);
  const queryParams = getQueryParams(req);

  // Skip auth check for logout path
  if (requestedURI.endsWith('/user/logout')) {
    return toReturn;
  }

  // Handle email verification
  if (queryParams['verify_email'] && queryParams['email']) {
    await fetch(`${process.env.AGIXT_SERVER}/v1/user/verify/email`, {
      method: 'POST',
      body: JSON.stringify({
        email: queryParams['email'],
        code: queryParams['verify_email'],
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (queryParams.invitation_id && queryParams.email) {
      const cookieArray = [
        generateCookieString('email', queryParams.email, (86400).toString()),
        generateCookieString('invitation', queryParams.invitation_id, (86400).toString()),
      ];
      if (queryParams.company) {
        cookieArray.push(generateCookieString('company', queryParams.company, (86400).toString()));
      }
      toReturn.activated = true;
      toReturn.response = NextResponse.redirect(`${authWeb}/register`, {
        // @ts-expect-error NextJS' types are wrong.
        headers: {
          'Set-Cookie': cookieArray,
        },
      });
      return toReturn;
    }
  }

  // Check if the route requires authentication
  const isPrivateRoute = process.env.PRIVATE_ROUTES?.split(',').some((path) => req.nextUrl.pathname.startsWith(path));

  // Skip auth for public user routes (login, register) and OAuth close page
  if (
    req.nextUrl.pathname.startsWith('/user/close') ||
    req.nextUrl.pathname === '/user' ||
    req.nextUrl.pathname === '/user/login' ||
    req.nextUrl.pathname === '/user/register'
  ) {
    toReturn.activated = false;
    return toReturn;
  }

  // Skip auth check for non-private routes that aren't in /user path
  if (!isPrivateRoute && !req.nextUrl.pathname.startsWith('/user')) {
    toReturn.activated = false;
    return toReturn;
  }

  // Get JWT from cookies
  const jwt = getJWT(req);

  // If no JWT and we're on a private route or protected user route, redirect to auth and activate
  if (
    !jwt &&
    (isPrivateRoute ||
      (req.nextUrl.pathname.startsWith('/user') &&
        !req.nextUrl.pathname.startsWith('/user/register') &&
        !req.nextUrl.pathname.startsWith('/user/login') &&
        req.nextUrl.pathname !== '/user'))
  ) {
    toReturn.activated = true;
    toReturn.response.headers.set('Set-Cookie', [
      generateCookieString('jwt', '', '0'),
      generateCookieString('href', requestedURI, (86400).toString()),
    ]);
    return toReturn;
  }

  // If JWT exists, verify it
  if (jwt) {
    try {
      const response = await verifyJWT(jwt);
      const responseJSON = await response.json();

      if (response.status === 402) {
        // Payment Required
        if (!requestedURI.startsWith(`${authWeb}/subscribe`)) {
          toReturn.response = NextResponse.redirect(
            new URL(
              `${authWeb}/subscribe${
                responseJSON.detail.customer_session.client_secret
                  ? '?customer_session=' + responseJSON.detail.customer_session.client_secret
                  : ''
              }`,
            ),
          );
          toReturn.activated = true;
        }
      } else if (responseJSON?.missing_requirements || response.status === 403) {
        // Forbidden (Missing Values for User)
        if (!requestedURI.startsWith(`${authWeb}/manage`)) {
          toReturn.response = NextResponse.redirect(new URL(`${authWeb}/manage`));
          toReturn.activated = true;
        }
      } else if (response.status === 502) {
        const cookieArray = [generateCookieString('href', requestedURI, (86400).toString())];
        toReturn.activated = true;
        toReturn.response = NextResponse.redirect(new URL(`${authWeb}/down`, req.url), {
          // @ts-expect-error NextJS' types are wrong.
          headers: {
            'Set-Cookie': cookieArray,
          },
        });
      } else if (response.status >= 500 && response.status < 600) {
        // Internal Server Error - Don't delete JWT for server errors
        console.error(
          `Invalid token response, status ${response.status}, detail ${responseJSON.detail}. Server error, please try again later.`,
        );

        toReturn.response = NextResponse.redirect(new URL(`${authWeb}/error`, req.url));
        toReturn.activated = true;
      } else if (response.status !== 200) {
        // Invalid JWT - clear JWT and redirect to auth page
        toReturn.response = NextResponse.redirect(new URL(authWeb, req.url), {
          headers: {
            'Set-Cookie': [
              generateCookieString('jwt', '', '0'),
              generateCookieString('href', requestedURI, (86400).toString()),
            ],
          },
        });
        toReturn.activated = true;
        console.error(`Invalid token response, status ${response.status}, detail ${responseJSON.detail}.`);
      } else if (requestedURI.startsWith(authWeb) && jwt.length > 0 && !['/user/manage'].includes(req.nextUrl.pathname)) {
        // Valid JWT but on auth page - redirect to manage
        toReturn.response = NextResponse.redirect(new URL(`${authWeb}/manage`));
        toReturn.activated = true;
      }
    } catch (exception) {
      // Handle JWT verification errors
      logJwtError(exception, authWeb);

      // Clear JWT and redirect to auth
      toReturn.response = NextResponse.redirect(new URL(authWeb, req.url), {
        headers: {
          'Set-Cookie': [
            generateCookieString('jwt', '', '0'),
            generateCookieString('href', requestedURI, (86400).toString()),
          ],
        },
      });
      toReturn.activated = true;
    }
  }

  return toReturn;
};

// Helper function to log JWT errors
function logJwtError(exception: any, authWeb: string) {
  if (exception instanceof TypeError && exception.cause instanceof AggregateError) {
    console.error(
      `Invalid token. Failed with TypeError>AggregateError. Logging out and redirecting to authentication at ${authWeb}. ${exception.message} Exceptions to follow.`,
    );
    for (const anError of exception.cause.errors) {
      console.error(anError.message);
    }
  } else if (exception instanceof AggregateError) {
    console.error(
      `Invalid token. Failed with AggregateError. Logging out and redirecting to authentication at ${authWeb}. ${exception.message} Exceptions to follow.`,
    );
    for (const anError of exception.errors) {
      console.error(anError.message);
    }
  } else if (exception instanceof TypeError) {
    console.error(
      `Invalid token. Failed with TypeError. Logging out and redirecting to authentication at ${authWeb}. ${exception.message} Cause: ${exception.cause}.`,
    );
  } else {
    console.error(`Invalid token. Logging out and redirecting to authentication at ${authWeb}.`, exception);
  }
}
export const useOAuth2: MiddlewareHook = async (req) => {
  const provider = req.nextUrl.pathname.split('?')[0].split('/').pop()?.toLowerCase(); // Ensure provider is lowercase
  const defaultRedirect = new URL(`${authWeb}/login`); // Fallback redirect

  let toReturn = {
    activated: false,
    response: NextResponse.redirect(defaultRedirect),
  };

  const queryParams = getQueryParams(req);

  if (queryParams.code && provider) {
    const oAuthEndpoint = `${process.env.AGIXT_SERVER}/v1/oauth2/${provider}`;
    const invitationCookie = req.cookies.get('invitation')?.value;
    const redirectUriForProvider = `${process.env.NEXT_PUBLIC_APP_URI}/user/close/${provider}`; // The URI registered with the provider

    try {
      console.log(`[Middleware useOAuth2] Calling backend endpoint: ${oAuthEndpoint} for provider: ${provider}`);
      const response = await fetch(oAuthEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          code: queryParams.code,
          state: queryParams.state, // Pass the PKCE state
          redirect_uri: redirectUriForProvider, // Often needed by backend for token exchange
          // NOTE: code_verifier is usually needed here too. How does backend get it?
          // See previous thoughts: Either frontend sends it, or backend stored it.
          ...(invitationCookie && { invitation: invitationCookie }),
        }),
        headers: {
          'Content-Type': 'application/json',
          // NO Authorization header here - JWT is likely missing anyway
        },
      });

      const auth = await response.json();

      if (!response.ok) {
        const errorDetail = auth.detail || `Backend request failed with status ${response.status}`;
        console.error(`[Middleware useOAuth2] Backend error for ${provider}:`, errorDetail);
        // Redirect to an error page or login with error message
        const errorRedirect = new URL(`${authWeb}/login`);
        errorRedirect.searchParams.set('error', `oauth_backend_failed_${provider}`);
        errorRedirect.searchParams.set('message', errorDetail);
        toReturn = {
          activated: true,
          response: NextResponse.redirect(errorRedirect),
        };
        return toReturn; // Exit on backend error
      }

      // --- Backend Response Handling ---
      // Scenario 1: Backend included JWT in auth.detail URL
      // Scenario 2: Backend set the Set-Cookie header in its response (less common for API)

      // Assume Scenario 1 or 2: Redirect to the URL provided by the backend.
      // The useJWTQueryParam hook (for scenario 1) or the browser (for scenario 2) will handle the JWT cookie.
      console.log(`[Middleware useOAuth2] Backend successful for ${provider}. Redirecting to: ${auth.detail}`);
      let finalRedirectUrl: URL;
      try {
        // Ensure auth.detail is a valid URL
        finalRedirectUrl = new URL(auth.detail);
      } catch (e) {
        console.error(`[Middleware useOAuth2] Invalid redirect URL from backend: ${auth.detail}. Falling back.`);
        // Fallback to a default logged-in page if backend URL is invalid
        finalRedirectUrl = new URL('/chat', req.url); // Example fallback
      }

      toReturn = {
        activated: true,
        response: NextResponse.redirect(finalRedirectUrl),
        // Middleware doesn't need to set the cookie here if backend handles it (either via URL param or Set-Cookie)
      };
    } catch (error: any) {
      console.error(`[Middleware useOAuth2] Middleware fetch error for ${provider}:`, error);
      const errorRedirect = new URL(`${authWeb}/login`);
      errorRedirect.searchParams.set('error', `middleware_fetch_error_${provider}`);
      errorRedirect.searchParams.set('message', error.message || 'Network error');
      toReturn = {
        activated: true,
        response: NextResponse.redirect(errorRedirect),
      };
    }
  } else if (queryParams.error) {
    // Handle errors reported directly by the OAuth provider in the callback URL
    console.error(
      `[Middleware useOAuth2] OAuth provider error for ${provider}:`,
      queryParams.error,
      queryParams.error_description,
    );
    const errorRedirect = new URL(`${authWeb}/login`);
    errorRedirect.searchParams.set('error', `oauth_provider_error_${provider}`);
    errorRedirect.searchParams.set(
      'message',
      queryParams.error_description || queryParams.error || 'Unknown provider error',
    );
    toReturn = {
      activated: true,
      response: NextResponse.redirect(errorRedirect),
    };
  } else if (!provider) {
    console.error(`[Middleware useOAuth2] Could not determine provider from path: ${req.nextUrl.pathname}`);
    toReturn = {
      activated: true,
      response: NextResponse.redirect(defaultRedirect), // Redirect to login
    };
  }

  return toReturn;
};

export const useJWTQueryParam: MiddlewareHook = async (req) => {
  const queryParams = getQueryParams(req);
  const requestedURI = getRequestedURI(req);
  const toReturn = {
    activated: false,
    // This should set the cookie and then re-run the middleware (without query params).
    response: req.nextUrl.pathname.startsWith('/user/close')
      ? NextResponse.next({
          // @ts-expect-error NextJS' types are wrong.
          headers: {
            'Set-Cookie': [generateCookieString('jwt', queryParams.token ?? queryParams.jwt, (86400 * 7).toString())],
          },
        })
      : NextResponse.redirect(req.cookies.get('href')?.value ?? process.env.APP_URI ?? '', {
          // @ts-expect-error NextJS' types are wrong.
          headers: {
            'Set-Cookie': [
              generateCookieString('jwt', queryParams.token ?? queryParams.jwt, (86400 * 7).toString()),
              generateCookieString('href', '', (0).toString()),
            ],
          },
        }),
  };
  if (queryParams.token || queryParams.jwt) {
    toReturn.activated = true;
  }
  return toReturn;
};

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
