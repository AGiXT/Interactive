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

import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { Plus, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { LuUnlink as Unlink } from 'react-icons/lu';
import { useProviders } from '@/components/interactive/useProvider';

type ErrorState = {
  type: 'success' | 'error';
  message: string;
} | null;

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [editName, setEditName] = useState('');

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

  return (
    <SidebarPage title='Settings'>
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
      <Providers />
    </SidebarPage>
  );
}
