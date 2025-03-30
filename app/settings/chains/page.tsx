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
  // ReactFlowInstance // Not explicitly needed with useReactFlow hook
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Check, Download, Pencil, Plus, Save, Trash2, Upload, X, ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import useSWR, { mutate as globalMutate } from 'swr';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger, // Added for step delete confirmation
  DialogClose, // Added for step delete confirmation
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import PromptSelector from '@/components/layout/PromptSelector'; // Assuming this path is correct

import { SidebarPage } from '@/components/layout/SidebarPage';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useAgent } from '@/components/interactive/useAgent';
import { useChain, useChains, ChainStep as ChainStepType, ChainStepPrompt } from '@/components/interactive/useChain';
import { toast } from '@/components/layout/toast';
import { cn } from '@/lib/utils';

// --- Selectors (Moved In & Modified for Interaction) ---

function CommandSelector({
  agentName,
  value,
  onChange,
}: {
  agentName: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const { data: agentData, error, isLoading } = useAgent(false, agentName);

  if (isLoading) return <div className='text-xs text-muted-foreground h-8 flex items-center'>Loading...</div>;
  if (error) return <div className='text-xs text-destructive h-8 flex items-center'>Load Error</div>;

  const commandsObject = agentData?.commands ?? {};
  const commandKeys = commandsObject && typeof commandsObject === 'object' ? Object.keys(commandsObject) : [];

  // Helper to stop event propagation
  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div className='w-full'>
      {' '}
      {/* Removed nopan from container */}
      <Select
        disabled={!commandKeys.length}
        value={value || undefined}
        onValueChange={(value) => onChange?.(value === '/' ? null : value)}
      >
        <SelectTrigger
          className='w-full h-8 text-xs nopan' // ADD nopan directly to trigger
          onMouseDown={stopPropagation} // ADD stopPropagation directly
          onTouchStart={stopPropagation} // ADD stopPropagation directly
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
  const { data: chainData, error, isLoading } = useChains();

  if (isLoading) return <div className='text-xs text-muted-foreground h-8 flex items-center'>Loading...</div>;
  if (error) return <div className='text-xs text-destructive h-8 flex items-center'>Load Error</div>;

  // Helper to stop event propagation
  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <div className='w-full'>
      {' '}
      {/* Removed nopan from container */}
      <Select
        disabled={!chainData || chainData.length === 0}
        value={value || undefined}
        onValueChange={(value) => onChange?.(value === '/' ? null : value)}
      >
        <SelectTrigger
          className='w-full h-8 text-xs nopan' // ADD nopan directly to trigger
          onMouseDown={stopPropagation} // ADD stopPropagation directly
          onTouchStart={stopPropagation} // ADD stopPropagation directly
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
    moveStep: (stepNumber: number, direction: 'up' | 'down') => Promise<void>;
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
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const { data: agentsData, isLoading: isAgentsLoading } = useSWR('/agents', () => context.agixt.getAgents(), {
      fallbackData: [],
    });

    const sortedAgents = useMemo(
      () =>
        agentsData
          ?.map((agent: any) => agent.name as string)
          .sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase())) || [],
      [agentsData],
    );

    const fetchArgs = useCallback(async () => {
      if (!targetName || !stepType) {
        setAvailableArgs([]);
        return;
      }
      setIsLoadingArgs(true);
      let fetchedArgNames: string[] = [];
      let result: any;
      try {
        if (stepType === 'Prompt') {
          result = await context.agixt.getPromptArgs(targetName, 'Default');
          fetchedArgNames = Array.isArray(result) ? result.map(String) : [];
        } else if (stepType === 'Chain') {
          result = await context.agixt.getChainArgs(targetName);
          fetchedArgNames = Array.isArray(result) ? result.map(String) : [];
        } else if (stepType === 'Command') {
          result = await context.agixt.getCommandArgs(targetName);
          if (typeof result === 'object' && result !== null && !result?.error && !Array.isArray(result)) {
            fetchedArgNames = Object.keys(result);
          } else if (result?.error) {
            console.warn(`Error fetching command args for ${targetName}: ${result.error}`);
          } else {
            console.warn(`Unexpected result fetching command args for ${targetName}:`, result);
          }
        }
      } catch (error: any) {
        console.error(`Error fetching args for ${stepType} ${targetName}:`, error);
        toast({
          title: 'Error Fetching Args',
          description: `Could not load arguments for ${stepType} '${targetName}'. ${error.message || ''}`,
          variant: 'destructive',
        });
      } finally {
        const filteredArgNames = fetchedArgNames.filter((arg) => !ignoreArgs.includes(arg));
        setAvailableArgs(filteredArgNames);
        setArgs((prevArgs) => {
          const newArgs = filteredArgNames.reduce(
            (acc, key) => {
              acc[key] = prevArgs.hasOwnProperty(key) ? prevArgs[key] : '';
              return acc;
            },
            {} as Record<string, string | number | boolean>,
          );
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
        if (!targetName) {
          toast({ title: 'Error', description: 'Prompt Name is required.', variant: 'destructive' });
          return;
        }
        nameObj.promptName = targetName;
        nameObj.promptCategory = 'Default';
        nameObj.commandName = null;
        nameObj.chainName = null;
      } else if (stepType === 'Command') {
        if (!targetName) {
          toast({ title: 'Error', description: 'Command Name is required.', variant: 'destructive' });
          return;
        }
        nameObj.commandName = targetName;
        nameObj.promptName = null;
        nameObj.promptCategory = null;
        nameObj.chainName = null;
      } else if (stepType === 'Chain') {
        if (!targetName) {
          toast({ title: 'Error', description: 'Chain Name is required.', variant: 'destructive' });
          return;
        }
        nameObj.chainName = targetName;
        nameObj.promptName = null;
        nameObj.promptCategory = null;
        nameObj.commandName = null;
      } else {
        toast({ title: 'Error', description: 'Invalid step type selected.', variant: 'destructive' });
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
        await mutateChain();
        setModified(false);
        toast({ title: 'Step Saved', description: `Step ${stepData.step} updated.` });
      } catch (err: any) {
        console.error('Failed to save step:', err);
        toast({ title: 'Error Saving Step', description: err.message || 'API error.', variant: 'destructive' });
      }
    };

    const handleDeleteConfirm = async (): Promise<void> => {
      try {
        await context.agixt.deleteStep(chainName, stepData.step);
        await mutateChain();
        await mutateChains();
        toast({ title: 'Step Deleted', description: `Step ${stepData.step} removed.` });
        setIsDeleteConfirmOpen(false);
      } catch (err: any) {
        console.error('Failed to delete step:', err);
        toast({ title: 'Error Deleting Step', description: err.message || 'API error.', variant: 'destructive' });
        setIsDeleteConfirmOpen(false);
      }
    };

    const stepTypeComponents = useMemo(
      () => ({
        Prompt: (
          <div>
            {' '}
            {/* Container removed nopan, selector handles it */}
            <Label htmlFor={`prompt-name-${stepData.step}`} className='text-xs'>
              Prompt Name
            </Label>
            {/* Assuming PromptSelector passes className and event handlers down */}
            <PromptSelector
              value={targetName}
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || '');
                  setModified(true);
                  setArgs({});
                  setAvailableArgs([]);
                }
              }}
              // These props need to be handled *inside* PromptSelector to reach the trigger
              // className="nopan"
              // onMouseDown={(e) => e.stopPropagation()}
              // onTouchStart={(e) => e.stopPropagation()}
            />
          </div>
        ),
        Command: (
          <div>
            {' '}
            {/* Container removed nopan */}
            <Label htmlFor={`command-name-${stepData.step}`} className='text-xs'>
              Command Name
            </Label>
            <CommandSelector // Uses internally modified SelectTrigger
              agentName={agentName}
              value={targetName}
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || '');
                  setModified(true);
                  setArgs({});
                  setAvailableArgs([]);
                }
              }}
            />
          </div>
        ),
        Chain: (
          <div>
            {' '}
            {/* Container removed nopan */}
            <Label htmlFor={`chain-name-${stepData.step}`} className='text-xs'>
              Chain Name
            </Label>
            <ChainSelector // Uses internally modified SelectTrigger
              value={targetName}
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || '');
                  setModified(true);
                  setArgs({});
                  setAvailableArgs([]);
                }
              }}
            />
          </div>
        ),
      }),
      [agentName, targetName, stepData.step],
    );

    // Helper to stop event propagation
    const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
    };

    return (
      // Add nopan class to the root Card element
      <Card className='w-80 shadow-md nowheel nopan'>
        <Handle type='target' position={Position.Left} style={{ background: '#555' }} isConnectable={isConnectable} />
        {/* Card Header - Keep default cursor, let buttons inside handle interaction */}
        <CardHeader className='p-3 bg-muted/50 cursor-default'>
          <CardTitle className='text-sm font-semibold flex justify-between items-center'>
            <span>Step {stepData.step}</span>
            {/* Button container - stop propagation here */}
            <div className='flex items-center space-x-1' onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
              <TooltipProvider delayDuration={100}>
                {/* Move Up/Down Buttons */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={() => moveStep(stepData.step, 'up')}
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
                      onClick={() => moveStep(stepData.step, 'down')}
                      disabled={isLastStep}
                    >
                      <ArrowDown className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move Down</TooltipContent>
                </Tooltip>
                {/* Save Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-6 w-6' onClick={handleSave} disabled={!modified}>
                      <Save className={cn('h-3 w-3', !modified && 'text-muted-foreground/50')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{modified ? 'Save Changes' : 'No Changes'}</TooltipContent>
                </Tooltip>
                {/* Delete Button with Confirmation */}
                <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-6 w-6 text-destructive'>
                          <X className='h-4 w-4' />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete Step</TooltipContent>
                  </Tooltip>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Deletion</DialogTitle>
                      <DialogDescription>Are you sure you want to delete Step {stepData.step}?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant='outline'>Cancel</Button>
                      </DialogClose>
                      <Button variant='destructive' onClick={handleDeleteConfirm}>
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TooltipProvider>
            </div>
          </CardTitle>
        </CardHeader>
        {/* Card Content - Apply stopPropagation to interactive sections */}
        <CardContent className='p-3 space-y-2 text-xs max-h-96 overflow-y-auto relative z-10'>
          {/* Agent Selector */}
          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <Label htmlFor={`agent-name-${stepData.step}`} className='text-xs'>
              Agent
            </Label>
            <Select
              value={agentName}
              onValueChange={(value) => {
                setAgentName(value);
                setModified(true);
              }}
              disabled={isAgentsLoading || !sortedAgents.length}
            >
              {/* Add nopan and stopPropagation directly to the trigger */}
              <SelectTrigger id={`agent-name-${stepData.step}`} className='h-8 text-xs nopan'>
                <SelectValue placeholder={isAgentsLoading ? 'Loading...' : 'Select Agent'} />
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
          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
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
              {/* Add nopan and stopPropagation directly to the trigger */}
              <SelectTrigger id={`step-type-${stepData.step}`} className='h-8 text-xs nopan'>
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
          {/* Target Component (Prompt/Command/Chain Selector) */}
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
                const currentValue = args.hasOwnProperty(name) ? args[name] : '';
                const isBoolean =
                  name.toLowerCase().includes('enable') ||
                  name.toLowerCase().startsWith('is_') ||
                  typeof currentValue === 'boolean';
                const isNumber =
                  name.toLowerCase().includes('count') ||
                  name.toLowerCase().includes('number') ||
                  name.toLowerCase().includes('depth') ||
                  name.toLowerCase().includes('limit') ||
                  typeof currentValue === 'number';

                if (isBoolean) {
                  const checkedValue =
                    typeof currentValue === 'boolean' ? currentValue : String(currentValue).toLowerCase() === 'true';
                  return (
                    // Stop propagation for the switch container
                    <div
                      key={name}
                      className='flex items-center space-x-2'
                      onMouseDown={stopPropagation}
                      onTouchStart={stopPropagation}
                    >
                      {/* Add nopan and stopPropagation directly to Switch */}
                      <Switch
                        id={argId}
                        checked={checkedValue}
                        onCheckedChange={(checked) => {
                          setArgs((prev) => ({ ...prev, [name]: checked }));
                          setModified(true);
                        }}
                        className='nopan'
                      />
                      <Label htmlFor={argId} className='text-xs cursor-pointer'>
                        {label}
                      </Label>
                    </div>
                  );
                }

                return (
                  // Stop propagation for the input container
                  <div key={name} onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                    <Label htmlFor={argId} className='text-xs'>
                      {label}
                    </Label>
                    {/* Add nopan and stopPropagation directly to Input */}
                    <Input
                      id={argId}
                      value={String(currentValue ?? '')}
                      type={isNumber ? 'number' : 'text'}
                      onChange={(e) => {
                        const newValue = isNumber ? Number(e.target.value) || 0 : e.target.value;
                        setArgs((prev) => ({ ...prev, [name]: newValue }));
                        setModified(true);
                      }}
                      className='w-full h-8 text-xs nopan' // Add nopan
                      placeholder={`Enter ${label}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {!isLoadingArgs && stepType && targetName && availableArgs.length === 0 && (
            <p className='text-xs text-muted-foreground mt-2 italic'>No arguments required.</p>
          )}
        </CardContent>
        <Handle type='source' position={Position.Right} style={{ background: '#555' }} isConnectable={isConnectable} />
      </Card>
    );
  },
);
ChainStepNode.displayName = 'ChainStepNode';

// --- Main Flow Component ---

const NODE_WIDTH = 320;
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

  const reactFlowInstance = useReactFlow<any, any>();
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
        toast({ title: 'Error Moving Step', description: err.message || 'API error.', variant: 'destructive' });
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
          moveStep,
        },
        draggable: false,
        connectable: false,
        selectable: false,
        style: { width: NODE_WIDTH },
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
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
    setNodes([]);
    setEdges([]);
  };

  const handleNewChain = async () => {
    if (!newChainName) {
      toast({ title: 'Error', description: 'Chain name is required.', variant: 'destructive' });
      return;
    }
    try {
      await context.agixt.addChain(newChainName);
      await mutateChains();
      router.push(`/settings/chains?chain=${encodeURIComponent(newChainName)}`);
      toast({ title: 'Chain Created', description: `Successfully created "${newChainName}".` });
      setShowCreateDialog(false);
      setNewChainName('');
    } catch (err: any) {
      console.error('Error creating chain:', err);
      toast({ title: 'Error Creating Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleChainImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const finalChainName = newChainName || file.name.replace(/\.json$/i, '');
    if (!finalChainName) {
      toast({ title: 'Error', description: 'Chain name is required for import.', variant: 'destructive' });
      return;
    }
    try {
      const fileContent = await file.text();
      const steps = JSON.parse(fileContent);
      if (!Array.isArray(steps)) throw new Error('Invalid file format. Expected a JSON array of steps.');
      await context.agixt.addChain(finalChainName);
      await context.agixt.importChain(finalChainName, steps);
      await mutateChains();
      router.push(`/settings/chains?chain=${encodeURIComponent(finalChainName)}`);
      toast({ title: 'Chain Imported', description: `Successfully imported "${finalChainName}".` });
      setShowCreateDialog(false);
      setNewChainName('');
    } catch (err: any) {
      console.error('Error importing chain:', err);
      toast({ title: 'Error Importing Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleDeleteChain = async () => {
    if (!currentChainName) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete the chain "${currentChainName}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await context.agixt.deleteChain(currentChainName);
      await mutateChains();
      const firstChainName = chainsData?.filter((c) => c.chainName !== currentChainName)[0]?.chainName;
      handleSelectChain(firstChainName || null);
      toast({ title: 'Chain Deleted', description: `Successfully deleted "${currentChainName}".` });
    } catch (err: any) {
      console.error('Error deleting chain:', err);
      toast({ title: 'Error Deleting Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleRenameChain = async () => {
    if (!newName || !currentChainName) {
      setRenaming(false);
      return;
    }
    if (newName === currentChainName) {
      setRenaming(false);
      toast({ title: 'Info', description: 'Name is the same, rename cancelled.' });
      return;
    }
    try {
      await context.agixt.renameChain(currentChainName, newName);
      setRenaming(false);
      await mutateChains();
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('chain', newName);
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
      toast({ title: 'Chain Renamed', description: `Renamed to "${newName}".` });
    } catch (err: any) {
      console.error('Error renaming chain:', err);
      toast({ title: 'Error Renaming Chain', description: err.message || 'API error.', variant: 'destructive' });
      setRenaming(false);
    }
  };

  const handleExportChain = async () => {
    if (!currentChainName || !chainData?.steps) {
      toast({ title: 'Error', description: 'No chain selected or chain data is empty.', variant: 'destructive' });
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
      toast({ title: 'Chain Exported', description: `Successfully exported "${currentChainName}".` });
    } catch (err: any) {
      console.error('Error exporting chain:', err);
      toast({ title: 'Error Exporting Chain', description: err.message || 'API error.', variant: 'destructive' });
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
      toast({ title: 'Step Added', description: `Step ${newStepNumber} added to chain.` });
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 100);
    } catch (err: any) {
      console.error('Error adding step:', err);
      toast({ title: 'Error Adding Step', description: err.message || 'API error.', variant: 'destructive' });
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
                    placeholder='Enter new chain name'
                    className='h-9'
                  />
                ) : (
                  <Select value={currentChainName || ''} onValueChange={handleSelectChain} disabled={!chainsData}>
                    <SelectTrigger className='w-full h-9'>
                      <SelectValue placeholder={!chainsData ? 'Loading Chains...' : 'Select a Chain'} />
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
                <TooltipContent>Create or Import Chain</TooltipContent>
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
                    <TooltipContent>Export Chain Steps (JSON)</TooltipContent>
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
                    <TooltipContent>{renaming ? 'Save New Name' : 'Rename Chain'}</TooltipContent>
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
                      <TooltipContent>Cancel Rename</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleDeleteChain}
                        disabled={renaming || !currentChainName}
                        className='h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete Chain</TooltipContent>
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
        {!currentChainName ? (
          <div className='flex items-center justify-center h-full text-muted-foreground'>
            {!chainsData
              ? 'Loading chains...'
              : chainsData.length === 0
                ? 'No chains exist. Create one!'
                : 'Select a chain to view its steps.'}
          </div>
        ) : isChainLoading ? (
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-20'>Loading chain...</div>
        ) : chainError ? (
          <div className='p-4 text-red-500'>Error loading chain data. Please try selecting it again.</div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
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
            panOnDrag={true} // Enable panning
            panOnScroll={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={true}
            preventScrolling={false}
            // Disable selection unless interacting with node elements
            nodesFocusable={false} // Prevents focus outline on node click
            // These might not be strictly necessary if nodesDraggable/selectable are false
            // but can help ensure panning is the default interaction
            selectionOnDrag={false}
            // selectionKeyCode={null} // Disables shift-click selection if needed
            // multiSelectionKeyCode={null} // Disables ctrl/cmd-click multi-selection if needed
          >
            <Controls className='react-flow__controls !bottom-auto !top-4 !left-4' />
            <Background />
          </ReactFlow>
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
                Name*
              </Label>
              <Input
                id='chain-name-dialog'
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                className='col-span-3'
                placeholder='Required for create/import'
              />
            </div>
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='import-chain-dialog' className='text-right'>
                Import File
              </Label>
              <Input
                id='import-chain-dialog'
                type='file'
                accept='.json'
                onChange={handleChainImport}
                className='col-span-3 file:mr-2 file:rounded file:border file:border-solid file:border-input file:bg-background file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-accent'
              />
            </div>
            <p className='text-xs text-muted-foreground col-span-4 text-center pt-2'>
              To Create: Enter name and click Create.
              <br />
              To Import: Select JSON file (name optional, defaults to filename).
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
              Create Chain
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
