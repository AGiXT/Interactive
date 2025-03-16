'use client';
import React, { ReactNode, useContext, useEffect } from 'react';
import { notFound } from 'next/navigation';
import User, { IdentifyProps } from '@/components/auth/Identify';
import Login, { LoginProps } from '@/components/auth/Login';
import Manage, { ManageProps } from '@/components/auth/Profile';
import Register, { RegisterProps } from '@/components/auth/Register';
import { Close, CloseProps } from '@/components/auth/OAuth';
import { deleteCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import Subscribe, { SubscribeProps } from '@/components/auth/Subscribe';
import { Button } from '@/components/ui/button';
import deepMerge from '@/lib/trash';
import { createContext } from 'react';

type RouterPageProps = {
  path: string;
  heading?: string;
};

export type AuthenticationConfig = {
  identify: RouterPageProps & { props?: IdentifyProps };
  login: RouterPageProps & { props?: LoginProps };
  manage: RouterPageProps & { props?: ManageProps };
  register: RouterPageProps & { props?: RegisterProps };
  close: RouterPageProps & { props?: CloseProps };
  subscribe: RouterPageProps & { props?: SubscribeProps };
  logout: RouterPageProps & { props: LogoutProps };
  error: RouterPageProps & { props?: ErrorPageProps };
  authServer: string;
  appName: string;
  authBaseURI: string;
  recaptchaSiteKey?: string;
};

export type ErrorPageProps = {
  redirectTo?: string;
};

export function ErrorPage({ redirectTo = '/' }: ErrorPageProps) {
  const router = useRouter();

  const logout = () => {
    router.push('/user/logout');
  };

  return (
    <div className='flex min-h-[100svh] w-full flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8'>
      <div className='max-w-md mx-auto text-center'>
        <h1 className='mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl'>Oops, something went wrong!</h1>
        <p className='mt-4 text-muted-foreground'>
          We&apos;re sorry, but an unexpected error has occurred. Please try again later or contact support if the issue
          persists.
        </p>
        <div className='flex justify-center gap-4 mt-6'>
          <Button onClick={() => router.back()}>Try again</Button>
          <Button onClick={logout}>Logout</Button>
        </div>
      </div>
    </div>
  );
}

const AuthenticationContext = createContext<AuthenticationConfig | undefined>(undefined);

export type LogoutProps = { redirectTo?: string };

export function Logout({ redirectTo = '/' }: LogoutProps): ReactNode {
  const router = useRouter();
  const authConfig = useAuthentication();

  useEffect(() => {
    deleteCookie('jwt', { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN });
    router.refresh();
    router.replace(redirectTo);
    router.refresh();
  }, [router, redirectTo]);

  // Moved the conditional rendering here, after all hooks are called
  if (!authConfig.logout.heading) {
    return null;
  }

  return <h1 className='text-3xl'>{authConfig.logout.heading}</h1>;
}

export const useAuthentication = () => {
  const context = useContext(AuthenticationContext);
  if (context === undefined) {
    throw new Error('useAuthentication must be used within an AuthenticationProvider');
  }
  return context;
};

const pageConfigDefaults: AuthenticationConfig = {
  identify: {
    path: '/',
    heading: 'Welcome',
  },
  login: {
    path: '/login',
    heading: 'Please Authenticate',
  },
  manage: {
    path: '/manage',
    heading: 'Account Management',
  },
  register: {
    path: '/register',
    heading: 'Welcome, Please Register',
  },
  close: {
    path: '/close',
    heading: '',
  },
  subscribe: {
    path: '/subscribe',
    heading: 'Please Subscribe to Access The Application',
  },
  logout: {
    path: '/logout',
    props: undefined,
    heading: '',
  },
  error: {
    path: '/error',
    heading: 'Error',
  },
  appName: process.env.NEXT_PUBLIC_APP_NAME,
  authBaseURI: process.env.NEXT_PUBLIC_AUTH_WEB,
  authServer: process.env.NEXT_PUBLIC_AGIXT_SERVER,
  recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
};

export default function AuthRouter({
  params,
  searchParams,
  corePagesConfig = pageConfigDefaults,
  additionalPages = {},
}: {
  params: { slug?: string[] };
  searchParams: any;
  corePagesConfig?: AuthenticationConfig;
  additionalPages: { [key: string]: ReactNode };
}) {
  corePagesConfig = deepMerge(pageConfigDefaults, corePagesConfig);

  const pages = {
    [corePagesConfig.identify.path]: <User {...corePagesConfig.identify.props} />,
    [corePagesConfig.login.path]: <Login searchParams={searchParams} {...corePagesConfig.login.props} />,
    [corePagesConfig.manage.path]: <Manage {...corePagesConfig.manage.props} />,
    [corePagesConfig.register.path]: <Register {...corePagesConfig.register.props} />,
    [corePagesConfig.close.path]: <Close {...corePagesConfig.close.props} />,
    [corePagesConfig.subscribe.path]: <Subscribe searchParams={searchParams} {...corePagesConfig.subscribe.props} />,
    [corePagesConfig.logout.path]: <Logout {...corePagesConfig.logout.props} />,
    [corePagesConfig.error.path]: <ErrorPage {...corePagesConfig.error.props} />,
    ...additionalPages,
  };

  const path = params.slug ? `/${params.slug.join('/')}` : '/';
  if (path in pages || path.startsWith(corePagesConfig.close.path)) {
    return (
      <AuthenticationContext.Provider value={{ ...pageConfigDefaults, ...corePagesConfig }}>
        {path.startsWith(corePagesConfig.close.path) ? pages[corePagesConfig.close.path] : pages[path.toString()]}
      </AuthenticationContext.Provider>
    );
  } else {
    return notFound();
  }
}
