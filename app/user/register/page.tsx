'use client';
import axios, { AxiosError } from 'axios';
import { getCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import React, { FormEvent, ReactNode, useEffect, useState, useRef } from 'react';
import { ReCAPTCHA } from 'react-google-recaptcha';
import AuthCard from '@/components/layout/AuthCard';
import { toTitleCase } from '@/components/layout/dynamic-form/DynamicForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import OAuth from '@/components/auth/OAuth';

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
    const invitation = getCookie('invitation');
    const emailCookie = getCookie('email');
    const company = getCookie('company');
    
    if (invitation) {
      setInvite(company?.toString() || '');
      
      // Pre-fill email field if available
      if (emailCookie && formRef.current) {
        const emailInput = formRef.current.querySelector('input[name="email"]');
        if (emailInput) {
          emailInput.value = emailCookie.toString();
        }
      }
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
