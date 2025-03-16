'use client';

import React, { FormEvent, ReactNode, useState } from 'react';
import axios, { AxiosError } from 'axios';
import { getCookie } from 'cookies-next';
import QRCode from 'react-qr-code';
import ReCAPTCHA from 'react-google-recaptcha';
import { LuCheck as Check, LuCopy as Copy } from 'react-icons/lu';
import AuthCard from '@/components/auth/AuthCard';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';
import { LuMail as Mail, LuLoader as Loader2 } from 'react-icons/lu';
import { Disclosure, DisclosureContent, DisclosureTrigger } from '@/components/ui/disclosure';

export const MissingAuthenticator = () => {
  const [loading, setLoading] = useState({
    email: false,
    sms: false,
  });

  const handleEmailSend = async () => {
    setLoading((prev) => ({ ...prev, email: true }));
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
    setLoading((prev) => ({ ...prev, email: false }));
  };

  const handleSMSSend = async () => {
    setLoading((prev) => ({ ...prev, sms: true }));
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading((prev) => ({ ...prev, sms: false }));
  };

  return (
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
            disabled={loading.email}
            variant='outline'
            type='button'
            size='sm'
            className='flex w-full gap-2 bg-transparent'
          >
            {loading.email ? <Loader2 className='w-4 h-4 animate-spin' /> : <Mail className='w-4 h-4' />}
            Send Email Code
          </Button>

          {/* <Button
            onClick={handleSMSSend}
            disabled={loading.sms}
            variant='outline'
            type='button'
            size='sm'
            className='flex w-full gap-2 bg-transparent'
          >
            {loading.sms ? <Loader2 className='w-4 h-4 animate-spin' /> : <MessageSquare className='w-4 h-4' />}
            Send SMS Code
          </Button> */}
        </div>
      </DisclosureContent>
    </Disclosure>
  );
};

export type LoginProps = {
  userLoginEndpoint?: string;
};
export default function Login({
  searchParams,
  userLoginEndpoint = '/v1/login',
}: { searchParams: any } & LoginProps): ReactNode {
  const [responseMessage, setResponseMessage] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);

  const submitForm = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && !captcha) {
      setResponseMessage('Please complete the reCAPTCHA.');
      return;
    }

    const formData = Object.fromEntries(new FormData((event.currentTarget as HTMLFormElement) ?? undefined));
    try {
      const response = await axios
        .post(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}${userLoginEndpoint}`, {
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
  const otp_uri = searchParams.otp_uri;
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
                value={otp_uri ?? ''}
                viewBox={`0 0 256 256`}
              />
            </div>
            <p className='text-sm text-center text-muted-foreground'>
              Scan the above QR code with Microsoft Authenticator, Google Authenticator or equivalent (or click the copy
              button if you are using your Authenticator device).
            </p>
            <CopyButton otp_uri={otp_uri} />
          </div>
        )}
        <input type='hidden' id='email' name='email' value={getCookie('email')} />
        <Label htmlFor='token'>Multi-Factor Code</Label>
        <OTPInput name='token' id='token' />
        <MissingAuthenticator />
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

const CopyButton = ({ otp_uri }: { otp_uri: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <Button
      variant='outline'
      size='sm'
      type='button'
      className='flex items-center gap-2 mx-auto'
      onClick={() => {
        setIsCopied(true);
        navigator.clipboard.writeText(otp_uri);
        setTimeout(() => setIsCopied(false), 2000);
      }}
    >
      {isCopied ? <Check className='w-4 h-4' /> : <Copy className='w-4 h-4' />}
      {isCopied ? 'Copied!' : 'Copy Link'}
    </Button>
  );
};

export function OTPInput({ name, id }: { name?: string; id?: string }) {
  return (
    <div className='flex justify-center'>
      <InputOTP maxLength={6} name={name} id={id} autoFocus>
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
  );
}
