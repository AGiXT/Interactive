'use client';

import { useAgent } from '@/components/interactive/useAgent';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useState } from 'react';
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

// Empty providers object that will be populated from the API
export const providers: Record<
  string,
  {
    client_id: string;
    scope: string;
    uri: string;
    params: Record<string, any>;
    icon: ReactNode;
  }
> = {};

// Icon mapping function based on provider name
const getIconByName = (name: string): ReactNode => {
  const lowercaseName = name.toLowerCase();

  switch (lowercaseName) {
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
      // Default icon for providers without specific icons
      return <ShoppingCartOutlined />;
  }
};

// Fetch providers immediately on module import to populate the providers object
(async () => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth`);
    if (response.ok) {
      const data = await response.json();
      const fetchedProviders = data.providers || [];

      // Clear existing providers
      Object.keys(providers).forEach((key) => delete providers[key]);

      // Populate providers object for compatibility with other components
      fetchedProviders.forEach((provider: any) => {
        const name = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
        providers[name] = {
          client_id: provider.client_id,
          scope: provider.scopes,
          uri: provider.authorize,
          params: name.toLowerCase() === 'google' ? { access_type: 'offline' } : {},
          icon: getIconByName(provider.name),
        };
      });
    }
  } catch (err) {
    console.error('Error loading OAuth providers:', err);
  }
})();

export default function OAuth(): ReactNode {
  const router = useRouter();
  const { mutate } = useAgent();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiProviders, setApiProviders] = useState<any[]>([]);

  // Fetch providers from API
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth`);
        if (!response.ok) {
          throw new Error('Failed to fetch OAuth providers');
        }

        const data = await response.json();
        const fetchedProviders = data.providers || [];
        setApiProviders(fetchedProviders);

        // Update the exported providers object
        Object.keys(providers).forEach((key) => delete providers[key]);

        fetchedProviders.forEach((provider: any) => {
          const name = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
          providers[name] = {
            client_id: provider.client_id,
            scope: provider.scopes,
            uri: provider.authorize,
            params: name.toLowerCase() === 'google' ? { access_type: 'offline' } : {},
            icon: getIconByName(provider.name),
          };
        });
      } catch (err) {
        setError('Error loading OAuth providers');
        console.error(err);
      } finally {
        setLoading(false);
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

  if (loading) {
    return <div>Loading authentication options...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <>
      {apiProviders.map((provider) => {
        const name = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
        return (
          <OAuth2Login
            key={provider.name}
            authorizationUrl={provider.authorize}
            responseType='code'
            clientId={provider.client_id}
            scope={provider.scopes}
            redirectUri={`${process.env.NEXT_PUBLIC_APP_URI}/user/close/${provider.name.replaceAll('.', '-').replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`}
            onSuccess={onOAuth2}
            onFailure={onOAuth2}
            extraParams={name.toLowerCase() === 'google' ? { access_type: 'offline' } : {}}
            isCrossOrigin
            render={(renderProps) => (
              <Button variant='outline' type='button' className='space-x-1 bg-transparent' onClick={renderProps.onClick}>
                <span className='text-lg'>{getIconByName(provider.name)}</span>
                {provider.name.toLowerCase() === 'x' ? (
                  <span>Continue with &#120143; (Twitter) account</span>
                ) : (
                  <span>Continue with {name} account</span>
                )}
              </Button>
            )}
          />
        );
      })}
    </>
  );
}
