// ./app/settings/chains/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useCallback, useContext, memo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import ReactFlow, {
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Connection,
  addEdge,
  Position,
  MarkerType,
  NodeProps,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Check, Download, Pencil, Plus, Save, Trash2, Upload, X, ArrowDown, ArrowUp } from 'lucide-react';
import useSWR, { mutate as globalMutate } from 'swr';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import PromptSelector from '@/components/layout/PromptSelector';

import { SidebarPage } from '@/components/layout/SidebarPage';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useAgent } from '@/components/interactive/useAgent';
import { useChain, useChains, ChainStep as ChainStepType, ChainStepPrompt } from '@/components/interactive/useChain';
import { toast } from '@/components/layout/toast';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// --- Selectors (Moved In) ---
// Add nopan and event stopping directly to SelectTrigger

function CommandSelector({
  agentName,
  value,
  onChange,
}: {
  agentName: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const { data: agentData, error } = useAgent(false, agentName);

  if (error) return <div className='text-xs text-destructive'>Failed to load commands</div>;
  if (!agentData?.agent && !error) return <div className='text-xs text-muted-foreground'>Loading commands...</div>;

  const commandsObject = agentData?.commands ?? {};
  const commandKeys = commandsObject && typeof commandsObject === 'object' ? Object.keys(commandsObject) : [];

  return (
    // Removed Tooltip wrappers for simplicity during debugging
    <div className='w-full'>
      <Select
        disabled={!commandKeys.length}
        value={value || undefined}
        onValueChange={(value) => onChange?.(value === '/' ? null : value)}
      >
        <SelectTrigger
          className='w-full h-8 text-xs nopan' // Add nopan
          onMouseDown={(e) => e.stopPropagation()} // Stop mouse down
          onTouchStart={(e) => e.stopPropagation()} // Stop touch start
        >
          <SelectValue placeholder='Select Command' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='/'>- None -</SelectItem>
          {commandKeys.map(
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
  );
}

function ChainSelector({
  value,
  onChange,
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const { data: chainData, error } = useChains();

  if (error) return <div className='text-xs text-destructive'>Failed to load chains</div>;

  return (
    // Removed Tooltip wrappers
    <div className='w-full'>
      <Select
        disabled={!chainData || chainData.length === 0}
        value={value || undefined}
        onValueChange={(value) => onChange?.(value === '/' ? null : value)}
      >
        <SelectTrigger
          className='w-full h-8 text-xs nopan' // Add nopan
          onMouseDown={(e) => e.stopPropagation()} // Stop mouse down
          onTouchStart={(e) => e.stopPropagation()} // Stop touch start
        >
          <SelectValue placeholder='Select Chain' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='/'>- None -</SelectItem>
          {chainData?.map((chain) => (
            <SelectItem key={chain.id} value={chain.chainName}>
              {chain.chainName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// --- ReactFlow Custom Node ---

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

const ChainStepNode = memo(
  ({
    data,
    isConnectable,
  }: NodeProps<{
    stepData: ChainStepType;
    chainName: string;
    mutateChain: () => void;
    mutateChains: () => void;
    isLastStep: boolean;
    moveStep: (direction: 'up' | 'down') => Promise<void>;
  }>) => {
    const { stepData, chainName, mutateChain, mutateChains, isLastStep, moveStep } = data;
    const context = useInteractiveConfig();
    const [agentName, setAgentName] = useState(stepData.agentName);
    const initialStepType = stepData.prompt.chainName ? 'Chain' : stepData.prompt.commandName ? 'Command' : 'Prompt';
    const initialTargetName = stepData.prompt.chainName || stepData.prompt.commandName || stepData.prompt.promptName || '';
    const [stepType, setStepType] = useState(initialStepType);
    const [targetName, setTargetName] = useState(initialTargetName);
    const [args, setArgs] = useState<Record<string, string | number | boolean>>(() => {
      const initialArgs: Record<string, string | number | boolean> = {};
      if (stepData.prompt) {
        for (const key in stepData.prompt) {
          if (
            !ignoreArgs.includes(key) &&
            key !== 'chainName' &&
            key !== 'commandName' &&
            key !== 'promptName' &&
            key !== 'promptCategory'
          ) {
            const value = stepData.prompt[key as keyof ChainStepPrompt];
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              initialArgs[key] = value;
            } else {
              initialArgs[key] = '';
            }
          }
        }
      }
      return initialArgs;
    });
    const [availableArgs, setAvailableArgs] = useState<string[]>([]);
    const [modified, setModified] = useState(false);
    const [isLoadingArgs, setIsLoadingArgs] = useState(false);

    const { data: agentsData } = useSWR('/agents', () => context.agixt.getAgents(), { fallbackData: [] });
    const sortedAgents = useMemo(
      () =>
        agentsData
          ?.map((agent: any) => agent.name)
          .sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase())) || [],
      [agentsData],
    );

    const fetchArgs = useCallback(async () => {
      if (!targetName || !stepType) {
        setAvailableArgs([]);
        setArgs({});
        return;
      }
      setIsLoadingArgs(true);
      let fetchedArgNames: string[] = [];
      let result;
      try {
        if (stepType === 'Prompt') {
          result = await context.agixt.getPromptArgs(targetName, 'Default');
          fetchedArgNames = Array.isArray(result) ? result : [];
        } else if (stepType === 'Chain') {
          result = await context.agixt.getChainArgs(targetName);
          fetchedArgNames = Array.isArray(result) ? result : [];
        } else if (stepType === 'Command') {
          result = await context.agixt.getCommandArgs(targetName);
          if (typeof result === 'object' && result !== null && !result?.error) {
            fetchedArgNames = Object.keys(result);
          } else if (result?.error) {
            console.warn(`Error fetching command args for ${targetName}: ${result.error}`);
          } else {
            console.warn(`Unexpected result fetching command args for ${targetName}:`, result);
          }
        }
      } catch (error) {
        console.error(`Error fetching args for ${stepType} ${targetName}:`, error);
      } finally {
        const filteredArgNames = fetchedArgNames.filter((arg) => !ignoreArgs.includes(arg));
        setAvailableArgs(filteredArgNames);

        setArgs((prevArgs) => {
          const currentArgsString = JSON.stringify(prevArgs);
          const newArgs = filteredArgNames.reduce(
            (acc, key) => {
              acc[key] = prevArgs[key] !== undefined ? prevArgs[key] : '';
              return acc;
            },
            {} as Record<string, string | number | boolean>,
          );

          if (JSON.stringify(newArgs) !== currentArgsString) {
            if (
              Object.keys(newArgs).length !== Object.keys(prevArgs).length ||
              Object.keys(newArgs).some((key) => newArgs[key] !== prevArgs[key])
            ) {
              setModified(true);
            }
          }
          return newArgs;
        });
        setIsLoadingArgs(false);
      }
    }, [stepType, targetName, context.agixt]);

    useEffect(() => {
      fetchArgs();
    }, [fetchArgs]);

    const handleSave = async (): Promise<void> => {
      const nameObj: Partial<ChainStepPrompt> = {};
      if (stepType === 'Prompt') {
        nameObj.promptName = targetName;
        nameObj.promptCategory = 'Default';
        nameObj.commandName = null;
        nameObj.chainName = null;
      } else if (stepType === 'Command') {
        nameObj.commandName = targetName;
        nameObj.promptName = null;
        nameObj.promptCategory = null;
        nameObj.chainName = null;
      } else if (stepType === 'Chain') {
        nameObj.chainName = targetName;
        nameObj.promptName = null;
        nameObj.promptCategory = null;
        nameObj.commandName = null;
      } else {
        toast({ title: 'Error', description: 'Invalid step type.', variant: 'destructive' });
        return;
      }

      const validArgs = { ...nameObj };
      availableArgs.forEach((key) => {
        if (args.hasOwnProperty(key)) {
          validArgs[key] = args[key];
        }
      });

      try {
        await context.agixt.updateStep(chainName, stepData.step, agentName, stepType, validArgs);
        mutateChain();
        setModified(false);
        toast({ title: 'Step Saved', description: `Step ${stepData.step} updated.` });
      } catch (err: any) {
        console.error('Failed to save step:', err);
        toast({ title: 'Error Saving Step', description: err.message || 'Unknown error.', variant: 'destructive' });
      }
    };

    const handleDelete = async (): Promise<void> => {
      try {
        await context.agixt.deleteStep(chainName, stepData.step);
        await mutateChain();
        await mutateChains();
        toast({ title: 'Step Deleted', description: `Step ${stepData.step} removed.` });
      } catch (err: any) {
        console.error('Failed to delete step:', err);
        toast({ title: 'Error Deleting Step', description: err.message || 'Unknown error.', variant: 'destructive' });
      }
    };

    const stepTypeComponents = useMemo(
      () => ({
        Prompt: (
          // Wrapper div with event stopping
          <div className='nopan' onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <Label htmlFor={`prompt-name-${stepData.step}`} className='text-xs'>
              Prompt Name
            </Label>
            <PromptSelector
              value={targetName}
              onChange={(val) => {
                setTargetName(val || '');
                setModified(true);
              }}
            />
          </div>
        ),
        Command: (
          // Wrapper div with event stopping
          <div className='nopan' onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <Label htmlFor={`command-name-${stepData.step}`} className='text-xs'>
              Command Name
            </Label>
            <CommandSelector
              agentName={agentName}
              value={targetName}
              onChange={(val) => {
                setTargetName(val || '');
                setModified(true);
              }}
            />
          </div>
        ),
        Chain: (
          // Wrapper div with event stopping
          <div className='nopan' onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <Label htmlFor={`chain-name-${stepData.step}`} className='text-xs'>
              Chain Name
            </Label>
            <ChainSelector
              value={targetName}
              onChange={(val) => {
                setTargetName(val || '');
                setModified(true);
              }}
            />
          </div>
        ),
      }),
      [agentName, targetName, stepData.step],
    );

    return (
      <Card className='w-80 shadow-md nowheel nopan'>
        <Handle type='target' position={Position.Left} style={{ background: '#555' }} isConnectable={isConnectable} />
        <CardHeader className='p-3 bg-muted/50 cursor-default'>
          {' '}
          {/* Make header non-interactive for pan */}
          <CardTitle className='text-sm font-semibold flex justify-between items-center'>
            <span>Step {stepData.step}</span>
            {/* Add nopan to button container */}
            <div className='flex items-center space-x-1 nopan'>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={(e) => {
                        e.stopPropagation();
                        moveStep('up');
                      }}
                      disabled={stepData.step === 1}
                    >
                      <ArrowUp className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move Up</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={(e) => {
                        e.stopPropagation();
                        moveStep('down');
                      }}
                      disabled={isLastStep}
                    >
                      <ArrowDown className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move Down</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSave();
                      }}
                      disabled={!modified}
                    >
                      <Save className={cn('h-3 w-3', !modified && 'text-muted-foreground/50')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{modified ? 'Save' : 'No Changes'}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6 text-destructive'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardTitle>
        </CardHeader>
        {/* Add relative positioning and z-index */}
        <CardContent className='p-3 space-y-2 text-xs max-h-96 overflow-y-auto nopan relative z-10'>
          {/* Agent Selector */}
          {/* Added nopan and event stopping */}
          <div className='nopan' onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <Label htmlFor={`agent-name-${stepData.step}`} className='text-xs'>
              Agent
            </Label>
            <Select
              value={agentName}
              onValueChange={(value) => {
                setAgentName(value);
                setModified(true);
              }}
              disabled={!sortedAgents.length}
            >
              <SelectTrigger id={`agent-name-${stepData.step}`} className='h-8 text-xs'>
                <SelectValue placeholder={!sortedAgents.length ? 'Loading...' : 'Select Agent'} />
              </SelectTrigger>
              <SelectContent>
                {sortedAgents.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Type Selector */}
          {/* Added nopan and event stopping */}
          <div className='nopan' onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <Label htmlFor={`step-type-${stepData.step}`} className='text-xs'>
              Type
            </Label>
            <Select
              value={stepType}
              onValueChange={(value) => {
                if (value !== stepType) {
                  setTargetName('');
                  setArgs({});
                  setAvailableArgs([]);
                  setStepType(value);
                  setModified(true);
                }
              }}
            >
              <SelectTrigger id={`step-type-${stepData.step}`} className='h-8 text-xs'>
                <SelectValue placeholder='Select Type' />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(stepTypeComponents).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Target Component */}
          {stepType && stepTypeComponents[stepType as keyof typeof stepTypeComponents]}

          {/* Arguments Section */}
          {isLoadingArgs && (
            <div className='flex items-center justify-center py-2'>
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
            </div>
          )}
          {!isLoadingArgs && availableArgs.length > 0 && (
            <div className='mt-2 space-y-2 border-t pt-2'>
              <Label className='text-xs font-medium'>Arguments</Label>
              {availableArgs.map((name) => {
                const label = name.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
                const argId = `arg-${stepData.step}-${name}`;
                const currentValue = args[name];
                const isBoolean =
                  typeof currentValue === 'boolean' ||
                  name.toLowerCase().includes('enable') ||
                  name.toLowerCase().startsWith('is_');
                const isNumber =
                  typeof currentValue === 'number' ||
                  name.toLowerCase().includes('count') ||
                  name.toLowerCase().includes('number') ||
                  name.toLowerCase().includes('depth') ||
                  name.toLowerCase().includes('limit');

                if (isBoolean) {
                  const checkedValue = currentValue === true || String(currentValue).toLowerCase() === 'true';
                  return (
                    // Added nopan and event stopping
                    <div
                      key={name}
                      className='flex items-center space-x-2 nopan'
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Switch
                        id={argId}
                        checked={checkedValue}
                        onCheckedChange={(checked) => {
                          setArgs((prev) => ({ ...prev, [name]: checked }));
                          setModified(true);
                        }}
                      />
                      <Label htmlFor={argId} className='text-xs cursor-pointer'>
                        {label}
                      </Label>
                    </div>
                  );
                }

                return (
                  // Added nopan and event stopping
                  <div
                    key={name}
                    className='nopan'
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <Label htmlFor={argId} className='text-xs'>
                      {label}
                    </Label>
                    <Input
                      id={argId}
                      value={String(currentValue ?? '')}
                      type={isNumber ? 'number' : 'text'}
                      onChange={(e) => {
                        const nv = isNumber ? Number(e.target.value) : e.target.value;
                        setArgs((prev) => ({ ...prev, [name]: nv }));
                        setModified(true);
                      }}
                      className='w-full h-8 text-xs'
                      placeholder={`Enter ${label}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {!isLoadingArgs && stepType && availableArgs.length === 0 && (
            <p className='text-xs text-muted-foreground mt-2 italic'>No arguments.</p>
          )}
        </CardContent>
        <Handle type='source' position={Position.Right} style={{ background: '#555' }} isConnectable={isConnectable} />
      </Card>
    );
  },
);
ChainStepNode.displayName = 'ChainStepNode';

// --- Main Page Component ---

const NODE_WIDTH = 320;
const NODE_HEIGHT = 500;
const HORIZONTAL_SPACING = 60;
const VERTICAL_POSITION = 50;

function ChainFlow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [currentChainName, setCurrentChainName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const reactFlowInstance = useReactFlow();
  const context = useInteractiveConfig();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedChainName = searchParams.get('chain');

  const { data: chainsData, mutate: mutateChains } = useChains();
  const {
    data: chainData,
    mutate: mutateChain,
    error: chainError,
    isLoading: isChainLoading,
  } = useChain(selectedChainName ?? undefined);
  const { data: agentData } = useAgent(false);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );
  const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  const moveStep = useCallback(
    async (stepNumber: number, direction: 'up' | 'down') => {
      if (!currentChainName || !chainData) return;
      const newStepNumber = direction === 'up' ? stepNumber - 1 : stepNumber + 1;
      if (newStepNumber < 1 || newStepNumber > chainData.steps.length) return;
      try {
        await context.agixt.moveStep(currentChainName, stepNumber, newStepNumber);
        await mutateChain();
        toast({ title: 'Step Moved', description: `Step ${stepNumber} moved ${direction}.` });
      } catch (err: any) {
        console.error('Error moving step:', err);
        toast({ title: 'Error Moving Step', description: err.message || 'Unknown error.', variant: 'destructive' });
      }
    },
    [currentChainName, chainData, context.agixt, mutateChain],
  );

  useEffect(() => {
    if (chainData?.steps) {
      const numSteps = chainData.steps.length;
      const newNodes: Node[] = chainData.steps.map((step, index) => ({
        id: `step-${step.step}`,
        type: 'chainStep',
        position: { x: index * (NODE_WIDTH + HORIZONTAL_SPACING), y: VERTICAL_POSITION },
        data: {
          stepData: step,
          chainName: chainData.chainName,
          mutateChain,
          mutateChains,
          isLastStep: index === numSteps - 1,
          moveStep: (direction: 'up' | 'down') => moveStep(step.step, direction),
        },
        draggable: false,
        connectable: false,
        selectable: false,
        style: { width: NODE_WIDTH, minHeight: NODE_HEIGHT },
      }));
      const newEdges: Edge[] = chainData.steps.slice(0, -1).map((step) => ({
        id: `e${step.step}-${step.step + 1}`,
        source: `step-${step.step}`,
        target: `step-${step.step + 1}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
        type: 'smoothstep',
        style: { strokeWidth: 2 },
      }));
      setNodes(newNodes);
      setEdges(newEdges);
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 50);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [chainData, mutateChain, mutateChains, reactFlowInstance, moveStep]);

  useEffect(() => {
    setCurrentChainName(selectedChainName);
    if (renaming && selectedChainName) setNewName(selectedChainName);
    else if (!selectedChainName) {
      setRenaming(false);
      setNewName('');
    }
  }, [selectedChainName, renaming]);

  const handleSelectChain = (value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value && value !== '/') current.set('chain', value);
    else current.delete('chain');
    router.push(`${pathname}?${current.toString()}`);
    setNodes([]);
    setEdges([]);
  };

  const handleNewChain = async () => {
    if (!newChainName) {
      toast({ title: 'Error', description: 'Name required.', variant: 'destructive' });
      return;
    }
    try {
      await context.agixt.addChain(newChainName);
      await mutateChains();
      router.push(`/settings/chains?chain=${encodeURIComponent(newChainName)}`);
      toast({ title: 'Created', description: `Chain "${newChainName}".` });
      setShowCreateDialog(false);
      setNewChainName('');
    } catch (err: any) {
      console.error('Error creating chain:', err);
      toast({ title: 'Error', description: err.message || 'Unknown error.', variant: 'destructive' });
    }
  };

  const handleChainImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const finalChainName = newChainName || file.name.replace('.json', '');
    if (!finalChainName) {
      toast({ title: 'Error', description: 'Name required for import.', variant: 'destructive' });
      return;
    }
    try {
      const fileContent = await file.text();
      const steps = JSON.parse(fileContent);
      if (!Array.isArray(steps)) throw new Error('Invalid file format.');
      await context.agixt.addChain(finalChainName);
      await context.agixt.importChain(finalChainName, steps);
      await mutateChains();
      router.push(`/settings/chains?chain=${encodeURIComponent(finalChainName)}`);
      toast({ title: 'Imported', description: `Chain "${finalChainName}".` });
      setShowCreateDialog(false);
      setNewChainName('');
    } catch (err: any) {
      console.error('Error importing chain:', err);
      toast({ title: 'Error Importing', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleDeleteChain = async () => {
    if (!currentChainName) return;
    try {
      await context.agixt.deleteChain(currentChainName);
      await mutateChains();
      const firstChainName = chainsData?.filter((c) => c.chainName !== currentChainName)[0]?.chainName;
      handleSelectChain(firstChainName || null);
      toast({ title: 'Deleted', description: `Chain "${currentChainName}".` });
    } catch (err: any) {
      console.error('Error deleting chain:', err);
      toast({ title: 'Error Deleting', description: err.message || 'Unknown error.', variant: 'destructive' });
    }
  };

  const handleRenameChain = async () => {
    if (!newName || !currentChainName || newName === currentChainName) {
      setRenaming(false);
      if (newName === currentChainName) toast({ title: 'Info', description: 'Name unchanged.' });
      return;
    }
    try {
      await context.agixt.renameChain(currentChainName, newName);
      setRenaming(false);
      await mutateChains();
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('chain', newName);
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
      toast({ title: 'Renamed', description: `To "${newName}".` });
      setNewName('');
    } catch (err: any) {
      console.error('Error renaming chain:', err);
      toast({ title: 'Error Renaming', description: err.message || 'Unknown error.', variant: 'destructive' });
      setRenaming(false);
    }
  };

  const handleExportChain = async () => {
    if (!currentChainName || !chainData) {
      toast({ title: 'Error', description: 'No chain selected/loaded.', variant: 'destructive' });
      return;
    }
    try {
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(chainData.steps, null, 2)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `${currentChainName}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      toast({ title: 'Exported', description: `Chain "${currentChainName}".` });
    } catch (err: any) {
      console.error('Error exporting chain:', err);
      toast({ title: 'Error Exporting', description: err.message || 'Unknown error.', variant: 'destructive' });
    }
  };

  const handleAddStep = async () => {
    if (!chainData || !currentChainName) {
      toast({ title: 'Error', description: 'No chain selected.', variant: 'destructive' });
      return;
    }
    const lastStep = chainData.steps.length > 0 ? chainData.steps[chainData.steps.length - 1] : null;
    const newStepNumber = chainData.steps.length + 1;
    const defaultAgent = agentData?.agent?.name ?? 'AGiXT';
    try {
      await context.agixt.addStep(currentChainName, newStepNumber, lastStep ? lastStep.agentName : defaultAgent, 'Prompt', {
        prompt_name: '',
        prompt_category: 'Default',
        command_name: null,
        chain_name: null,
      });
      await mutateChain();
      toast({ title: 'Step Added', description: `Step ${newStepNumber} added.` });
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 100);
    } catch (err: any) {
      console.error('Error adding step:', err);
      toast({ title: 'Error Adding Step', description: err.message || 'Unknown error.', variant: 'destructive' });
    }
  };

  const nodeTypes = useMemo(() => ({ chainStep: ChainStepNode }), []);

  return (
    <>
      <Card>
        <CardContent className='p-4 space-y-4'>
          <Label>Select or Manage Chain</Label>
          <TooltipProvider delayDuration={100}>
            <div className='flex items-center space-x-2'>
              <div className='flex-1'>
                {renaming ? (
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder='New name'
                    className='h-9'
                  />
                ) : (
                  <Select value={currentChainName || ''} onValueChange={handleSelectChain} disabled={!chainsData}>
                    <SelectTrigger className='w-full h-9'>
                      <SelectValue placeholder={!chainsData ? 'Loading...' : 'Select Chain'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='/'>- Select -</SelectItem>
                      {chainsData?.map((chain) => (
                        <SelectItem key={chain.id} value={chain.chainName}>
                          {chain.chainName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setShowCreateDialog(true)}
                    disabled={renaming}
                    className='h-9 w-9'
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Chain</TooltipContent>
              </Tooltip>
              {currentChainName && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleExportChain}
                        disabled={renaming || !chainData}
                        className='h-9 w-9'
                      >
                        <Download className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={renaming ? handleRenameChain : () => setRenaming(true)}
                        disabled={!currentChainName}
                        className='h-9 w-9'
                      >
                        {renaming ? <Check className='h-4 w-4' /> : <Pencil className='h-4 w-4' />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{renaming ? 'Save' : 'Rename'}</TooltipContent>
                  </Tooltip>
                  {renaming && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            setRenaming(false);
                            setNewName(currentChainName || '');
                          }}
                          className='h-9 w-9 text-muted-foreground'
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleDeleteChain}
                        disabled={renaming || !currentChainName}
                        className='h-9 w-9 text-destructive'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      <div className='flex-grow w-full h-[600px] border rounded-md relative overflow-hidden'>
        <Button
          onClick={handleAddStep}
          variant='outline'
          size='sm'
          className='absolute bottom-4 right-4 z-10 flex items-center shadow-md bg-background hover:bg-muted'
          disabled={isChainLoading || !chainData || !currentChainName || renaming}
        >
          <Plus className='mr-1 h-4 w-4' /> Add Step
        </Button>
        {currentChainName ? (
          <>
            {isChainLoading && (
              <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-20'>Loading...</div>
            )}
            {chainError && <div className='p-4 text-red-500'>Error loading chain.</div>}
            {!isChainLoading && !chainError && (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, duration: 300 }}
                className='bg-background'
                proOptions={{ hideAttribution: true }}
                minZoom={0.1}
                maxZoom={2}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
              >
                <Controls className='react-flow__controls !bottom-auto !top-4 !left-4' />
                <Background />
              </ReactFlow>
            )}
          </>
        ) : (
          <div className='flex items-center justify-center h-full text-muted-foreground'>
            {!chainsData ? 'Loading...' : chainsData.length === 0 ? 'No chains. Create one!' : 'Select a chain.'}
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create or Import Chain</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='chain-name-dialog' className='text-right'>
                Name
              </Label>
              <Input
                id='chain-name-dialog'
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                className='col-span-3'
                placeholder='Required'
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='import-chain-dialog' className='text-right'>
                Import
              </Label>
              <Input
                id='import-chain-dialog'
                type='file'
                accept='.json'
                onChange={handleChainImport}
                className='col-span-3'
              />
            </div>
            <p className='text-xs text-muted-foreground col-span-4 text-center pt-2'>
              Provide name to create. Import: select JSON (name optional).
            </p>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowCreateDialog(false);
                setNewChainName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleNewChain} disabled={!newChainName}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ChainPageWrapper() {
  return (
    <SidebarPage title='Chains'>
      <ReactFlowProvider>
        <ChainFlow />
      </ReactFlowProvider>
    </SidebarPage>
  );
}
