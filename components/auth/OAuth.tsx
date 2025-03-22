'use client';

import { useAgent } from '@/components/interactive/useAgent';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback } from 'react';
import OAuth2Login from 'react-simple-oauth2-login';
import {
  RiGithubFill as GitHub,
  RiGoogleFill as Google,
  RiMicrosoftFill as Microsoft,
  RiShoppingCartLine as ShoppingCartOutlined,
} from 'react-icons/ri';
import { BsTwitterX } from 'react-icons/bs';
import { SiTesla } from 'react-icons/si';
import { FaAws } from 'react-icons/fa';
import { TbBrandWalmart } from 'react-icons/tb';

export const providers = {
  Amazon: {
    client_id: process.env.NEXT_PUBLIC_AMAZON_CLIENT_ID,
    scope: 'profile',
    uri: 'https://www.amazon.com/ap/oa',
    params: {},
    icon: <FaAws />,
  },
  Tesla: {
    client_id: process.env.NEXT_PUBLIC_TESLA_CLIENT_ID,
    scope: 'openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_location',
    uri: 'https://auth.tesla.com/oauth2/v3/authorize',
    params: {},
    icon: <SiTesla />,
  },
  GitHub: {
    client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
    scope: process.env.NEXT_PUBLIC_GITHUB_SCOPES || 'user:email',
    uri: 'https://github.com/login/oauth/authorize',
    params: {},
    icon: <GitHub />,
  },
  Google: {
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    scope: process.env.NEXT_PUBLIC_GOOGLE_SCOPES || 'profile email https://www.googleapis.com/auth/gmail.send',
    uri: 'https://accounts.google.com/o/oauth2/v2/auth',
    params: {
      access_type: 'offline',
    },
    icon: <Google />,
  },
  Microsoft: {
    client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
    scope:
      process.env.NEXT_PUBLIC_MICROSOFT_SCOPES ||
      'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite.Shared',
    uri: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    params: {},
    icon: <Microsoft />,
  },
  X: {
    client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID,
    scope:
      'tweet.read tweet.write users.read offline.access like.read like.write follows.read follows.write dm.read dm.write',
    uri: 'https://twitter.com/i/oauth2/authorize',
    params: {},
    icon: <BsTwitterX />,
  },
  Walmart: {
    client_id: process.env.NEXT_PUBLIC_WALMART_CLIENT_ID,
    scope: 'orders items inventory pricing reports returns',
    uri: 'https://developer.walmart.com/api/oauth/authorize',
    params: {},
    icon: <TbBrandWalmart />,
  },
};

export default function OAuth(): ReactNode {
  const router = useRouter();
  const { mutate } = useAgent();
  const onOAuth2 = useCallback(
    (response: any) => {
      mutate();
      document.location.href = `${process.env.NEXT_PUBLIC_APP_URI}/chat`;
    },
    [router],
  );
  return (
    <>
      {Object.entries(providers).map(([key, provider]) => {
        return (
          provider.client_id && (
            <OAuth2Login
              key={key}
              authorizationUrl={provider.uri}
              responseType='code'
              clientId={provider.client_id}
              scope={provider.scope}
              redirectUri={`${process.env.NEXT_PUBLIC_APP_URI}/user/close/${key.replaceAll('.', '-').replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`}
              onSuccess={onOAuth2}
              onFailure={onOAuth2}
              extraParams={provider.params}
              isCrossOrigin
              render={(renderProps) => (
                <Button variant='outline' type='button' className='space-x-1 bg-transparent' onClick={renderProps.onClick}>
                  <span className='text-lg'>{provider.icon}</span>
                  {key === 'X' ? (
                    <span>Continue with &#120143; (Twitter) account</span>
                  ) : (
                    <span>Continue with {key} account</span>
                  )}
                </Button>
              )}
            />
          )
        );
      })}
    </>
  );
}
