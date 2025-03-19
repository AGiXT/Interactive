'use client';

import React, { FormEvent, ReactNode, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { getCookie } from 'cookies-next';
import QRCode from 'react-qr-code';
import ReCAPTCHA from 'react-google-recaptcha';
import { LuCheck as Check, LuCopy as Copy } from 'react-icons/lu';
import AuthCard from '@/components/layout/AuthCard';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { LuMail as Mail, LuLoader as Loader2 } from 'react-icons/lu';
import { Disclosure, DisclosureContent, DisclosureTrigger } from '@/components/ui/disclosure';

export default function Login({ searchParams }: { searchParams: { otp_uri?: string } }): ReactNode {
  const [responseMessage, setResponseMessage] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [copyButtonState, setCopyButtonState] = useState({
    isCopied: false,
  });
  const [missingAuthState, setMissingAuthState] = useState({
    loading: {
      email: false,
      sms: false,
    },
  });

  const submitForm = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captcha) {
      setResponseMessage('Please complete the reCAPTCHA.');
      return;
    }

    const formData = Object.fromEntries(new FormData((event.currentTarget as HTMLFormElement) ?? undefined));
    try {
      const response = await axios
        .post(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/login`, {
          ...formData,
          referrer: getCookie('href') ?? window.location.href.split('?')[0],
        })
        .catch((exception: AxiosError) => exception.response);
      if (response) {
        if (response.status !== 200) {
          setResponseMessage(response.data.detail);
        } else {
          let isURI = false;
          try {
            new URL(response.data.detail);
            isURI = true;
          } catch {
            isURI = false;
          }
          if (isURI) {
            window.location.href = response.data.detail;
          } else {
            console.error('Is not URI.');
            setResponseMessage(response.data.detail);
          }
        }
      }
    } catch (exception) {
      console.error(exception);
    }
  };

  const handleEmailSend = async () => {
    setMissingAuthState((prev) => ({
      ...prev,
      loading: { ...prev.loading, email: true },
    }));

    axios.post(
      `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user/mfa/email`,
      {
        email: getCookie('email'),
      },
      {
        headers: {
          Authorization: getCookie('jwt'),
        },
      },
    );

    setMissingAuthState((prev) => ({
      ...prev,
      loading: { ...prev.loading, email: false },
    }));
  };

  const handleSMSSend = async () => {
    setMissingAuthState((prev) => ({
      ...prev,
      loading: { ...prev.loading, sms: true },
    }));

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setMissingAuthState((prev) => ({
      ...prev,
      loading: { ...prev.loading, sms: false },
    }));
  };

  const handleCopyLink = (uri: string) => {
    setCopyButtonState({ isCopied: true });
    navigator.clipboard.writeText(uri);
    setTimeout(() => setCopyButtonState({ isCopied: false }), 2000);
  };

  const otp_uri = searchParams?.otp_uri || '';

  return (
    <AuthCard title='Login' description='Please login to your account.' showBackButton>
      <form onSubmit={submitForm} className='flex flex-col gap-4'>
        {otp_uri && (
          <div className='flex flex-col max-w-xs gap-2 mx-auto text-center'>
            <div
              style={{
                padding: '0.5rem',
                backgroundColor: 'white',
              }}
            >
              <QRCode
                size={256}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                value={otp_uri}
                viewBox={`0 0 256 256`}
              />
            </div>
            <p className='text-sm text-center text-muted-foreground'>
              Scan the above QR code with Microsoft Authenticator, Google Authenticator or equivalent (or click the copy
              button if you are using your Authenticator device).
            </p>

            {/* Copy button inline */}
            <Button
              variant='outline'
              size='sm'
              type='button'
              className='flex items-center gap-2 mx-auto'
              onClick={() => handleCopyLink(otp_uri)}
            >
              {copyButtonState.isCopied ? <Check className='w-4 h-4' /> : <Copy className='w-4 h-4' />}
              {copyButtonState.isCopied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        )}
        <input type='hidden' id='email' name='email' value={getCookie('email')} />
        <Label htmlFor='token'>Multi-Factor Code</Label>
        <div className='flex justify-center'>
          <InputOTP maxLength={6} name='token' id='token' autoFocus>
            <InputOTPGroup>
              <InputOTPSlot className='w-[50px] h-12 text-lg' index={0} />
              <InputOTPSlot className='w-[50px] h-12 text-lg' index={1} />
              <InputOTPSlot className='w-[50px] h-12 text-lg' index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot className='w-[50px] h-12 text-lg' index={3} />
              <InputOTPSlot className='w-[50px] h-12 text-lg' index={4} />
              <InputOTPSlot className='w-[50px] h-12 text-lg' index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Missing Authenticator inline */}
        <Disclosure>
          <DisclosureTrigger>
            <Button className='w-full bg-transparent' type='button' variant='outline'>
              I don&apos;t have my authenticator
            </Button>
          </DisclosureTrigger>
          <DisclosureContent>
            <div className='p-2 space-y-2'>
              <Button
                onClick={handleEmailSend}
                disabled={missingAuthState.loading.email}
                variant='outline'
                type='button'
                size='sm'
                className='flex w-full gap-2 bg-transparent'
              >
                {missingAuthState.loading.email ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Mail className='w-4 h-4' />
                )}
                Send Email Code
              </Button>

              {/* <Button
                onClick={handleSMSSend}
                disabled={missingAuthState.loading.sms}
                variant='outline'
                type='button'
                size='sm'
                className='flex w-full gap-2 bg-transparent'
              >
                {missingAuthState.loading.sms ? <Loader2 className='w-4 h-4 animate-spin' /> : <MessageSquare className='w-4 h-4' />}
                Send SMS Code
              </Button> */}
            </div>
          </DisclosureContent>
        </Disclosure>

        {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
          <div className='my-3'>
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
              onChange={(token: string | null) => {
                setCaptcha(token);
              }}
            />
          </div>
        )}

        <Button type='submit'>{responseMessage ? 'Continue' : 'Login'}</Button>
        {responseMessage && <AuthCard.ResponseMessage>{responseMessage}</AuthCard.ResponseMessage>}
      </form>
    </AuthCard>
  );
}
