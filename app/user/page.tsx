'use client';

import axios, { AxiosError } from 'axios';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { SubmitHandler, useForm } from 'react-hook-form';
import { setCookie } from 'cookies-next';
import { LuUser } from 'react-icons/lu';
import { RiGithubFill as GitHub, RiGoogleFill as Google, RiMicrosoftFill as Microsoft } from 'react-icons/ri';
import { BsTwitterX } from 'react-icons/bs';
import { SiTesla } from 'react-icons/si';
import { FaAws } from 'react-icons/fa';
import { FaDiscord } from 'react-icons/fa';
import { TbBrandWalmart } from 'react-icons/tb';
import OAuth2Login from 'react-simple-oauth2-login';
import { useAgent } from '@/components/interactive/useAgent';
import AuthCard from '@/components/layout/AuthCard';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

const authServer = `${process.env.NEXT_PUBLIC_AGIXT_SERVER}`;

// Provider type definition
interface Provider {
  name: string;
  scopes: string;
  authorize: string;
  client_id: string;
}

// Icon mapping function based on provider name
const getIconByName = (name: string): ReactNode => {
  const lowercaseName = name.toLowerCase();

  switch (lowercaseName) {
    case 'discord':
      return <FaDiscord />;
    case 'github':
      return <GitHub />;
    case 'google':
      return <Google />;
    case 'microsoft':
      return <Microsoft />;
    case 'x':
    case 'twitter':
      return <BsTwitterX />;
    case 'tesla':
      return <SiTesla />;
    case 'amazon':
      return <FaAws />;
    case 'walmart':
      return <TbBrandWalmart />;
    default:
      // Default icon or null for providers without specific icons
      return null;
  }
};

const schema = z.object({
  email: z.string().email({ message: 'Please enter a valid E-Mail address.' }),
  redirectTo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Identify(): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useAgent();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isPageReady, setIsPageReady] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Preload providers before showing the page
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch(`${authServer}/v1/oauth`);
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
        }
      } catch (err) {
        console.error('Error loading OAuth providers:', err);
        // We still want to show the page even if OAuth providers fail to load
      } finally {
        // Mark the page as ready to render
        setIsPageReady(true);
      }
    };

    fetchProviders();
  }, []);

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

  const onOAuth2 = useCallback(
    (response: any) => {
      mutate();
      document.location.href = `${process.env.NEXT_PUBLIC_APP_URI}/chat`;
    },
    [mutate],
  );

  // Don't render anything until we're ready
  if (!isPageReady) {
    return <AuthCard title='Welcome' description='Loading authentication options...'></AuthCard>;
  }

  const showEmail = process.env.NEXT_PUBLIC_ALLOW_EMAIL_SIGN_IN === 'true';
  const showOAuth = providers.length > 0;

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

        {showEmail && showOAuth ? (
          <div className='flex items-center gap-2 my-2'>
            <Separator className='flex-1' />
            <span>or</span>
            <Separator className='flex-1' />
          </div>
        ) : null}

        {providers.map((provider) => (
          <OAuth2Login
            key={provider.name}
            authorizationUrl={provider.authorize}
            responseType='code'
            clientId={provider.client_id}
            scope={provider.scopes}
            redirectUri={`${process.env.NEXT_PUBLIC_APP_URI}/user/close/${provider.name.replaceAll('.', '-').replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`}
            onSuccess={onOAuth2}
            onFailure={onOAuth2}
            extraParams={{}} // Add default params or customize based on provider if needed
            isCrossOrigin
            render={(renderProps) => (
              <Button variant='outline' type='button' className='space-x-1 bg-transparent' onClick={renderProps.onClick}>
                <span className='text-lg'>{getIconByName(provider.name)}</span>
                {provider.name.toLowerCase() === 'x' ? (
                  <span>Continue with &#120143; (Twitter) account</span>
                ) : (
                  <span>Continue with {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)} account</span>
                )}
              </Button>
            )}
          />
        ))}
      </form>
    </AuthCard>
  );
}
