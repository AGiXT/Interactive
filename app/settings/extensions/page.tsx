'use client';
import { SidebarPage } from '@/components/layout/SidebarPage';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import { useAgent } from '@/components/interactive/useAgent';
import { useCompany } from '@/components/interactive/useUser';
import { useEffect, useState } from 'react';
import OAuth2Login from 'react-simple-oauth2-login';
import { providers as oAuth2Providers, loadProviders as loadOAuthProviders } from '@/components/auth/OAuth';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Unlink, Wrench } from 'lucide-react';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Extension({
  extension,
  connected,
  onDisconnect,
  onConnect,
  settings = {},
  setSettings,
  error,
  setSelectedExtension = () => {},
}) {
  return (
    <div className='flex flex-col gap-2 p-3 transition-colors border rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='flex items-center gap-2'>
        <div className='flex items-center flex-1 min-w-0 gap-3.5'>
          <Wrench className='flex-shrink-0 w-5 h-5 text-muted-foreground' />
          <div>
            <h4 className='font-medium truncate'>{extension.friendly_name || extension.extension_name}</h4>
            <p className='text-sm text-muted-foreground'>{connected ? 'Connected' : 'Not Connected'}</p>
          </div>
        </div>

        {connected ? (
          <Button variant='outline' size='sm' className='gap-2' onClick={() => onDisconnect(extension)}>
            <Unlink className='w-4 h-4' />
            Disconnect
          </Button>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant='outline'
                size='sm'
                className='gap-2'
                onClick={() => {
                  setSelectedExtension(extension.extension_name);
                  setSettings(extension.settings.reduce((acc, setting) => ({ ...acc, [setting]: '' }), {}));
                }}
              >
                <Plus className='w-4 h-4' />
                Connect
              </Button>
            </DialogTrigger>
            <DialogContent className='sm:max-w-[425px]'>
              <DialogHeader>
                <DialogTitle>Configure {extension.friendly_name || extension.extension_name}</DialogTitle>
                <DialogDescription>Enter the required credentials to enable this service.</DialogDescription>
              </DialogHeader>

              <div className='grid gap-4 py-4'>
                {extension.settings.map((setting) => (
                  <div key={setting} className='grid gap-2'>
                    <Label htmlFor={setting}>{setting}</Label>
                    <Input
                      id={setting}
                      type={
                        setting.toLowerCase().includes('key') || setting.toLowerCase().includes('password')
                          ? 'password'
                          : 'text'
                      }
                      value={settings[setting] || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          [setting]: e.target.value,
                        }))
                      }
                      placeholder={`Enter ${setting.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={() => onConnect(extension.extension_name, settings)}>Connect Extension</Button>
              </DialogFooter>

              {error && (
                <Alert variant={error.type === 'success' ? 'default' : 'destructive'}>
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className='text-sm text-muted-foreground'>
        <MarkdownBlock content={extension.description || 'No description available'} />
      </div>
    </div>
  );
}

interface ConnectedService {
  provider: string;
  connected: boolean;
}

const providerDescriptions = {
  Google:
    'Connect your Google account to enable AI interactions with Gmail and Google Calendar. This allows agents to read and send emails, manage your calendar events, and help organize your digital life.',
  Microsoft:
    'Link your Microsoft account to enable AI management of Outlook emails and calendar. Your agents can help schedule meetings, respond to emails, and keep your calendar organized.',
  GitHub:
    'Connect to GitHub to enable AI assistance with repository management. Agents can help analyze codebases, create pull requests, review code changes, and manage issues.',
  Tesla:
    'Link your Tesla account to enable AI control of your vehicle. Agents can help manage charging, climate control, and other vehicle settings.',
  Amazon:
    'Connect your Amazon account to enable AI interactions with your shopping experience. Agents can help manage your orders, track deliveries, and assist with product recommendations.',
  X: 'Connect your X (Twitter) account to enable AI interactions with your social media. Agents can help manage your posts, analyze engagement, and assist with content creation.',
  Walmart: 'Connect your Walmart account to enable AI interactions with your shopping experience.',
};

export const ConnectedServices = () => {
  const [connectedServices, setConnectedServices] = useState<ConnectedService[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Separate loading states
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [isLoadingPkce, setIsLoadingPkce] = useState(false);
  const [pkceData, setPkceData] = useState<{ challenge: string; state: string } | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{
    isOpen: boolean;
    provider: string | null;
  }>({
    isOpen: false,
    provider: null,
  });
  // State to explicitly track if the initial provider load function has resolved
  const [providersLoadAttempted, setProvidersLoadAttempted] = useState(false);

  // --- Effect 1: Load OAuth Provider Configurations ---
  useEffect(() => {
    console.log('Attempting to load OAuth providers...');
    setIsLoadingProviders(true);
    loadOAuthProviders()
      .then(() => {
        console.log('loadOAuthProviders resolved. oAuth2Providers object:', oAuth2Providers);
        // Check if providers object is actually populated
        if (Object.keys(oAuth2Providers).length === 0) {
          console.warn('OAuth providers loaded, but the providers object is empty.');
          // Potentially set an error if this is unexpected
          // setError("Failed to retrieve provider configurations.");
        }
        setProvidersLoadAttempted(true); // Mark that the load function finished
      })
      .catch((err) => {
        console.error('Error loading OAuth providers:', err);
        setError('Failed to load authentication provider configurations.');
        setProvidersLoadAttempted(true); // Mark attempt even on error
      })
      .finally(() => {
        setIsLoadingProviders(false);
      });
  }, []); // Run only once on mount

  // --- Effect 2: Fetch User's Connections (after providers are loaded/attempted) ---
  useEffect(() => {
    // Only run if the provider load attempt is done AND wasn't loading anymore
    if (providersLoadAttempted && !isLoadingProviders) {
      // Check if providers actually loaded successfully before fetching connections
      if (Object.keys(oAuth2Providers).length > 0) {
        console.log('Providers loaded, fetching connections...');
        fetchConnections();
      } else {
        console.log('Skipping connection fetch because providers are empty.');
        // Ensure connections loading state is false if we skip
        setIsLoadingConnections(false);
      }
    }
  }, [providersLoadAttempted, isLoadingProviders]); // Depends on the load attempt completing

  // --- Effect 3: Fetch PKCE Data (after connections are known) ---
  useEffect(() => {
    // Only run if connections are loaded and we are not currently loading them
    if (!isLoadingConnections && connectedServices.length > 0) {
      const needsPkce = connectedServices.some((service) => {
        const providerData = oAuth2Providers[service.provider];
        // Check if provider exists AND requires PKCE
        return providerData?.pkce_required === true;
      });

      if (needsPkce && !pkceData && !isLoadingPkce) {
        // Avoid fetching if already loading or data exists
        const fetchPkce = async () => {
          console.log('Fetching PKCE data...');
          setIsLoadingPkce(true);
          setError(null); // Clear previous PKCE errors
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2/pkce-simple`);
            if (!res.ok) throw new Error(`Failed to fetch PKCE data (status: ${res.status})`);
            const data = await res.json();
            if (!data.code_challenge || !data.state) throw new Error('PKCE data missing challenge or state');
            console.log('PKCE data fetched successfully.');
            setPkceData({ challenge: data.code_challenge, state: data.state });
          } catch (err: any) {
            setError(`Failed to load security data: ${err.message}`);
            console.error('PKCE fetch error:', err);
            setPkceData(null); // Ensure pkceData is null on error
          } finally {
            setIsLoadingPkce(false);
          }
        };
        fetchPkce();
      } else if (!needsPkce) {
        // If no service needs PKCE, ensure loading is false and data is null
        if (isLoadingPkce) setIsLoadingPkce(false);
        if (pkceData) setPkceData(null);
      }
    } else if (!isLoadingConnections && connectedServices.length === 0) {
      // Handle case where connections are loaded but empty
      if (isLoadingPkce) setIsLoadingPkce(false);
      if (pkceData) setPkceData(null);
    }
  }, [connectedServices, isLoadingConnections, pkceData, isLoadingPkce]); // Dependencies

  // --- fetchConnections Function ---
  const fetchConnections = async () => {
    setIsLoadingConnections(true);
    setError(null); // Clear previous errors
    try {
      // Double check providers object is available here
      console.log('fetchConnections: Checking oAuth2Providers:', oAuth2Providers);
      if (Object.keys(oAuth2Providers).length === 0) {
        throw new Error('Provider configurations not available when fetching connections.');
      }

      const response = await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2`, {
        headers: { Authorization: getCookie('jwt') },
      });
      console.log('Connections data received:', response.data);

      // Filter keys from oAuth2Providers *first*, then map
      const allServices = Object.keys(oAuth2Providers)
        .filter((key) => {
          const providerExists = !!oAuth2Providers[key];
          const clientIdExists = !!oAuth2Providers[key]?.client_id;
          if (!providerExists) console.warn(`Provider key "${key}" found in object keys but data is missing.`);
          if (providerExists && !clientIdExists) console.warn(`Provider "${key}" is missing client_id.`);
          return providerExists && clientIdExists; // Ensure both exist
        })
        .map((key) => ({
          provider: key, // Keep original casing (e.g., "Google") for lookup
          connected: Array.isArray(response.data) ? response.data.includes(key.toLowerCase()) : false, // Check connection status using lowercase
        }))
        .sort((a, b) => a.provider.localeCompare(b.provider)); // Sort alphabetically

      console.log('Mapped and sorted services:', allServices);
      setConnectedServices(allServices);
    } catch (err: any) {
      console.error('Error fetching connections:', err);
      setError(err.message || 'Failed to fetch connected services');
      setConnectedServices([]); // Reset on error
    } finally {
      setIsLoadingConnections(false);
    }
  };

  // --- onSuccess Handler ---
  // Ensure onSuccess calls fetchConnections AFTER the post request
  const onSuccess = async (response: any, providerName: string) => {
    // Pass provider name explicitly
    // const provider = disconnectDialog.provider?.toLowerCase() || ''; // This was incorrect - relies on disconnect dialog
    const lowerCaseProviderName = providerName.toLowerCase();
    console.log(`OAuth success/callback triggered for: ${lowerCaseProviderName}`);
    // Clear dialog state if it was somehow involved (it shouldn't be for connect)
    // setDisconnectDialog({ isOpen: false, provider: null });

    try {
      const jwt = getCookie('jwt');

      if (!response.code) {
        console.error('No code received in OAuth response');
        setError(`OAuth failed: No authorization code received from ${providerName}.`);
        await fetchConnections(); // Refresh state even on failure
        return;
      }

      console.log(`Sending code to backend for ${lowerCaseProviderName}...`);
      // Show some intermediate loading state?
      await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2/${lowerCaseProviderName}`, // Use lowerCaseProviderName
        {
          code: response.code,
          // Send state back if it was used (PKCE)
          ...(pkceData && oAuth2Providers[providerName]?.pkce_required && { state: pkceData.state }),
          // Referrer might not be needed by backend, depends on implementation
          // referrer: `${process.env.NEXT_PUBLIC_APP_URI}/user/close/${lowerCaseProviderName}`,
        },
        {
          headers: { Authorization: jwt },
        },
      );
      console.log(`OAuth connection successful for ${lowerCaseProviderName}. Refreshing connections...`);
      await fetchConnections(); // Refresh the list
    } catch (err: any) {
      console.error(`OAuth post-callback error for ${lowerCaseProviderName}:`, err);
      let errorMsg = `Failed to connect ${providerName}.`;
      if (err.response?.data?.detail) {
        errorMsg += ` Server Error: ${err.response.data.detail}`;
      } else if (err.message) {
        errorMsg += ` Error: ${err.message}`;
      }
      if (err.config) {
        console.error('Failed request details:', {
          url: err.config.url,
          method: err.config.method,
          headers: err.config.headers,
          data: err.config.data,
        });
      }
      setError(errorMsg);
      await fetchConnections(); // Refresh state even on failure
    }
  };

  // handleDisconnect remains largely the same, ensure it calls fetchConnections
  const handleDisconnect = async (provider: string) => {
    console.log(`Disconnecting ${provider}...`);
    setError(null);
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2/${provider.toLowerCase()}`, {
        headers: { Authorization: getCookie('jwt') },
      });
      console.log(`${provider} disconnected successfully. Refreshing...`);
      await fetchConnections(); // Refresh list
      setDisconnectDialog({ isOpen: false, provider: null });
    } catch (err: any) {
      console.error('Error disconnecting service:', err);
      setError(err.message || `Failed to disconnect ${provider}`);
      // Still refresh potentially? Or leave the UI as is until user manually refreshes?
      // await fetchConnections();
    }
  };

  // --- Render Logic ---
  const isLoading = isLoadingProviders || isLoadingConnections || isLoadingPkce;

  // More specific loading messages
  if (isLoadingProviders) {
    return <div>Loading provider configurations...</div>;
  }
  if (isLoadingConnections) {
    return <div>Loading your connection status...</div>;
  }
  // Note: isLoadingPkce might be true briefly even if not needed, check needsPkce
  const needsPkce = connectedServices.some((s) => oAuth2Providers[s.provider]?.pkce_required);
  if (needsPkce && isLoadingPkce) {
    return <div>Loading security data...</div>;
  }

  return (
    <>
      {error && (
        <Alert variant='destructive' className='mb-4'>
          {' '}
          {/* Added margin */}
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='grid gap-4'>
        {/* Show message if loading finished but no services */}
        {!isLoading && connectedServices.length === 0 && !error && (
          <div className='p-4 text-center text-muted-foreground border rounded-lg'>
            No third-party services available for connection.
          </div>
        )}

        {connectedServices.map((service) => {
          // **Crucial Check**: Ensure provider data exists before rendering
          const provider = oAuth2Providers[service.provider];
          if (!provider) {
            console.warn(`Skipping render for service "${service.provider}" - provider data missing.`);
            return null; // Don't render if data is missing
          }

          const isPkceRequired = provider.pkce_required;
          // PKCE is ready if it's not required, OR if it is required AND pkceData is loaded
          const isPkceReady = !isPkceRequired || (isPkceRequired && !!pkceData);

          return (
            <div key={service.provider} className='flex flex-col space-y-4 p-4 border rounded-lg'>
              {/* ... Icon, Name, Status ... */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-4'>
                  {provider.icon || <Wrench className='w-6 h-6 text-muted-foreground' />} {/* Fallback icon */}
                  <div>
                    <p className='font-medium'>{service.provider}</p>
                    <p className='text-sm text-muted-foreground'>{service.connected ? 'Connected' : 'Not connected'}</p>
                  </div>
                </div>

                {service.connected ? (
                  <Button
                    variant='outline'
                    size='sm' // You might adjust size if needed
                    onClick={() =>
                      setDisconnectDialog({
                        isOpen: true,
                        provider: service.provider, // Use the correct provider name
                      })
                    }
                    className='space-x-1' // Add spacing if icon and text are together
                  >
                    <Unlink className='w-4 h-4 mr-2' /> {/* Include the icon */}
                    Disconnect {/* Include the text */}
                  </Button>
                ) : (
                  <OAuth2Login
                    authorizationUrl={provider.uri}
                    responseType='code'
                    clientId={provider.client_id}
                    state={getCookie('jwt')}
                    redirectUri={`${process.env.NEXT_PUBLIC_APP_URI}/user/close/${service.provider.toLowerCase()}`}
                    scope={provider.scope}
                    // Pass service.provider to onSuccess/onFailure
                    onSuccess={(res) => onSuccess(res, service.provider)}
                    onFailure={(err) => {
                      console.error('OAuth Failure:', service.provider, err);
                      setError(`Connection to ${service.provider} failed.`);
                    }} // Simple failure handler
                    isCrossOrigin
                    extraParams={
                      isPkceRequired && pkceData
                        ? {
                            code_challenge: pkceData.challenge,
                            code_challenge_method: 'S256',
                            pkce_state: pkceData.state,
                          }
                        : // Google specific param ONLY if NOT using PKCE for Google
                          !isPkceRequired && service.provider.toLowerCase() === 'google'
                          ? { access_type: 'offline' }
                          : {}
                    }
                    render={(renderProps) => {
                      // Disable button if PKCE is required but not ready, or if PKCE is currently loading
                      const isDisabled = (isPkceRequired && !isPkceReady) || isLoadingPkce;
                      return (
                        <Button
                          variant='outline'
                          onClick={renderProps.onClick}
                          className='space-x-1'
                          disabled={isDisabled} // Use calculated disabled state
                        >
                          <Plus className='w-4 h-4 mr-2' />
                          Connect {isDisabled && isPkceRequired ? '(Loading security...)' : ''}
                        </Button>
                      );
                    }}
                  />
                )}
              </div>
              {/* ... Description ... */}
              <p className='text-sm text-muted-foreground'>
                {providerDescriptions[service.provider] ||
                  provider.description ||
                  'Connect this service to enable AI integration.'}{' '}
                {/* Added provider.description as fallback */}
              </p>
            </div>
          );
        })}
      </div>

      <Dialog
        open={disconnectDialog.isOpen}
        onOpenChange={(open) => setDisconnectDialog({ isOpen: open, provider: open ? disconnectDialog.provider : null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {disconnectDialog.provider}</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your {disconnectDialog.provider} account? Your agents will no longer be
              able to interact with {disconnectDialog.provider} services.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDisconnectDialog({ isOpen: false, provider: null })}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => disconnectDialog.provider && handleDisconnect(disconnectDialog.provider)}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Types remain the same
type Command = {
  friendly_name: string;
  description: string;
  command_name: string;
  command_args: Record<string, string>;
  enabled?: boolean;
  extension_name?: string;
};

type Extension = {
  extension_name: string;
  description: string;
  settings: string[];
  commands: Command[];
};

type ErrorState = {
  type: 'success' | 'error';
  message: string;
} | null;

interface ExtensionSettings {
  agent_name: string;
  settings: Record<string, string>;
}

export default function Extensions() {
  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [searchText, setSearchText] = useState('');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorState>(null);
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;
  const { data: activeCompany, mutate: mutateCompany } = useCompany();

  const searchParams = useSearchParams();
  // Filter extensions for the enabled commands view
  const extensions = searchParams.get('mode') === 'company' ? activeCompany?.extensions || [] : agentData?.extensions || [];

  // Categorize extensions for the available tab
  const categorizeExtensions = (exts: Extension[]) => {
    return {
      // Connected extensions are those with settings and at least one command
      connectedExtensions: filterExtensions(
        exts.filter((ext) => ext.settings?.length > 0 && ext.commands?.length > 0),
        searchText,
      ),
      // Available extensions are those with settings that aren't connected yet
      availableExtensions: filterExtensions(
        exts.filter((ext) => ext.settings?.length > 0 && !ext.commands?.length),
        searchText,
      ),
    };
  };

  const handleSaveSettings = async (extensionName: string, settings: Record<string, string>) => {
    try {
      setError(null);
      const response = await axios.put<{ status: number; data: any }>(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${agent_name}`,
        {
          agent_name: agent_name,
          settings: settings,
        } as ExtensionSettings,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (response.status === 200) {
        setError({
          type: 'success',
          message: 'Extension connected successfully!',
        });
        window.location.reload();
      }
    } catch (error: any) {
      setError({
        type: 'error',
        message: error.response?.data?.detail || error.message || 'Failed to connect extension',
      });
    }
  };

  const handleDisconnect = async (extension: Extension) => {
    const emptySettings = extension.settings.reduce((acc, setting) => ({ ...acc, [setting]: '' }), {});
    await handleSaveSettings(extension.extension_name, emptySettings);
  };

  function filterExtensions(extensions, text) {
    return text
      ? extensions
      : extensions.filter(
          (ext) =>
            ext.extension_name.toLowerCase().includes(text.toLowerCase()) ||
            ext.description.toLowerCase().includes(text.toLowerCase()),
        );
  }

  const { connectedExtensions, availableExtensions } = categorizeExtensions(extensions);
  return (
    <SidebarPage title='Extensions'>
      <div className='space-y-6'>
        <div className='grid gap-4'>
          <p className='text-sm text-muted-foreground'>
            Manage your connected third-party extensions that grant your agent additional capabilities through abilities.
          </p>
          {searchParams.get('mode') !== 'company' && <ConnectedServices />}
          {connectedExtensions.map((extension) => (
            <Extension
              key={extension.extension_name}
              extension={extension}
              connected
              onDisconnect={handleDisconnect}
              settings={settings}
              onConnect={handleSaveSettings}
              setSettings={setSettings}
              error={error}
            />
          ))}

          {availableExtensions.map((extension) => (
            <Extension
              key={extension.extension_name}
              extension={extension}
              onDisconnect={handleDisconnect}
              connected={false}
              onConnect={handleSaveSettings}
              settings={settings}
              setSettings={setSettings}
              error={error}
            />
          ))}
        </div>
      </div>
    </SidebarPage>
  );
}
