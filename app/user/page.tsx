'use client';

import axios, { AxiosError } from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { setCookie } from 'cookies-next';
import { LuUser } from 'react-icons/lu';
import OAuth from '@/components/auth/OAuth';
import AuthCard from '@/components/layout/AuthCard';
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
  const [isPageReady, setIsPageReady] = useState<boolean>(true);

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
      setError('email', { type: 'server', message: axiosError.message });
    }
  };

  // Don't render anything until we're ready
  if (!isPageReady) {
    return <AuthCard title='Welcome' description='Loading authentication options...'></AuthCard>;
  }

  const showEmail = process.env.NEXT_PUBLIC_ALLOW_EMAIL_SIGN_IN === 'true';

  return (
    <AuthCard title='Welcome' description='Please choose an authentication method.'>
      <form onSubmit={handleSubmit(onSubmit)} className='flex flex-col gap-4'>
        {showEmail && (
          <>
            <Label htmlFor='E-Mail Address'>E-Mail Address</Label>
            <Input id='email' autoComplete='username' autoFocus placeholder='your@example.com' {...register('email')} />
            {errors.email?.message && <Alert variant='destructive'>{errors.email?.message}</Alert>}

            <Button variant='default' disabled={isSubmitting} className='w-full space-x-1'>
              <LuUser className='w-5 h-5' />
              <span>Continue with Email</span>
            </Button>
          </>
        )}

        {/* Use the new OAuth component with appropriate props */}
        <OAuth showSeparator={showEmail} separatorText='or' showLoadingMessage={false} />
      </form>
    </AuthCard>
  );
}
