'use client';
import axios, { AxiosError } from 'axios';
import { getCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import React, { FormEvent, ReactNode, useCallback, useEffect, useState, useRef } from 'react';
import { ReCAPTCHA } from 'react-google-recaptcha';
import AuthCard from '@/components/layout/AuthCard';
import { toTitleCase } from '@/components/layout/dynamic-form/DynamicForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RiGithubFill as GitHub, RiGoogleFill as Google, RiMicrosoftFill as Microsoft } from 'react-icons/ri';
import { BsTwitterX } from 'react-icons/bs';
import { SiTesla } from 'react-icons/si';
import { FaAws } from 'react-icons/fa';
import { FaDiscord } from 'react-icons/fa';
import { TbBrandWalmart } from 'react-icons/tb';
import OAuth2Login from 'react-simple-oauth2-login';
import { useAgent } from '@/components/interactive/useAgent';
import { Separator } from '@/components/ui/separator';

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

// OAuth component that fetches providers from API
const OAuth = () => {
  const { mutate } = useAgent();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isPageReady, setIsPageReady] = useState<boolean>(false);

  // Fetch providers from API
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth`);
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers || []);
        }
      } catch (err) {
        console.error('Error loading OAuth providers:', err);
      } finally {
        setIsPageReady(true);
      }
    };

    fetchProviders();
  }, []);

  const onOAuth2 = useCallback(
    (response: any) => {
      mutate();
      document.location.href = `${process.env.NEXT_PUBLIC_APP_URI}/chat`;
    },
    [mutate],
  );

  if (!isPageReady || providers.length === 0) {
    return null; // Don't render anything if providers aren't loaded or if there are none
  }

  return (
    <>
      <div className='flex items-center gap-2 my-2'>
        <Separator className='flex-1' />
        <span>or sign up with</span>
        <Separator className='flex-1' />
      </div>

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
    </>
  );
};

export default function Register(): ReactNode {
  const formRef = useRef(null);
  const router = useRouter();
  const additionalFields = ['first_name', 'last_name'];
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [invite, setInvite] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showEmail = process.env.NEXT_PUBLIC_ALLOW_EMAIL_SIGN_IN === 'true';

  const submitForm = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    // Prevent double submission
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captcha) {
      setResponseMessage('Please complete the reCAPTCHA.');
      setIsSubmitting(false);
      return;
    }

    const formData = Object.fromEntries(new FormData((event.currentTarget as HTMLFormElement) ?? undefined));
    if (getCookie('invitation')) {
      formData['invitation_id'] = getCookie('invitation') ?? ''.toString();
    }

    let registerResponse;
    let registerResponseData;

    try {
      registerResponse = await axios
        .post(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user`, {
          ...formData,
        })
        .catch((exception: AxiosError) => {
          console.error('AUTH REQUEST ERROR');
          console.error(exception);
          return exception.response;
        });

      registerResponseData = registerResponse?.data;
    } catch (exception) {
      console.error('Error during registration:', exception);
      registerResponse = null;
    }

    setResponseMessage(registerResponseData?.detail);

    const loginParams = [];
    if (registerResponseData?.otp_uri) {
      loginParams.push(`otp_uri=${registerResponseData?.otp_uri}`);
    }
    if (registerResponseData?.verify_email) {
      loginParams.push(`verify_email=true`);
    }
    if (registerResponseData?.verify_sms) {
      loginParams.push(`verify_sms=true`);
    }

    if ([200, 201].includes(registerResponse?.status || 500)) {
      router.push(loginParams.length > 0 ? `/user/login?${loginParams.join('&')}` : '/user/login');
    } else {
      console.error('Error during registration:', registerResponseData);
      setIsSubmitting(false); // Reset submitting state on error
    }
  };

  // Check for invitation cookie
  useEffect(() => {
    if (getCookie('invitation')) {
      setInvite(getCookie('company') || '');
    }
  }, []);

  // Auto-submit if no additional fields are needed
  useEffect(() => {
    // Only auto-submit once and only if there are no fields to fill out
    if (!submitted && formRef.current && additionalFields.length === 0 && !isSubmitting) {
      setSubmitted(true);
      // Use a small delay to prevent potential race conditions with other effects
      const timer = setTimeout(() => {
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [submitted, additionalFields.length, isSubmitting]);

  // Only render the component if additionalFields has elements or showEmail is false
  if (additionalFields.length === 0 && showEmail) {
    return null;
  }

  return (
    <AuthCard
      title={invite !== null ? 'Accept Invitation to ' + (invite.replaceAll('+', ' ') || 'Company') : 'Sign Up'}
      description={`Welcome, please complete your registration. ${invite !== null ? 'You are ' : ''}${invite ? ' to ' + invite.replaceAll('+', ' ') + '.' : ''}${invite !== null ? '.' : ''}`}
      showBackButton
    >
      <form onSubmit={submitForm} className='flex flex-col gap-4' ref={formRef}>
        <input type='hidden' id='email' name='email' value={getCookie('email')} />
        {additionalFields.length > 0 &&
          additionalFields.map((field) => (
            <div key={field} className='space-y-1'>
              <Label htmlFor={field}>{toTitleCase(field)}</Label>
              <Input key={field} id={field} name={field} type='text' required placeholder={toTitleCase(field)} />
            </div>
          ))}
        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <div
            style={{
              margin: '0.8rem 0',
            }}
          >
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              onChange={(token: string | null) => {
                setCaptcha(token);
              }}
            />
          </div>
        )}
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? 'Registering...' : 'Register'}
        </Button>
        {responseMessage && <AuthCard.ResponseMessage>{responseMessage}</AuthCard.ResponseMessage>}
      </form>
      {invite && <OAuth />}
    </AuthCard>
  );
}
