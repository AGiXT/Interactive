'use client';
import React, { ReactNode, useContext } from 'react';
import { notFound } from 'next/navigation';
import User, { IdentifyProps } from '@/components/idiot/auth/Identify';
import Login, { LoginProps } from '@/components/idiot/auth/Login';
import Manage, { ManageProps } from '@/components/idiot/auth/management';
import Register, { RegisterProps } from '@/components/idiot/auth/Register';
import { Close, CloseProps } from '@/components/idiot/auth/OAuth';
import Logout, { LogoutProps } from '@/components/idiot/auth/Logout';
import Subscribe, { SubscribeProps } from '@/components/idiot/auth/Subscribe';
import ErrorPage, { ErrorPageProps } from '@/components/idiot/auth/ErrorPage';
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

const AuthenticationContext = createContext<AuthenticationConfig | undefined>(undefined);

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
