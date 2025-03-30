'use client';

import { useCallback, useEffect, useState, ReactNode } from 'react';
import { useAgent } from '@/components/interactive/useAgent';
import OAuth2Login from 'react-simple-oauth2-login';
import { Button } from '@/components/ui/button';
import { RiGithubFill as GitHub, RiGoogleFill as Google, RiMicrosoftFill as Microsoft } from 'react-icons/ri';
import { BsTwitterX } from 'react-icons/bs';
import { SiTesla } from 'react-icons/si';
import { FaAws } from 'react-icons/fa';
import { FaDiscord } from 'react-icons/fa';
import { TbBrandWalmart } from 'react-icons/tb';

// Provider type definition
interface Provider {
  name: string;
  scopes: string;
  authorize: string;
  client_id: string;
}

// Props for the OAuth component
interface OAuthProps {
  className?: string;
  showSeparator?: boolean;
  separatorText?: string;
  onSuccess?: (response: any) => void;
  showLoadingMessage?: boolean;
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

export default function OAuth({
  className = '',
  showSeparator = false,
  separatorText = 'or',
  onSuccess,
  showLoadingMessage = false,
}: OAuthProps): ReactNode {
  const { mutate } = useAgent();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const authServer = `${process.env.NEXT_PUBLIC_AGIXT_SERVER}`;

  // Fetch providers from API
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const response = await fetch(`${authServer}/v1/oauth`);
        if (!response.ok) {
          throw new Error('Failed to fetch OAuth providers');
        }
        const data = await response.json();
        setProviders(data.providers || []);
      } catch (err) {
        setError('Error loading OAuth providers');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProviders();
  }, [authServer]);

  const handleOAuth2Success = useCallback(
    (response: any) => {
      mutate();

      // If a custom onSuccess handler is provided, use it
      if (onSuccess) {
        onSuccess(response);
        return;
      }

      // Default behavior: redirect to chat
      document.location.href = `${process.env.NEXT_PUBLIC_APP_URI}/chat`;
    },
    [mutate, onSuccess],
  );

  // If there are no providers or we're still loading and don't want to show a message, render nothing
  if ((providers.length === 0 && !isLoading) || (isLoading && !showLoadingMessage)) {
    return null;
  }

  return (
    <div className={className}>
      {showSeparator && providers.length > 0 && (
        <div className='flex items-center gap-2 my-2'>
          <div className='flex-1 h-px bg-border'></div>
          <span className='text-sm text-muted-foreground'>{separatorText}</span>
          <div className='flex-1 h-px bg-border'></div>
        </div>
      )}

      {isLoading && showLoadingMessage ? (
        <div className='text-center py-2 text-sm text-muted-foreground'>Loading authentication options...</div>
      ) : error ? (
        <div className='text-center py-2 text-sm text-destructive'>{error}</div>
      ) : (
        <div className='flex flex-col gap-2'>
          {providers.map((provider) => (
            <OAuth2Login
              key={provider.name}
              authorizationUrl={provider.authorize}
              responseType='code'
              clientId={provider.client_id}
              scope={provider.scopes}
              redirectUri={`${process.env.NEXT_PUBLIC_APP_URI}/user/close/${provider.name.replaceAll('.', '-').replaceAll(' ', '-').replaceAll('_', '-').toLowerCase()}`}
              onSuccess={handleOAuth2Success}
              onFailure={handleOAuth2Success}
              extraParams={{}} // Add default params or customize based on provider if needed
              isCrossOrigin
              render={(renderProps) => (
                <Button
                  variant='outline'
                  type='button'
                  className='space-x-1 bg-transparent w-full justify-start'
                  onClick={renderProps.onClick}
                >
                  <span className='text-lg mr-2'>{getIconByName(provider.name)}</span>
                  {provider.name.toLowerCase() === 'x' ? (
                    <span>Continue with &#120143; (Twitter) account</span>
                  ) : (
                    <span>Continue with {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)} account</span>
                  )}
                </Button>
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
