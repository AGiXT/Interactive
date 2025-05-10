'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { setCookie } from 'cookies-next';

export default function InvitationRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // First try to get parameters from Next.js searchParams
    let invitationId = searchParams.get('invitation_id');
    let email = searchParams.get('email');
    let company = searchParams.get('company');

    // If not found, try to extract from URL directly (for direct access cases)
    if ((!invitationId || !email) && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const urlParams = url.searchParams;
      
      if (!invitationId) invitationId = urlParams.get('invitation_id');
      if (!email) email = urlParams.get('email');
      if (!company) company = urlParams.get('company');
    }

    if (invitationId && email) {
      // Store values in cookies
      setCookie('invitation', invitationId, { maxAge: 86400 });
      setCookie('email', email, { maxAge: 86400 });
      if (company) {
        setCookie('company', company, { maxAge: 86400 });
      }

      // Redirect to register page
      router.push('/user/register');
    } else {
      // If no invitation parameters, redirect to home
      router.push('/');
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Processing invitation...</h1>
        <p>You are being redirected to complete your registration.</p>
      </div>
    </div>
  );
}
