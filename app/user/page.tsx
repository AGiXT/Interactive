'use client';

import axios, { AxiosError } from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { setCookie } from 'cookies-next';
import { LuUser } from 'react-icons/lu';
import OAuth from '@/components/auth/OAuth'; // OAuth component handles its own loading
import AuthCard from '@/components/layout/AuthCard';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

const authServer = `${process.env.NEXT_PUBLIC_AGIXT_SERVER}`;
const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid E-Mail address.' }),
  redirectTo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Identify(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<FormData> = async (formData) => {
    try {
      const existsResponse = await axios.get(`${authServer}/v1/user/exists?email=${formData.email}`);
      setCookie('email', formData.email, { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN });
      router.push(`${pathname}${existsResponse.data ? '/login' : '/register'}`);
    } catch (exception) {
      const axiosError = exception as AxiosError;
      // Improved error handling to show specific server message if available
      const message = (axiosError.response?.data as any)?.detail || axiosError.message || 'An error occurred.';
      setError('email', { type: 'server', message: message });
    }
  };

  // Determine if email/OAuth options should be shown based on environment variables
  const showEmail = process.env.NEXT_PUBLIC_ALLOW_EMAIL_SIGN_IN === 'true';
  // We'll render the OAuth component if *any* provider *might* be configured.
  // The component itself will handle showing buttons only if providers *are* configured.
  // This simplification avoids the need to import the (now non-existent) provider list here.
  const showOAuthComponent = true; // Assume OAuth might be available, let the component decide

  return (
    <AuthCard title='Welcome' description='Please choose an authentication method.'>
      <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
        {showEmail && (
          <>
            <Label htmlFor='email'>E-Mail Address</Label> {/* Corrected htmlFor */}
            <Input id='email' autoComplete='username' autoFocus placeholder='your@example.com' {...register('email')} />
            {errors.email?.message && <Alert variant='destructive'>{errors.email?.message}</Alert>}
            <Button variant='default' disabled={isSubmitting} className='w-full space-x-1'>
              <LuUser className='w-5 h-5' />
              <span>{isSubmitting ? 'Checking...' : 'Continue with Email'}</span>
            </Button>
          </>
        )}

        {/* Separator logic: Show if both email and the OAuth component are potentially rendered */}
        {showEmail && showOAuthComponent ? (
          <div className='flex items-center gap-2 my-2'>
            <Separator className='flex-1' />
            <span>or</span>
            <Separator className='flex-1' />
          </div>
        ) : null}

        {/* OAuth component - It will render its own loading/error/buttons */}
        {showOAuthComponent && <OAuth />}
      </form>
    </AuthCard>
  );
}
