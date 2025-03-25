'use client';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { setCookie } from 'cookies-next';
import { usePathname, useRouter } from 'next/navigation';
import { LuDownload, LuPencil, LuTrash2, LuPlus } from 'react-icons/lu';
import { useAgent } from '@/components/interactive/useAgent';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/components/interactive/useUser';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast';
import { useSearchParams } from 'next/navigation';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { Plus, Wrench, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LuUnlink as Unlink } from 'react-icons/lu';
import { useProviders } from '@/components/interactive/useProvider';
import QRCode from 'react-qr-code';

type ErrorState = {
  type: 'success' | 'error';
  message: string;
} | null;

type WalletKeys = {
  private_key: string;
  passphrase: string;
};

interface ExtensionSettings {
  agent_name: string;
  settings: Record<string, string>;
}

export function Providers() {
  const { data: agentData, mutate } = useAgent(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorState>(null);
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;
  const { data: providerData } = useProviders();

  // Filter connected providers
  const providers = useMemo(() => {
    // Return empty arrays if no data
    if (!agentData?.settings || !providerData?.length) {
      return {
        connected: [],
        available: [],
      };
    }

    const connected = providerData.filter((provider) => {
      // Skip providers without settings
      if (!provider.settings?.length) return false;

      // Find sensitive settings that exist in both provider and agent settings
      const relevantSettings = provider.settings.filter((setting) => {
        const isSensitive = ['KEY', 'SECRET', 'PASSWORD'].some((keyword) => setting.name.includes(keyword));

        // Only include if it exists in agent settings
        return isSensitive && agentData.settings.some((s) => s.name === setting.name);
      });

      // If no relevant settings found, provider is not connected
      if (relevantSettings.length === 0) return false;

      // Check if ALL relevant settings are HIDDEN
      return relevantSettings.every((setting) => {
        const agentSetting = agentData.settings.find((s) => s.name === setting.name);
        return agentSetting && agentSetting.value === 'HIDDEN';
      });
    });

    return {
      connected,
      available: providerData.filter((provider) => !connected.includes(provider)),
    };
  }, [agentData, providerData]);

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
    mutate();
  };

  const handleDisconnect = async (name: string) => {
    const extension = providerData?.find((ext) => ext.name === name);
    const emptySettings = extension.settings
      .filter((setting) => {
        return ['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN'].some((keyword) =>
          setting.name.replaceAll('TOKENS', '').includes(keyword),
        );
      })
      .reduce((acc, setting) => {
        return { ...acc, [setting.name]: '' };
      }, {});
    await handleSaveSettings(extension.name, emptySettings);
  };

  return (
    <div className='space-y-6'>
      <div className='grid gap-4'>
        {providers.connected?.map &&
          providers.connected.map((provider) => (
            <div
              key={provider.name}
              className='flex flex-col gap-4 p-4 transition-colors border rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
            >
              <div className='flex items-center gap-4'>
                <div className='flex items-center flex-1 min-w-0 gap-3.5'>
                  <Wrench className='flex-shrink-0 w-5 h-5 text-muted-foreground' />
                  <div>
                    <h4 className='font-medium truncate'>{provider.name}</h4>
                    <p className='text-sm text-muted-foreground'>Connected</p>
                  </div>
                </div>
                <Button variant='outline' size='sm' className='gap-2' onClick={() => handleDisconnect(provider.name)}>
                  <Unlink className='w-4 h-4' />
                  Disconnect
                </Button>
              </div>
              <div className='text-sm text-muted-foreground'>
                <MarkdownBlock content={provider.description} />
              </div>
            </div>
          ))}

        {providers.available?.map &&
          providers.available.map((provider) => (
            <div
              key={provider.name}
              className='flex flex-col gap-4 p-4 transition-colors border rounded-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'
            >
              <div className='flex items-center gap-4'>
                <div className='flex items-center flex-1 min-w-0 gap-3.5'>
                  <Wrench className='flex-shrink-0 w-5 h-5 text-muted-foreground' />
                  <div>
                    <h4 className='font-medium truncate'>{provider.friendlyName}</h4>
                    <p className='text-sm text-muted-foreground'>Not Connected</p>
                  </div>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      className='gap-2'
                      onClick={() => {
                        // Initialize settings with the default values from provider.settings
                        setSettings(
                          provider.settings.reduce((acc, setting) => {
                            acc[setting.name] = setting.value;
                            return acc;
                          }, {}),
                        );
                      }}
                    >
                      <Plus className='w-4 h-4' />
                      Connect
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='sm:max-w-[425px]'>
                    <DialogHeader>
                      <DialogTitle>Configure {provider.name}</DialogTitle>
                      <DialogDescription>
                        Enter the required credentials to enable this service. {provider.description}
                      </DialogDescription>
                    </DialogHeader>

                    <div className='grid gap-4 py-4'>
                      {provider.settings.map((prov) => (
                        <div key={prov.name} className='grid gap-2'>
                          <Label htmlFor={prov.name}>{prov.name}</Label>
                          <Input
                            id={prov.name}
                            type={
                              prov.name.toLowerCase().includes('key') || prov.name.toLowerCase().includes('password')
                                ? 'password'
                                : 'text'
                            }
                            defaultValue={prov.value}
                            value={settings[prov.name]}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                [prov.name]: e.target.value,
                              }))
                            }
                            placeholder={`Enter ${prov.name.toLowerCase()}`}
                          />
                        </div>
                      ))}
                    </div>

                    <DialogFooter>
                      <Button onClick={() => handleSaveSettings(provider.name, settings)}>Connect Provider</Button>
                    </DialogFooter>

                    {error && (
                      <Alert variant={error.type === 'success' ? 'default' : 'destructive'}>
                        <AlertDescription>{error.message}</AlertDescription>
                      </Alert>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
              <div className='text-sm text-muted-foreground'>
                <MarkdownBlock content={provider.description || 'No description available'} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export function AgentDialog({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const context = useInteractiveConfig();
  const { toast } = useToast();
  const { mutate: mutateActiveAgent } = useAgent();
  const { mutate: mutateActiveCompany } = useCompany();
  const [newAgentName, setNewAgentName] = useState('');

  const handleNewAgent = async () => {
    try {
      await context.agixt.addAgent(newAgentName);
      toast({
        title: 'Success',
        description: `Agent "${newAgentName}" created successfully`,
      });
      mutateActiveCompany();
      mutateActiveAgent();
      setOpen(false);
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to create agent. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='flex flex-col items-start gap-4'>
            <Label htmlFor='agent-name' className='text-right'>
              New Agent Name
            </Label>
            <Input
              id='agent-name'
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              className='col-span-3'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleNewAgent}>Create Agent</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentSettings() {
  const searchParams = useSearchParams();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [editName, setEditName] = useState('');
  const [walletData, setWalletData] = useState({} as WalletKeys);
  const [isWalletRevealed, setIsWalletRevealed] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const context = useInteractiveConfig();
  const router = useRouter();
  const pathname = usePathname();
  const { data: companyData, mutate: mutateCompany } = useCompany();

  const handleDelete = async () => {
    try {
      await context.agixt.deleteAgent(agentData?.agent?.name || '');
      mutateCompany();
      mutateAgent();
      router.push(pathname);
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleExport = async () => {
    try {
      const agentConfig = await context.agixt.getAgentConfig(agentData?.agent?.name || '');
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(agentConfig)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `${agentData?.agent?.name}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error('Failed to export agent:', error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await context.agixt.renameAgent(agentData?.agent?.name || '', editName);
      setCookie('agixt-agent', editName, {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      });
      mutateAgent();
    } catch (error) {
      console.error('Failed to rename agent:', error);
    }
  };

  const getAgentWallet = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${agentData?.agent?.name}/wallet`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: getCookie('jwt'),
          },
        },
      );
      return response.data as WalletKeys;
    } catch (error) {
      console.error('Failed to get agent wallet:', error);
    }
  };
  const handleRevealWallet = async () => {
    if (walletData) {
      setIsWalletRevealed(!isWalletRevealed);
      return;
    }

    setIsLoadingWallet(true);
    try {
      const data = await getAgentWallet();
      setWalletData(data);
      setIsWalletRevealed(true);
    } catch (error) {
      console.error('Failed to retrieve wallet data:', error);
    } finally {
      setIsLoadingWallet(false);
    }
  };
  const solanaWalletAddress = agentData?.agent?.settings.find((setting) => setting.name === 'SOLANA_WALLET_ADDRESS');
  return (
    <SidebarPage title='Settings'>
      {searchParams.get('mode') != 'company' ? (
        <div className='flex items-center justify-center p-4'>
          <Card className='w-full shadow-lg'>
            <CardHeader className='pb-2'>
              <div className='flex justify-between items-center'>
                <CardTitle className='text-xl font-bold'>{agentData?.agent?.name}</CardTitle>
                {agentData?.agent?.default && (
                  <Badge variant='secondary' className='ml-2'>
                    Default
                  </Badge>
                )}
              </div>
              <p className='text-muted-foreground'>{companyData?.name}</p>
            </CardHeader>

            <CardContent className='space-y-2 pb-2'>
              <div className='grid grid-cols-[auto_1fr] gap-x-2 text-sm'>
                <span className='font-medium text-muted-foreground'>Agent ID:</span>
                <span className='truncate' title={agentData?.agent?.id}>
                  {agentData?.agent?.id}
                </span>

                <span className='font-medium text-muted-foreground'>Company ID:</span>
                <span className='truncate' title={agentData?.agent?.companyId}>
                  {agentData?.agent?.companyId}
                </span>
                {solanaWalletAddress && (
                  <>
                    <span className='font-medium text-muted-foreground'>Solana Wallet Address:</span>
                    <span className='truncate' title={solanaWalletAddress?.value}>
                      <QRCode
                        size={128}
                        style={{ height: 'auto', maxWidth: '30%', width: '30%' }}
                        value={solanaWalletAddress?.value || ''}
                        viewBox={`0 0 256 256`}
                      />
                      Public Key: {solanaWalletAddress?.value}
                    </span>

                    <div className='flex flex-col gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='self-start flex items-center gap-2'
                        onClick={handleRevealWallet}
                        disabled={isLoadingWallet}
                      >
                        {isLoadingWallet ? (
                          <span>Loading...</span>
                        ) : isWalletRevealed ? (
                          <>
                            <EyeOffIcon className='h-4 w-4' />
                            Hide Private Keys
                          </>
                        ) : (
                          <>
                            <EyeIcon className='h-4 w-4' />
                            Reveal Private Keys
                          </>
                        )}
                      </Button>

                      {isWalletRevealed && walletData && (
                        <div className='mt-2 p-4 border rounded-md bg-muted/20'>
                          <h4 className='font-medium mb-2 text-sm'>Wallet Details</h4>
                          <div className='space-y-2 text-sm'>
                            <div className='grid grid-cols-[auto_1fr] gap-x-2'>
                              <span className='font-medium text-muted-foreground'>Private Key:</span>
                              <div className='flex items-center'>
                                <code className='bg-muted/50 px-2 py-1 rounded text-xs overflow-x-auto max-w-[300px]'>
                                  {walletData.private_key}
                                </code>
                              </div>
                            </div>
                            <div className='grid grid-cols-[auto_1fr] gap-x-2'>
                              <span className='font-medium text-muted-foreground'>Passphrase:</span>
                              <div className='flex items-center'>
                                <code className='bg-muted/50 px-2 py-1 rounded text-xs'>{walletData.passphrase}</code>
                              </div>
                            </div>
                            <Alert variant='warning' className='mt-2'>
                              <AlertDescription>
                                Keep these details secure. Never share your private key or passphrase with anyone.
                              </AlertDescription>
                            </Alert>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>

            <CardFooter className='flex justify-end gap-2 pt-2'>
              <Button variant='outline' size='sm' className='flex items-center' onClick={() => setIsCreateDialogOpen(true)}>
                <LuPlus className='h-4 w-4 mr-1' />
                Create Agent
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant='outline' size='sm' className='flex items-center'>
                    <LuPencil className='h-4 w-4 mr-1' />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Agent</DialogTitle>
                  </DialogHeader>
                  <div className='py-4'>
                    <Label htmlFor='name'>Agent Name</Label>
                    <Input id='name' value={editName} onChange={(e) => setEditName(e.target.value)} className='mt-1' />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant='outline'>Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={handleSaveEdit}>Save</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant='outline' size='sm' className='flex items-center' onClick={handleExport}>
                <LuDownload className='h-4 w-4 mr-1' />
                Export
              </Button>

              <Button
                variant='destructive'
                size='sm'
                className='flex items-center'
                disabled={agentData?.agent?.default}
                onClick={handleDelete}
              >
                <LuTrash2 className='h-4 w-4 mr-1' />
                Delete
              </Button>
            </CardFooter>
          </Card>
          <AgentDialog open={isCreateDialogOpen} setOpen={setIsCreateDialogOpen} />
        </div>
      ) : (
        <></>
      )}
      <Providers />
    </SidebarPage>
  );
}
