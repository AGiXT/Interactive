'use client';
import React, { ReactNode, useEffect } from 'react';
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
  appName: string;
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

  useEffect(() => {
    deleteCookie('jwt', { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN });
    router.refresh();
    router.replace(redirectTo);
    router.refresh();
  }, [router, redirectTo]);

  // Moved the conditional rendering here, after all hooks are called
  return null;
}

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
    props: {
      additionalFields: ['first_name', 'last_name'],
    },
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
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'AGiXT',
};

export default function AuthRouter({
  params,
  searchParams,
  additionalPages = {},
}: {
  params: { slug?: string[] };
  searchParams: any;
  corePagesConfig?: AuthenticationConfig;
  additionalPages: { [key: string]: ReactNode };
}) {
  const pages = {
    [pageConfigDefaults.identify.path]: <User {...pageConfigDefaults.identify.props} />,
    [pageConfigDefaults.login.path]: <Login searchParams={searchParams} {...pageConfigDefaults.login.props} />,
    [pageConfigDefaults.manage.path]: <Manage {...pageConfigDefaults.manage.props} />,
    [pageConfigDefaults.register.path]: <Register {...pageConfigDefaults.register.props} />,
    [pageConfigDefaults.close.path]: <Close {...pageConfigDefaults.close.props} />,
    [pageConfigDefaults.subscribe.path]: <Subscribe searchParams={searchParams} {...pageConfigDefaults.subscribe.props} />,
    [pageConfigDefaults.logout.path]: <Logout {...pageConfigDefaults.logout.props} />,
    [pageConfigDefaults.error.path]: <ErrorPage {...pageConfigDefaults.error.props} />,
    ...additionalPages,
  };

  const path = params.slug ? `/${params.slug.join('/')}` : '/';
  if (path in pages || path.startsWith(pageConfigDefaults.close.path)) {
    return (
      <AuthenticationContext.Provider value={{ ...pageConfigDefaults }}>
        {path.startsWith(pageConfigDefaults.close.path) ? pages[pageConfigDefaults.close.path] : pages[path.toString()]}
      </AuthenticationContext.Provider>
    );
  } else {
    return notFound();
  }
}
