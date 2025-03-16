import { CommandMenu } from '@/components/command-menu';
import { CommandMenuProvider } from '@/components/command-menu/command-menu-context';
import InteractiveConfigContextWrapper from '@/components/idiot/interactive/ContextWrapper';
import { SidebarContentProvider } from '@/components/layout/SidebarContentManager';
import { SidebarContext } from '@/components/layout/SidebarContext';
import { SidebarMain } from '@/components/layout/SidebarMain';
import '@/components/idiot/zod2gql/zod2gql';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { ReactNode } from 'react';
import './globals.css';
import { metadata, viewport } from './metadata';
import { SolanaWalletProvider } from '@/components/command-menu/wallet-provider';

const inter = Inter({ subsets: ['latin'] });

export { metadata, viewport };
export function Head() {
  return (
    <head>
      <link rel='icon' href='/favicon.ico' sizes='any' />
      <meta name='google-adsense-account' content={process.env.NEXT_PUBLIC_ADSENSE_ACCOUNT ?? ''} />
      <meta property='og:url' content={process.env.NEXT_PUBLIC_APP_URI ?? ''} />
      <meta property='og:type' content='website' />
      <meta property='og:title' content={process.env.NEXT_PUBLIC_APP_NAME ?? 'NextJS Application'} />
      <meta
        property='og:description'
        content={process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? 'An application built with NextJS.'}
      />
      <meta
        property='og:image'
        content={process.env.NEXT_PUBLIC_APP_LOGO_URI || `${process.env.NEXT_PUBLIC_APP_URI}/favicon.ico`}
      />
    </head>
  );
}

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  const cookieStore = cookies();
  const theme = cookieStore.get('theme')?.value ?? process.env.NEXT_PUBLIC_THEME_DEFAULT_MODE;
  const appearance = cookieStore.get('appearance')?.value ?? '';

  return (
    <html lang='en'>
      <Head />
      <body className={cn(inter.className, theme, appearance)}>
        <InteractiveConfigContextWrapper>
          <SolanaWalletProvider>
            <CommandMenuProvider>
              <SidebarContentProvider>
                <SidebarProvider className='flex-1' defaultRightOpen={false}>
                  <SidebarMain side='left' />
                  {children}
                  <Toaster />
                  {/* <ThemeSetter /> */}
                  <CommandMenu />
                  <SidebarContext side='right' />
                </SidebarProvider>
              </SidebarContentProvider>
            </CommandMenuProvider>
          </SolanaWalletProvider>
        </InteractiveConfigContextWrapper>
      </body>
    </html>
  );
}
