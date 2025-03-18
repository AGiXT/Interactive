'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { usePathname } from 'next/navigation';

export default function UserLayout({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();

  if (pathname === '/user/manage') return <SidebarPage title='Account Management'>{children}</SidebarPage>;

  return (
    <>
      <header
        className='sticky top-0 flex items-center justify-between gap-4 px-4 border-b md:px-6 bg-muted min-h-16'
        style={{ paddingTop: 'env(safe-area-inset-top', height: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <div className='flex items-center'>
          <Link href='/' className='flex items-center gap-2 text-lg font-semibold md:text-lg text-foreground'>
            <span className=''>{process.env.NEXT_PUBLIC_APP_NAME}</span>
          </Link>
        </div>
      </header>
      <div className='flex flex-col items-center justify-center flex-1 w-full'>{children}</div>
    </>
  );
}
