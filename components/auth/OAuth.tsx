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
import { FaAws, FaDiscord } from 'react-icons/fa';
import { TbBrandWalmart } from 'react-icons/tb';

// Type definitions for provider data
interface ApiProvider {
  name: string;
  scopes: string;
  authorize: string;
  client_id: string;
}

interface ProviderWithIcon {
  client_id: string;
  scope: string;
  uri: string;
  params: Record<string, any>;
  icon: ReactNode;
}

// Empty providers object that will be populated from the API
export const providers: Record<string, ProviderWithIcon> = {};

// Global loading state to track if providers have been loaded
let providersLoaded = false;
let loadingPromise: Promise<void> | null = null;

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
      // Default icon for providers without specific icons
      return <ShoppingCartOutlined />;
  }
};

// Function to load providers data
export const loadProviders = async (): Promise<void> => {
  if (providersLoaded) {
    return;
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth`);
        if (!response.ok) {
          throw new Error('Failed to fetch OAuth providers');
        }

        const data = await response.json();
        const fetchedProviders = data.providers || [];

        // Clear existing providers
        Object.keys(providers).forEach((key) => delete providers[key]);

        // Populate providers object
        fetchedProviders.forEach((provider: ApiProvider) => {
          const name = provider.name.charAt(0).toUpperCase() + provider.name.slice(1);
          providers[name] = {
            client_id: provider.client_id,
            scope: provider.scopes,
            uri: provider.authorize,
            params: name.toLowerCase() === 'google' ? { access_type: 'offline' } : {},
            icon: getIconByName(provider.name),
          };
        });

        providersLoaded = true;
      } catch (err) {
        console.error('Error loading OAuth providers:', err);
        // Reset loading promise so we can try again
        loadingPromise = null;
      }
    })();
  }

  return loadingPromise;
};

// Load providers immediately (but don't block rendering)
loadProviders();

export default function OAuth(): ReactNode {
  const router = useRouter();
  const { mutate } = useAgent();
  const [loading, setLoading] = useState(!providersLoaded);
  const [error, setError] = useState<string | null>(null);
  const [apiProviders, setApiProviders] = useState<ApiProvider[]>([]);

  // Ensure providers are loaded before rendering
  useEffect(() => {
    if (!providersLoaded) {
      setLoading(true);
      loadProviders()
        .then(() => {
          setApiProviders(
            Object.entries(providers).map(([key, value]) => ({
              name: key.toLowerCase(),
              scopes: value.scope,
              authorize: value.uri,
              client_id: value.client_id,
            })),
          );
          setLoading(false);
        })
        .catch((err) => {
          setError('Error loading OAuth providers');
          setLoading(false);
          console.error(err);
        });
    } else {
      // Providers already loaded, just set them in state
      setApiProviders(
        Object.entries(providers).map(([key, value]) => ({
          name: key.toLowerCase(),
          scopes: value.scope,
          authorize: value.uri,
          client_id: value.client_id,
        })),
      );
      setLoading(false);
    }
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
      {apiProviders
        .filter((provider) => provider.client_id) // Only show providers with client_id
        .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically by name
        .map((provider) => {
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
              extraParams={provider.name.toLowerCase() === 'google' ? { access_type: 'offline' } : {}}
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
