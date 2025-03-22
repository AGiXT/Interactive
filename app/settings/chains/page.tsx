'use client';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { mutate as globalMutate } from 'swr';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Check, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PlusCircle as LuPlusCircle } from 'lucide-react';
import { useAgent } from '@/components/interactive/useAgent';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowDown, ArrowUp, Save, X } from 'lucide-react';
import useSWR from 'swr';
import PromptSelector from '@/components/layout/PromptSelector';
import { type ChainStepPrompt, useChain, useChains } from '@/components/interactive/useChain';

export function CommandSelector({
  value,
  onChange,
  category = 'Default',
}: {
  agentName: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  category?: string;
}): React.JSX.Element {
  const { data: agentData, error } = useAgent();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  if (error) return <div>Failed to load commands</div>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={!agentData.commands}
              value={value || searchParams.get('command') || undefined}
              onValueChange={
                onChange
                  ? (value) => onChange(value)
                  : (value) => {
                      const current = new URLSearchParams(Array.from(searchParams.entries()));
                      current.set('command', value);
                      const search = current.toString();
                      const query = search ? `?${search}` : '';
                      router.push(`${pathname}${query}`);
                    }
              }
            >
              <SelectTrigger className='w-full text-xs'>
                <SelectValue placeholder='Select a Command' />
              </SelectTrigger>
              <SelectContent>
                {!pathname.includes('settings/commands') && <SelectItem value='/'>- Use Agent Default -</SelectItem>}
                {agentData.commands &&
                  Object.keys(agentData.commands).map(
                    (command) =>
                      command && (
                        <SelectItem key={command} value={command}>
                          {command}
                        </SelectItem>
                      ),
                  )}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select a Command</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ChainSelector({
  value,
  onChange,
}: {
  category?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const { data: chainData, error } = useChains();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  if (error) return <div>Failed to load chains</div>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={!chainData || chainData.length === 0}
              value={value || searchParams.get('chain') || undefined}
              onValueChange={
                onChange
                  ? (value) => onChange(value)
                  : (value) => {
                      const current = new URLSearchParams(Array.from(searchParams.entries()));
                      current.set('chain', value);
                      const search = current.toString();
                      const query = search ? `?${search}` : '';
                      router.push(`${pathname}${query}`);
                    }
              }
            >
              <SelectTrigger className='w-full text-xs'>
                <SelectValue placeholder='Select a Chain' />
              </SelectTrigger>
              <SelectContent>
                {!pathname.includes('settings/chains') && <SelectItem value='/'>- Use Agent Default -</SelectItem>}

                {chainData?.map((chain) => (
                  <SelectItem key={chain.id} value={chain.chainName}>
                    {chain.chainName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select a Chain</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const ignoreArgs = [
  'prompt_name',
  'prompt_category',
  'command_name',
  'chain',
  'user_input',
  'agent_name',
  'COMMANDS',
  'command_list',
  'date',
  'working_directory',
  'helper_agent_name',
  'conversation_history',
  'persona',
  'import_files',
  'output_url',
];

export function ChainStep({
  step,
  last_step,
  agent_name,
  step_type,
  step_object,
}: {
  step: number;
  last_step: boolean;
  agent_name: string;
  step_type: string;
  step_object: ChainStepPrompt;
}) {
  const [agentName, setAgentName] = useState(agent_name);
  const [targetName, setTargetName] = useState(
    step_type === 'Chain'
      ? step_object.chainName
      : step_type === 'Command'
        ? step_object.commandName
        : step_object.promptName,
  );
  const [args, setArgs] = useState<Record<string, string | number | boolean>>({});
  const [targetCategory, setTargetCategory] = useState(step_object.promptCategory || 'Default');
  const [stepType, setStepType] = useState(step_type);
  const context = useInteractiveConfig();
  const [modified, setModified] = useState(false);
  const searchParams = useSearchParams();
  const { mutate } = useChain(searchParams.get('chain') ?? undefined);
  const { mutate: mutateChainList } = useChains();

  const { data: agentData } = useSWR('/agents', async () =>
    (await context.agixt.getAgents())
      .map((agent: any) => agent.name)
      .sort((a: any, b: any) => {
        const nameA = typeof a.name === 'string' ? a.name.trim().toLowerCase() : '';
        const nameB = typeof b.name === 'string' ? b.name.trim().toLowerCase() : '';
        if (nameA < nameB) {
          return -1;
        }
        if (nameA > nameB) {
          return 1;
        }
        return 0;
      }),
  );

  const step_types = useMemo(
    () => ({
      Prompt: {
        component: (
          <div className='space-y-2'>
            {/* <PromptCategorySelector category={targetCategory.toString()} categoryMutate={setTargetCategory} /> */}
            <div>
              <Label htmlFor='prompt-name'>Prompt Name</Label>
              <PromptSelector value={targetName} onChange={setTargetName} />
            </div>
          </div>
        ),
      },
      Command: {
        component: (
          <div>
            <Label htmlFor='command-name'>Command Name</Label>
            <CommandSelector agentName={agentName} value={targetName} onChange={setTargetName} />
          </div>
        ),
      },
      Chain: {
        component: (
          <div>
            <Label htmlFor='chain-name'>Chain Name</Label>
            <ChainSelector value={targetName} onChange={setTargetName} />
          </div>
        ),
      },
    }),
    [agentName, targetName, targetCategory],
  );

  useEffect(() => {
    if (!targetName) return;
    (async (): Promise<void> => {
      let newArgs;
      if (stepType === 'Prompt') {
        newArgs = await context.agixt.getPromptArgs(targetName, targetCategory);
      } else if (stepType === 'Chain') {
        newArgs = await context.agixt.getChainArgs(targetName);
      } else {
        newArgs = await context.agixt.getCommandArgs(targetName);
        if (typeof newArgs === 'string' && newArgs.includes('AxiosError')) {
          setArgs({});
          return;
        }
        newArgs = Object.keys(newArgs);
      }
      if (newArgs.includes('AxiosError')) {
        setArgs({});
      } else {
        const filteredArr = newArgs.filter((x) => !ignoreArgs.includes(x.name));
        const newObj = filteredArr.reduce((acc, key) => {
          acc[key] = '';
          return acc;
        }, {});
        setArgs(newObj);
      }
    })();
  }, [stepType, targetName, targetCategory]);

  useEffect(() => {
    if (step_object.promptCategory) {
      setTargetCategory(step_object.promptCategory);
    } else {
      setTargetCategory('Default');
    }
  }, [step_object.promptCategory]);

  const handleIncrement = async (): Promise<void> => {
    await context.agixt.moveStep(searchParams.get('chain') ?? '', step, Number(step) + 1);
    mutate();
  };

  const handleDecrement = async (): Promise<void> => {
    await context.agixt.moveStep(searchParams.get('chain') ?? '', step, Number(step) - 1);
    mutate();
  };

  const handleSave = async (): Promise<void> => {
    const nameObj = {};
    if (stepType === 'Prompt') {
      nameObj['prompt_name'] = targetName;
      nameObj['prompt_category'] = targetCategory;
    } else if (stepType === 'Command') {
      nameObj['command_name'] = targetName;
    } else {
      nameObj['chain_name'] = targetName;
    }
    await context.agixt.updateStep(searchParams.get('chain') ?? '', step, agentName, stepType, { ...args, ...nameObj });
    mutate();
    setModified(false);
  };

  const handleDelete = async (): Promise<void> => {
    await context.agixt.deleteStep(searchParams.get('chain') ?? '', step);
    mutateChainList();
  };

  return (
    <div className='p-4 space-y-4'>
      <div className='flex items-center'>
        <h3 className='text-lg font-semibold mr-6'>Step {step}</h3>
        <TooltipProvider>
          <div className='flex items-center space-x-2'>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' onClick={handleDecrement} disabled={step === 1}>
                  <ArrowUp className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Step Up</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' onClick={handleIncrement} disabled={last_step}>
                  <ArrowDown className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Move Step Down</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' onClick={handleSave} disabled={!modified}>
                  <Save className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{modified ? 'Save Changes' : 'No Changes to Save'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant='ghost' size='icon' onClick={handleDelete}>
                  <X className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete Step</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <div className='grid grid-cols-3 gap-4'>
        <div>
          <Label htmlFor='step-type'>Step Type</Label>
          <Select
            value={stepType.toString()}
            onValueChange={(value) => {
              setTargetName('');
              setTargetCategory('Default');
              setStepType(value);
              setModified(true);
            }}
          >
            <SelectTrigger id='step-type'>
              <SelectValue placeholder='Select a Type...' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='-1'>Select a Type...</SelectItem>
              {Object.keys(step_types).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor='agent-name'>Agent Name</Label>
          <Select
            value={agentName}
            onValueChange={(value) => {
              setAgentName(value);
              setModified(true);
            }}
          >
            <SelectTrigger id='agent-name'>
              <SelectValue placeholder='Select an Agent' />
            </SelectTrigger>
            <SelectContent>
              {agentData &&
                agentData.map(
                  (agent) =>
                    agent !== 'undefined' && (
                      <SelectItem key={agent} value={agent}>
                        {agent}
                      </SelectItem>
                    ),
                )}
            </SelectContent>
          </Select>
        </div>
        <div>{stepType && step_types[stepType].component}</div>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        {Object.keys(args)
          .filter((key) => !ignoreArgs.includes(key))
          .map((name) => {
            const label = name.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());

            if (typeof args[name] === 'boolean') {
              return (
                <div key={name} className='flex items-center space-x-2'>
                  <Switch
                    id={name}
                    checked={args[name]}
                    onCheckedChange={(checked) => {
                      setArgs({ ...args, [name]: checked });
                      setModified(true);
                    }}
                  />
                  <Label htmlFor={name}>{label}</Label>
                </div>
              );
            }

            return (
              <div key={name}>
                <Label htmlFor={name}>{label}</Label>
                <Input
                  id={name}
                  value={args[name]}
                  type={typeof args[name] === 'number' ? 'number' : 'text'}
                  onChange={(e) => {
                    setArgs({ ...args, [name]: e.target.value });
                    setModified(true);
                  }}
                  className='w-full'
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function ChainSteps() {
  const searchParams = useSearchParams();
  const context = useInteractiveConfig();
  const { data: chainData, mutate: mutateChain, error } = useChain(searchParams.get('chain') ?? undefined);
  const { data: agentData } = useAgent();

  const handleAdd = async () => {
    if (!chainData) return;
    const lastStep = chainData.steps.length === 0 ? undefined : chainData.steps[chainData.steps.length - 1];
    const result = await context.agixt.addStep(
      chainData.chainName,
      chainData.steps.length + 1,
      lastStep ? lastStep.agentName : (agentData?.agent?.name ?? ''),
      lastStep ? lastStep.promptType : 'Prompt',
      lastStep
        ? lastStep.prompt
        : {
            prompt_name: '',
            prompt_category: 'Default',
          },
    );
    // Revalidate both chain and step data
    await Promise.all([mutateChain(), context.agixt.getChain(chainData.chainName)]);
  };

  return (
    <div className='space-y-4'>
      {chainData?.steps &&
        chainData.steps.map((step, index) => (
          <Card key={index}>
            <CardContent>
              <ChainStep
                {...step}
                agent_name={step.agentName}
                step_type={step.prompt.chainName ? 'Chain' : step.prompt.commandName ? 'Command' : 'Prompt'}
                step_object={step.prompt}
                last_step={chainData.steps.length === index + 1}
              />
            </CardContent>
          </Card>
        ))}
      <div className='flex items-center'>
        <Button onClick={handleAdd} variant='outline' className='flex items-center'>
          <LuPlusCircle className='mr-2 h-4 w-4' />
          Add Step
        </Button>
      </div>
    </div>
  );
}

interface ChainPanelProps {
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
}

export function ChainPanel({ showCreateDialog, setShowCreateDialog }: ChainPanelProps) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const context = useInteractiveConfig();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: chainData, mutate: mutateChain, error } = useChain(searchParams.get('chain') ?? undefined);

  useEffect(() => {
    if (renaming) {
      setNewName(searchParams.get('chain') ?? '');
    }
  }, [renaming]);

  const handleDelete = async () => {
    await context.agixt.deleteChain(searchParams.get('chain') ?? '');
    await mutateChain();
    router.push(pathname);
  };

  const handleRename = async () => {
    const currentChain = searchParams.get('chain') ?? '';
    if (newName && newName !== currentChain) {
      const oldName = searchParams.get('chain') ?? '';
      await context.agixt.renameChain(oldName, newName);
      setRenaming(false);
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('chain', newName);
      // Update the data before navigation
      await Promise.all([mutateChain(), router.push(`${pathname}?${current.toString()}`)]);
    }
  };

  const handleExportChain = async () => {
    const chainData = await context.agixt.getChain(searchParams.get('chain') ?? '');
    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(chainData.steps)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${searchParams.get('chain') ?? ''}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className='space-y-4'>
      <TooltipProvider>
        <div className='flex items-center space-x-2'>
          <div className='flex items-center space-x-2'>
            <div className='w-48'>
              {renaming ? (
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className='w-full' />
              ) : (
                <ChainSelector />
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => setShowCreateDialog(true)}
                  disabled={renaming || showCreateDialog}
                >
                  <Plus className='h-4 w-4' />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add Chain</TooltipContent>
            </Tooltip>
            {chainData && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' onClick={handleExportChain} disabled={renaming}>
                      <Download className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export Chain</TooltipContent>
                </Tooltip>
                {renaming ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleRename}
                        disabled={!newName || newName === searchParams.get('chain')}
                      >
                        <Check className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save Chain Name</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant='ghost' size='icon' onClick={() => setRenaming(true)}>
                        <Pencil className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Rename Chain</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' onClick={handleDelete} disabled={renaming}>
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete Chain</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </TooltipProvider>
      {chainData && (
        <div className='mt-4'>
          <ChainSteps />
        </div>
      )}
    </div>
  );
}

export function ChainDialog({ open, setOpen }) {
  const router = useRouter();
  const context = useInteractiveConfig();
  const [newChainName, setNewChainName] = useState('');

  const handleNewChain = async () => {
    await context.agixt.addChain(newChainName);
    await globalMutate('/chains');
    await router.push(`/settings/chains?chain=${newChainName}`);
    setOpen(false);
  };

  const handleChainImport = async (event) => {
    const files = Array.from(event.target.files);
    for (const file of files) {
      const fileContent = await file.text();
      if (newChainName === '') {
        const filename = file.name.replace('.json', '');
        setNewChainName(filename);
      }
      const steps = JSON.parse(fileContent);
      await context.agixt.addChain(newChainName);
      await context.agixt.importChain(newChainName, steps);
      await globalMutate('/chains');
      await router.push(`/chains?chain=${newChainName}`);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Chain</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='chain-name' className='text-right'>
              Chain Name
            </Label>
            <Input
              id='chain-name'
              value={newChainName}
              onChange={(e) => setNewChainName(e.target.value)}
              className='col-span-3'
            />
          </div>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='import-chain' className='text-right'>
              Import Chain
            </Label>
            <Input id='import-chain' type='file' onChange={handleChainImport} className='col-span-3' />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleNewChain}>Create Chain</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ChainPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <SidebarPage title='Chains'>
      <ChainPanel showCreateDialog={showCreateDialog} setShowCreateDialog={setShowCreateDialog} />
      <ChainDialog open={showCreateDialog} setOpen={setShowCreateDialog} />
    </SidebarPage>
  );
}
