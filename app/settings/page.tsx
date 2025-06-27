'use client';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { setCookie, getCookie } from 'cookies-next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive';
import axios from 'axios';
import { LuDownload, LuPencil, LuTrash2, LuPlus, LuUnlink as Unlink } from 'react-icons/lu';
import { Plus, Wrench, EyeIcon, EyeOffIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/layout/toast';
import { useAgent } from '@/components/interactive/useAgent';
import { useCompany } from '@/components/interactive/useUser';
import { useProviders } from '@/components/interactive/useProvider';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';

// UI Components
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

export default function AgentSettings() {
  // Single API calls for data
  const { data: agentData, mutate: mutateAgent } = useAgent(true);
  const { data: companyData, mutate: mutateCompany } = useCompany();
  const { data: providerData } = useProviders();
  const context = useInteractiveConfig();
  const { toast } = useToast();

  // Router and responsive hooks
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery({ maxWidth: 768 });

  // Agent dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');

  // Agent edit state
  const [editName, setEditName] = useState('');

  // Provider settings state
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorState>(null);

  // Wallet state
  const [walletData, setWalletData] = useState<WalletKeys | null>(null);
  const [isWalletRevealed, setIsWalletRevealed] = useState(false);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [solanaWalletAddress, setSolanaWalletAddress] = useState<string | null>(null);

  // Agent name from cookie
  const agent_name = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT;

  // Memoized providers list - computed once when data changes
  const providers = useMemo(() => {
    // Return empty arrays if no data
    if (!agentData?.agent?.settings || !providerData?.length) {
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
        return isSensitive && agentData.agent?.settings.some((s) => s.name === setting.name);
      });

      // If no relevant settings found, provider is not connected
      if (relevantSettings.length === 0) return false;

      // Check if ALL relevant settings are HIDDEN
      return relevantSettings.every((setting) => {
        const agentSetting = agentData.agent?.settings.find((s) => s.name === setting.name);
        return agentSetting && agentSetting.value === 'HIDDEN';
      });
    });

    return {
      connected,
      available: providerData.filter((provider) => !connected.includes(provider)),
    };
  }, [agentData, providerData]);

  // Find wallet address in agent settings
  useEffect(() => {
    if (agentData?.agent?.settings) {
      const setting = agentData.agent.settings.find((s) => s.name === 'SOLANA_WALLET_ADDRESS');
      if (setting) {
        setSolanaWalletAddress(setting.value);
      }
    }
  }, [agentData]);

  // Handler for saving provider settings
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
    mutateAgent();
  };

  // Handler for disconnecting provider
  const handleDisconnect = async (name: string) => {
    const extension = providerData?.find((ext) => ext.name === name);
    if (!extension) return;
    
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

  // Agent creation handler
  const handleNewAgent = async () => {
    try {
      await context.agixt.addAgent(newAgentName);
      toast({
        title: 'Success',
        description: `Agent "${newAgentName}" created successfully`,
      });
      mutateCompany();
      mutateAgent();
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to create agent. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Agent deletion handler
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

  // Agent export handler
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

  // Agent rename handler
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

  // Company agent rename handler
  const handleSaveCompanyEdit = async () => {
    try {
      const response = await axios.patch(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${agentData?.agent?.name}`,
        {
          new_name: editName,
          company_id: agentData?.agent?.companyId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: getCookie('jwt'),
          },
        }
      );
      
      if (response.status === 200) {
        setCookie('agixt-agent', editName, {
          domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        });
        mutateAgent();
        mutateCompany();
        toast({
          title: 'Success',
          description: `Agent renamed to "${editName}" successfully`,
        });
      }
    } catch (error: any) {
      console.error('Failed to rename company agent:', error);
      console.error('Error response:', error.response?.data);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to rename agent. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Get agent wallet handler
  const getAgentWallet = async () => {
    try {
      const serverUrl = process.env.NEXT_PUBLIC_AGIXT_SERVER;
      const agentName = agentData?.agent?.name;
      const jwt = getCookie('jwt');
      
      console.log('Fetching wallet for agent:', agentName);
      console.log('Server URL:', serverUrl);
      console.log('JWT exists:', !!jwt);
      
      const response = await axios.get(`${serverUrl}/api/agent/${agentName}/wallet`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: jwt,
        },
      });
      console.log('Wallet response:', response.data);
      return response.data as WalletKeys;
    } catch (error: any) {
      console.error('Failed to get agent wallet:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to retrieve wallet data. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Reveal wallet handler
  const handleRevealWallet = async () => {
    if (walletData && isWalletRevealed) {
      setIsWalletRevealed(false);
      return;
    }

    if (walletData && !isWalletRevealed) {
      setIsWalletRevealed(true);
      return;
    }

    // Need to fetch wallet data
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

  return (
    <SidebarPage title='Settings'>
      {searchParams.get('mode') != 'company' ? (
        <div className='flex items-center justify-center p-4'>
          <Card className='w-full shadow-lg'>
            <CardHeader className='pb-2'>
              <div className='flex justify-between items-center'>
                <CardTitle className='text-xl font-bold'>{agentData?.agent?.name}</CardTitle>
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
                    <span className='truncate' title={solanaWalletAddress}>
                      <div className={isMobile ? 'text-xs' : ''}>
                        {isMobile ? `${solanaWalletAddress.substring(0, 10)}...` : solanaWalletAddress}
                      </div>
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
                                <code
                                  className={cn(
                                    'bg-muted/50 px-2 py-1 rounded overflow-x-auto',
                                    isMobile ? 'text-[10px] max-w-[150px]' : 'text-xs max-w-[300px]',
                                  )}
                                >
                                  {walletData.private_key}
                                </code>
                              </div>
                            </div>
                            <div className='grid grid-cols-[auto_1fr] gap-x-2'>
                              <span className='font-medium text-muted-foreground'>Passphrase:</span>
                              <div className='flex items-center'>
                                <code className={cn('bg-muted/50 px-2 py-1 rounded', isMobile ? 'text-[10px]' : 'text-xs')}>
                                  {walletData.passphrase}
                                </code>
                              </div>
                            </div>
                            <Alert variant='default' className='mt-2'>
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

            <CardFooter className={cn('pt-2', isMobile ? 'flex-wrap gap-2 justify-center' : 'flex justify-end gap-2')}>
              <Button variant='outline' size='sm' className='flex items-center' onClick={() => setIsCreateDialogOpen(true)}>
                <LuPlus className='h-4 w-4 mr-1' />
                Create Agent
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant='outline' 
                    size='sm' 
                    className='flex items-center'
                    onClick={() => setEditName(agentData?.agent?.name || '')}
                  >
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
                      <Button variant='outline' className={isMobile ? 'w-full' : ''}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={handleSaveEdit} className={isMobile ? 'w-full' : ''}>
                        Save
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant='outline' size='sm' className='flex items-center' onClick={handleExport}>
                <LuDownload className='h-4 w-4 mr-1' />
                Export
              </Button>

              <Button variant='destructive' size='sm' className='flex items-center' onClick={handleDelete}>
                <LuTrash2 className='h-4 w-4 mr-1' />
                Delete
              </Button>
            </CardFooter>
          </Card>

          {/* Create agent dialog */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className={isMobile ? 'w-[90%] max-w-sm p-4' : ''}>
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
                    className='col-span-3 w-full'
                  />
                </div>
              </div>
              <DialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
                <Button variant='outline' onClick={() => setIsCreateDialogOpen(false)} className={isMobile ? 'w-full' : ''}>
                  Cancel
                </Button>
                <Button onClick={handleNewAgent} className={isMobile ? 'w-full' : ''}>
                  Create Agent
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className='flex items-center justify-center p-4'>
          <Card className='w-full shadow-lg'>
            <CardHeader className='pb-2'>
              <div className='flex justify-between items-center'>
                <CardTitle className='text-xl font-bold'>{agentData?.agent?.name}</CardTitle>
              </div>
              <p className='text-muted-foreground'>{companyData?.name} (Company Agent)</p>
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
              </div>
            </CardContent>

            <CardFooter className={cn('pt-2', isMobile ? 'flex-wrap gap-2 justify-center' : 'flex justify-end gap-2')}>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant='outline' 
                    size='sm' 
                    className='flex items-center'
                    onClick={() => setEditName(agentData?.agent?.name || '')}
                  >
                    <LuPencil className='h-4 w-4 mr-1' />
                    Rename
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rename Company Agent</DialogTitle>
                  </DialogHeader>
                  <div className='py-4'>
                    <Label htmlFor='company-agent-name'>Agent Name</Label>
                    <Input 
                      id='company-agent-name' 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className='mt-1'
                      placeholder={agentData?.agent?.name || 'Enter new name'}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant='outline' className={isMobile ? 'w-full' : ''}>
                        Cancel
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button onClick={handleSaveCompanyEdit} className={isMobile ? 'w-full' : ''}>
                        Save
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant='outline' size='sm' className='flex items-center' onClick={handleExport}>
                <LuDownload className='h-4 w-4 mr-1' />
                Export
              </Button>

              <Button variant='destructive' size='sm' className='flex items-center' onClick={handleDelete}>
                <LuTrash2 className='h-4 w-4 mr-1' />
                Delete
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Providers section */}
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
                  <Button
                    variant='outline'
                    size={isMobile ? 'sm' : 'default'}
                    className={cn('gap-2', isMobile ? 'px-2' : '')}
                    onClick={() => handleDisconnect(provider.name)}
                  >
                    <Unlink className='w-4 h-4' />
                    {!isMobile && 'Disconnect'}
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
                        size={isMobile ? 'sm' : 'default'}
                        className={cn('gap-2', isMobile ? 'px-2' : '')}
                        onClick={() => {
                          // Initialize settings with the default values from provider.settings
                          setSettings(
                            provider.settings.reduce((acc: Record<string, string>, setting) => {
                              acc[setting.name] = setting.value as string;
                              return acc;
                            }, {}),
                          );
                        }}
                      >
                        <Plus className='w-4 h-4' />
                        {!isMobile && 'Connect'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className={cn('sm:max-w-[425px]', isMobile ? 'w-[90%] p-4' : '')}>
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
                              defaultValue={prov.value as string}
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
    </SidebarPage>
  );
}
