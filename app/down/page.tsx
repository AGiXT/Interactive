'use client';

import { SidebarPage } from '@/components/layout/SidebarPage';
import { getCookie } from 'cookies-next';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function BadGateway({}: {}) {
  const [link, setLink] = useState('/');
  useEffect(() => {
    // setLink(getCookie('href')?.toString() ?? '/');
  }, [getCookie('href')]);
  return (
    <SidebarPage title=''>
      <h2>Server unavailable!</h2>
      <p>It appears your internet connection may have been disrupted, or our server is under maintenance.</p>
      <Link href={link}>Try Again</Link>
    </SidebarPage>
  );
}
