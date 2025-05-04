'use client';
import { useEffect } from 'react';
import { getCookie } from 'cookies-next';

export default function ClosePage(props: any) {
  useEffect(() => {
    const jwt = getCookie('jwt');
    const redirectUrlWithToken = `agixt://callback?token=${jwt}`;
    window.location.href = redirectUrlWithToken;
    // Close the window after a short delay to allow the redirect to take effect
    setTimeout(() => {
      window.close();
    }, 1000);
  }, []);

  return <center>Please wait while you are redirected...</center>;
}
