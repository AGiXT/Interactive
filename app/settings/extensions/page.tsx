'use client';
import { SidebarPage } from '@/components/layout/SidebarPage';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useSearchParams } from 'next/navigation';
import { useAgent } from '@/components/interactive/useAgent';
import { useCompany } from '@/components/interactive/useUser';
import { useEffect, useState } from 'react';
import OAuth2Login from 'react-simple-oauth2-login';
import { providers as oAuth2Providers } from '@/components/auth/OAuth';
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
  const [loading, setLoading] = useState(true);
  const [disconnectDialog, setDisconnectDialog] = useState<{
    isOpen: boolean;
    provider: string | null;
  }>({
    isOpen: false,
    provider: null,
  });

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2`, {
        headers: {
          Authorization: getCookie('jwt'),
        },
      });

      const allServices = Object.keys(oAuth2Providers)
        .filter((key) => oAuth2Providers[key].client_id)
        .map((key) => ({
          provider: key,
          connected: response.data.includes(key.toLowerCase()),
        }));

      setConnectedServices(allServices);
      setError(null);
    } catch (err) {
      console.error('Error fetching connections:', err);
      setError('Failed to fetch connected services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleDisconnect = async (provider: string) => {
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2/${provider.toLowerCase()}`, {
        headers: {
          Authorization: getCookie('jwt'),
        },
      });
      await fetchConnections();
      setDisconnectDialog({ isOpen: false, provider: null });
    } catch (err) {
      console.error('Error disconnecting service:', err);
      setError('Failed to disconnect service');
    }
  };

  const onSuccess = async (response: any) => {
    const provider = disconnectDialog.provider?.toLowerCase() || '';
    try {
      const jwt = getCookie('jwt');

      if (!response.code) {
        console.error('No code received in OAuth response');
        await fetchConnections();
        return;
      }

      const result = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/oauth2/${provider}`,
        {
          code: response.code,
          referrer: `${process.env.NEXT_PUBLIC_APP_URI}/user/close/${provider}`,
        },
        {
          headers: {
            Authorization: jwt,
          },
        },
      );
      await fetchConnections();
    } catch (err: any) {
      await fetchConnections();
      console.error('OAuth error:', err);
      if (err.config) {
        console.error('Failed request details:', {
          url: err.config.url,
          method: err.config.method,
          headers: err.config.headers,
          data: err.config.data,
        });
      }
    }
  };

  return (
    <>
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='grid gap-4'>
        {connectedServices.map((service) => {
          const provider = oAuth2Providers[service.provider];
          return (
            <div key={service.provider} className='flex flex-col space-y-4 p-4 border rounded-lg'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-4'>
                  {provider.icon}
                  <div>
                    <p className='font-medium'>{service.provider}</p>
                    <p className='text-sm text-muted-foreground'>{service.connected ? 'Connected' : 'Not connected'}</p>
                  </div>
                </div>

                {service.connected ? (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      setDisconnectDialog({
                        isOpen: true,
                        provider: service.provider,
                      })
                    }
                    className='space-x-1'
                  >
                    <Unlink className='w-4 h-4 mr-2' />
                    Disconnect
                  </Button>
                ) : (
                  <OAuth2Login
                    authorizationUrl={provider.uri}
                    responseType='code'
                    clientId={provider.client_id}
                    state={getCookie('jwt')}
                    redirectUri={`${process.env.NEXT_PUBLIC_APP_URI}/user/close/${service.provider.toLowerCase()}`}
                    scope={provider.scope}
                    onSuccess={onSuccess}
                    onFailure={onSuccess}
                    isCrossOrigin
                    render={(renderProps) => (
                      <Button variant='outline' onClick={renderProps.onClick} className='space-x-1'>
                        <Plus className='w-4 h-4 mr-2' />
                        Connect
                      </Button>
                    )}
                  />
                )}
              </div>
              <p className='text-sm text-muted-foreground'>
                {providerDescriptions[service.provider] || 'Connect this service to enable AI integration.'}
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
