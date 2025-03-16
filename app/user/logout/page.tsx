'use client';
import { ReactNode, useEffect } from 'react';
import { deleteCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';

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
