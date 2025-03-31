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
              // Handle cases where the value might be null or undefined initially
              initialArgs[key] = ''; // Default to empty string
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

    // Fetch available agents using SWR
    const { data: agentsData, isLoading: isAgentsLoading } = useSWR('/agents', () => context.agixt.getAgents(), {
      fallbackData: [],
    });

    // Memoize sorted agent names
    const sortedAgents = useMemo(
      () =>
        agentsData
          ?.map((agent: any) => agent.name as string)
          .sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase())) || [],
      [agentsData],
    );

    // Callback to fetch arguments based on step type and target name
    const fetchArgs = useCallback(async () => {
      if (!targetName || !stepType) {
        setAvailableArgs([]);
        setArgs({}); // Clear args when target is empty
        return;
      }
      setIsLoadingArgs(true);
      let fetchedArgNames: string[] = [];
      let result: any;
      try {
        // Fetch arguments based on the selected step type
        if (stepType === 'Prompt') {
          result = await context.agixt.getPromptArgs(targetName, 'Default');
          fetchedArgNames = Array.isArray(result) ? result.map(String) : [];
        } else if (stepType === 'Chain') {
          result = await context.agixt.getChainArgs(targetName);
          // Ensure result is treated as an array even if API returns a single string or null/undefined
          fetchedArgNames = Array.isArray(result) ? result.map(String) : result ? [String(result)] : [];
        } else if (stepType === 'Command') {
          result = await context.agixt.getCommandArgs(targetName);
          // Handle potential errors or non-object results from getCommandArgs
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
        // Filter out ignored arguments
        const filteredArgNames = fetchedArgNames.filter((arg) => !ignoreArgs.includes(arg));
        setAvailableArgs(filteredArgNames);

        // Update args state, preserving existing values if keys match, otherwise initializing
        setArgs((prevArgs) => {
          const newArgs = filteredArgNames.reduce(
            (acc, key) => {
              // Preserve existing value if the key is still available, otherwise initialize
              acc[key] = prevArgs.hasOwnProperty(key) ? prevArgs[key] : '';
              return acc;
            },
            {} as Record<string, string | number | boolean>,
          );
          return newArgs;
        });
        setIsLoadingArgs(false);
      }
    }, [stepType, targetName, context.agixt]); // Dependencies for fetching args

    // Fetch arguments when step type or target name changes
    useEffect(() => {
      fetchArgs();
    }, [fetchArgs]);

    // Handler to save the step changes
    const handleSave = async (): Promise<void> => {
      // *** ADDED GUARD ***
      // Ensure chainName is a valid string before proceeding.
      if (!chainName || typeof chainName !== 'string' || chainName.trim() === '') {
        toast({
          title: 'Error Saving Step',
          description: 'Chain name is missing or invalid. Cannot save.',
          variant: 'destructive',
        });
        console.error('handleSave called without a valid chainName. Current value:', chainName);
        return; // Stop execution if chainName is not valid
      }
      // *** END ADDED GUARD ***

      // Construct the base object for the prompt/command/chain name
      const nameObj: Partial<ChainStepPrompt> = {};
      let validationError = false;

      // Set the correct name field based on step type and nullify others
      if (stepType === 'Prompt') {
        if (!targetName) {
          toast({ title: 'Error', description: 'Prompt Name is required.', variant: 'destructive' });
          validationError = true;
        }
        nameObj.promptName = targetName;
        nameObj.promptCategory = 'Default'; // Assuming 'Default' category
        nameObj.commandName = null;
        nameObj.chainName = null;
      } else if (stepType === 'Command') {
        if (!targetName) {
          toast({ title: 'Error', description: 'Command Name is required.', variant: 'destructive' });
          validationError = true;
        }
        nameObj.commandName = targetName;
        nameObj.promptName = null;
        nameObj.promptCategory = null;
        nameObj.chainName = null;
      } else if (stepType === 'Chain') {
        if (!targetName) {
          toast({ title: 'Error', description: 'Chain Name is required.', variant: 'destructive' });
          validationError = true;
        }
        nameObj.chainName = targetName;
        nameObj.promptName = null;
        nameObj.promptCategory = null;
        nameObj.commandName = null;
      } else {
        toast({ title: 'Error', description: 'Invalid step type selected.', variant: 'destructive' });
        validationError = true;
      }

      if (validationError) return; // Stop if validation failed

      // Construct the final arguments payload, including only available args
      const validArgs = { ...nameObj };
      availableArgs.forEach((key) => {
        // Include the argument if it's available and has a value in the state
        if (args.hasOwnProperty(key)) {
          validArgs[key] = args[key];
        }
        // Optional: If you want to ensure *all* available args are sent, even if empty:
        // else {
        //   validArgs[key] = ''; // Or appropriate default based on type
        // }
      });

      try {
        // Call the SDK function to update the step - Now guarded by the chainName check
        await context.agixt.updateStep(chainName, stepData.step, agentName, stepType, validArgs);
        await mutateChain(); // Re-fetch the chain data to update the UI
        setModified(false); // Reset modification state
        toast({ title: 'Step Saved', description: `Step ${stepData.step} updated.` });
      } catch (err: any) {
        console.error('Failed to save step:', err);
        toast({ title: 'Error Saving Step', description: err.message || 'API error.', variant: 'destructive' });
        // Consider *not* setting modified to false on error, so user can retry
      }
    };

    // Handler for confirming step deletion
    const handleDeleteConfirm = async (): Promise<void> => {
      try {
        await context.agixt.deleteStep(chainName, stepData.step);
        await mutateChain(); // Update the current chain view
        await mutateChains(); // Update the list of all chains (if needed)
        toast({ title: 'Step Deleted', description: `Step ${stepData.step} removed.` });
        setIsDeleteConfirmOpen(false); // Close the confirmation dialog
      } catch (err: any) {
        console.error('Failed to delete step:', err);
        toast({ title: 'Error Deleting Step', description: err.message || 'API error.', variant: 'destructive' });
        setIsDeleteConfirmOpen(false); // Close dialog even on error
      }
    };

    // Memoize components for selecting Prompt/Command/Chain to avoid unnecessary re-renders
    const stepTypeComponents = useMemo(
      () => ({
        Prompt: (
          <div>
            <Label htmlFor={`prompt-name-${stepData.step}`} className='text-xs'>
              Prompt Name
            </Label>
            {/* Assumes PromptSelector handles nopan and stopPropagation internally */}
            <PromptSelector
              value={targetName}
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || ''); // Update target name
                  setModified(true); // Mark as modified
                  // Reset args when target changes, fetchArgs effect will handle reloading
                  setArgs({});
                  setAvailableArgs([]);
                }
              }}
            />
          </div>
        ),
        Command: (
          <div>
            <Label htmlFor={`command-name-${stepData.step}`} className='text-xs'>
              Command Name
            </Label>
            {/* Uses internally modified SelectTrigger */}
            <CommandSelector
              agentName={agentName} // Pass current agent name
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
            <Label htmlFor={`chain-name-${stepData.step}`} className='text-xs'>
              Chain Name
            </Label>
            {/* Uses internally modified SelectTrigger */}
            <ChainSelector
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
      [agentName, targetName, stepData.step], // Dependencies for these components
    );

    // Helper to stop event propagation (used on specific interactive elements)
    const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
    };

    // --- JSX Rendering ---
    return (
      // Add nopan class to prevent React Flow panning when interacting with the card
      <Card className='w-80 shadow-md nowheel nopan'>
        {/* Input handle (left side) */}
        <Handle type='target' position={Position.Left} style={{ background: '#555' }} isConnectable={isConnectable} />

        {/* Card Header with Step Number and Action Buttons */}
        <CardHeader className='p-3 bg-muted/50 cursor-default'>
          <CardTitle className='text-sm font-semibold flex justify-between items-center'>
            <span>Step {stepData.step}</span>
            {/* Container for buttons, stops propagation */}
            <div className='flex items-center space-x-1' onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
              <TooltipProvider delayDuration={100}>
                {/* Move Up Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={() => moveStep(stepData.step, 'up')}
                      disabled={stepData.step === 1} // Disable if it's the first step
                    >
                      <ArrowUp className='h-3 w-3' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Move Up</TooltipContent>
                </Tooltip>
                {/* Move Down Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      onClick={() => moveStep(stepData.step, 'down')}
                      disabled={isLastStep} // Disable if it's the last step
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
                {/* Delete Button with Confirmation Dialog */}
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

        {/* Card Content - Main editable fields */}
        <CardContent className='p-3 space-y-2 text-xs max-h-96 overflow-y-auto relative z-10'>
          {/* Agent Selector */}
          {/* Stop propagation for the Select container */}
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

          {/* Step Type Selector (Prompt/Command/Chain) */}
          {/* Stop propagation for the Select container */}
          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <Label htmlFor={`step-type-${stepData.step}`} className='text-xs'>
              Type
            </Label>
            <Select
              value={stepType}
              onValueChange={(value) => {
                if (value !== stepType) {
                  // Reset related state when type changes
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

          {/* Dynamically render the correct selector based on stepType */}
          {stepType && stepTypeComponents[stepType as keyof typeof stepTypeComponents]}

          {/* Arguments Section */}
          {isLoadingArgs && (
            <div className='flex items-center justify-center py-2'>
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
            </div>
          )}
          {/* Render argument fields if not loading and args are available */}
          {!isLoadingArgs && availableArgs.length > 0 && (
            <div className='mt-2 space-y-2 border-t pt-2'>
              <Label className='text-xs font-medium'>Arguments</Label>
              {availableArgs.map((name) => {
                const label = name.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
                const argId = `arg-${stepData.step}-${name}`;
                const currentValue = args.hasOwnProperty(name) ? args[name] : ''; // Default to empty string if not set
                // Heuristics to determine input type (can be refined)
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

                // Render Switch for boolean arguments
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
                        className='nopan' // Add nopan class
                      />
                      <Label htmlFor={argId} className='text-xs cursor-pointer'>
                        {label}
                      </Label>
                    </div>
                  );
                }

                // Render Input for other arguments (text or number)
                return (
                  // Stop propagation for the input container
                  <div key={name} onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                    <Label htmlFor={argId} className='text-xs'>
                      {label}
                    </Label>
                    {/* Add nopan and stopPropagation directly to Input */}
                    <Input
                      id={argId}
                      // Ensure value is always a string for the input, handle number conversion on change
                      value={String(currentValue ?? '')}
                      type={isNumber ? 'number' : 'text'}
                      onChange={(e) => {
                        // Convert back to number if needed, otherwise use string value
                        const newValue = isNumber ? Number(e.target.value) || 0 : e.target.value;
                        setArgs((prev) => ({ ...prev, [name]: newValue }));
                        setModified(true);
                      }}
                      className='w-full h-8 text-xs nopan' // Add nopan class
                      placeholder={`Enter ${label}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {/* Message when no arguments are required */}
          {!isLoadingArgs && stepType && targetName && availableArgs.length === 0 && (
            <p className='text-xs text-muted-foreground mt-2 italic'>No arguments required.</p>
          )}
        </CardContent>

        {/* Output handle (right side) */}
        <Handle type='source' position={Position.Right} style={{ background: '#555' }} isConnectable={isConnectable} />
      </Card>
    );
  },
);
ChainStepNode.displayName = 'ChainStepNode'; // Set display name for debugging

// --- Main Flow Component ---

const NODE_WIDTH = 320; // Width of each node card
const HORIZONTAL_SPACING = 60; // Horizontal space between nodes
const VERTICAL_POSITION = 50; // Vertical position of the nodes

function ChainFlow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [currentChainName, setCurrentChainName] = useState<string | null>(null);
  const [newName, setNewName] = useState(''); // State for the new name during rename

  const reactFlowInstance = useReactFlow<any, any>(); // Hook to interact with React Flow instance
  const context = useInteractiveConfig(); // Get AGiXT SDK context
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Get the selected chain name from URL query params
  const selectedChainName = searchParams.get('chain');

  // SWR hooks for fetching chains list and the currently selected chain
  const { data: chainsData, mutate: mutateChains } = useChains();
  const {
    data: chainData, // Data for the currently selected chain
    mutate: mutateChain, // Function to re-fetch the current chain
    error: chainError,
    isLoading: isChainLoading,
  } = useChain(selectedChainName ?? undefined); // Fetch only if selectedChainName exists
  const { data: agentData } = useAgent(false); // Fetch basic agent data (used for default agent in new steps)

  // Callbacks for React Flow node/edge changes
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );
  // Callback for connecting edges (currently not used as nodes are not connectable)
  // const onConnect = useCallback((connection: Connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);

  // Callback to move a step up or down
  const moveStep = useCallback(
    async (stepNumber: number, direction: 'up' | 'down') => {
      if (!currentChainName || !chainData) return; // Need chain name and data

      // Calculate the target step number
      const newStepNumber = direction === 'up' ? stepNumber - 1 : stepNumber + 1;
      // Validate the new step number
      if (newStepNumber < 1 || newStepNumber > chainData.steps.length) return;

      try {
        // Call the SDK function to move the step
        await context.agixt.moveStep(currentChainName, stepNumber, newStepNumber);
        await mutateChain(); // Re-fetch the chain data to update the UI
        toast({ title: 'Step Moved', description: `Step ${stepNumber} moved ${direction}.` });
      } catch (err: any) {
        console.error('Error moving step:', err);
        toast({ title: 'Error Moving Step', description: err.message || 'API error.', variant: 'destructive' });
      }
    },
    [currentChainName, chainData, context.agixt, mutateChain], // Dependencies
  );

  // Effect to update nodes and edges when chainData changes
  useEffect(() => {
    if (chainData?.steps) {
      const numSteps = chainData.steps.length;
      // Create nodes for each step
      const newNodes: Node[] = chainData.steps.map((step, index) => ({
        id: `step-${step.step}`, // Unique ID for the node
        type: 'chainStep', // Custom node type defined earlier
        position: { x: index * (NODE_WIDTH + HORIZONTAL_SPACING), y: VERTICAL_POSITION }, // Calculate position
        data: {
          // Data passed to the ChainStepNode component
          stepData: step,
          chainName: chainData.chainName, // Pass the correct chain name
          mutateChain,
          mutateChains,
          isLastStep: index === numSteps - 1, // Flag if it's the last step
          moveStep, // Pass the moveStep function
        },
        draggable: false, // Disable dragging nodes
        connectable: false, // Disable connecting nodes
        selectable: false, // Disable selecting nodes
        style: { width: NODE_WIDTH }, // Set node width
      }));

      // Create edges between consecutive steps
      const newEdges: Edge[] = chainData.steps.slice(0, -1).map((step) => ({
        id: `e${step.step}-${step.step + 1}`, // Unique edge ID
        source: `step-${step.step}`, // Source node ID
        target: `step-${step.step + 1}`, // Target node ID
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }, // Arrow marker
        type: 'smoothstep', // Edge type
        style: { strokeWidth: 2 }, // Edge style
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      // Fit the view after nodes/edges are set (with a slight delay for rendering)
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 50);
    } else {
      // Clear nodes and edges if no chain data
      setNodes([]);
      setEdges([]);
    }
  }, [chainData, mutateChain, mutateChains, reactFlowInstance, moveStep]); // Dependencies

  // Effect to update currentChainName and renaming state based on URL param
  useEffect(() => {
    setCurrentChainName(selectedChainName);
    if (renaming && selectedChainName) {
      setNewName(selectedChainName); // Pre-fill rename input
    } else if (!selectedChainName) {
      // Reset renaming state if no chain is selected
      setRenaming(false);
      setNewName('');
    }
  }, [selectedChainName, renaming]);

  // Handler for selecting a chain from the dropdown
  const handleSelectChain = (value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value && value !== '/') {
      current.set('chain', value); // Set chain param if a valid chain is selected
    } else {
      current.delete('chain'); // Remove chain param if '- Select -' is chosen
    }
    // Update URL without full page reload
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
    // Clear nodes/edges immediately for responsiveness
    setNodes([]);
    setEdges([]);
  };

  // Handler for creating a new chain (from dialog)
  const handleNewChain = async () => {
    if (!newChainName) {
      toast({ title: 'Error', description: 'Chain name is required.', variant: 'destructive' });
      return;
    }
    try {
      await context.agixt.addChain(newChainName); // Call SDK
      await mutateChains(); // Update the list of chains
      // Navigate to the newly created chain
      router.push(`/settings/chains?chain=${encodeURIComponent(newChainName)}`);
      toast({ title: 'Chain Created', description: `Successfully created "${newChainName}".` });
      setShowCreateDialog(false); // Close dialog
      setNewChainName(''); // Reset input
    } catch (err: any) {
      console.error('Error creating chain:', err);
      toast({ title: 'Error Creating Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handler for importing a chain from a JSON file (from dialog)
  const handleChainImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Use provided name or derive from filename
    const finalChainName = newChainName || file.name.replace(/\.json$/i, '');
    if (!finalChainName) {
      toast({ title: 'Error', description: 'Chain name is required for import.', variant: 'destructive' });
      return;
    }

    try {
      const fileContent = await file.text(); // Read file content
      const steps = JSON.parse(fileContent); // Parse JSON
      if (!Array.isArray(steps)) {
        throw new Error('Invalid file format. Expected a JSON array of steps.');
      }

      await context.agixt.addChain(finalChainName); // Create the chain first
      await context.agixt.importChain(finalChainName, steps); // Import steps into it
      await mutateChains(); // Update chains list
      // Navigate to the imported chain
      router.push(`/settings/chains?chain=${encodeURIComponent(finalChainName)}`);
      toast({ title: 'Chain Imported', description: `Successfully imported "${finalChainName}".` });
      setShowCreateDialog(false); // Close dialog
      setNewChainName(''); // Reset input
    } catch (err: any) {
      console.error('Error importing chain:', err);
      toast({ title: 'Error Importing Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handler for deleting the currently selected chain
  const handleDeleteChain = async () => {
    if (!currentChainName) return;
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete the chain "${currentChainName}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await context.agixt.deleteChain(currentChainName); // Call SDK
      await mutateChains(); // Update chains list
      // Select the first chain in the list after deletion, or none if list is empty
      const firstChainName = chainsData?.filter((c) => c.chainName !== currentChainName)[0]?.chainName;
      handleSelectChain(firstChainName || null); // Update URL/selection
      toast({ title: 'Chain Deleted', description: `Successfully deleted "${currentChainName}".` });
    } catch (err: any) {
      console.error('Error deleting chain:', err);
      toast({ title: 'Error Deleting Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handler for renaming the currently selected chain
  const handleRenameChain = async () => {
    if (!newName || !currentChainName) {
      setRenaming(false); // Cancel if no new name or current name
      return;
    }
    if (newName === currentChainName) {
      setRenaming(false); // Cancel if name hasn't changed
      toast({ title: 'Info', description: 'Name is the same, rename cancelled.' });
      return;
    }
    try {
      await context.agixt.renameChain(currentChainName, newName); // Call SDK
      setRenaming(false); // Exit renaming mode
      await mutateChains(); // Update chains list
      // Update URL query param to reflect the new name
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('chain', newName);
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
      toast({ title: 'Chain Renamed', description: `Renamed to "${newName}".` });
    } catch (err: any) {
      console.error('Error renaming chain:', err);
      toast({ title: 'Error Renaming Chain', description: err.message || 'API error.', variant: 'destructive' });
      setRenaming(false); // Exit renaming mode on error
    }
  };

  // Handler for exporting the current chain's steps as JSON
  const handleExportChain = async () => {
    if (!currentChainName || !chainData?.steps) {
      toast({ title: 'Error', description: 'No chain selected or chain data is empty.', variant: 'destructive' });
      return;
    }
    try {
      // Create a downloadable JSON file
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(chainData.steps, null, 2)], { type: 'application/json' }); // Pretty print JSON
      element.href = URL.createObjectURL(file);
      element.download = `${currentChainName}.json`; // Filename
      document.body.appendChild(element);
      element.click(); // Trigger download
      document.body.removeChild(element);
      toast({ title: 'Chain Exported', description: `Successfully exported "${currentChainName}".` });
    } catch (err: any) {
      console.error('Error exporting chain:', err);
      toast({ title: 'Error Exporting Chain', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handler for adding a new step to the end of the current chain
  const handleAddStep = async () => {
    if (!chainData || !currentChainName) {
      toast({ title: 'Error', description: 'No chain selected.', variant: 'destructive' });
      return;
    }
    // Determine the agent for the new step (last step's agent or default)
    const lastStep = chainData.steps.length > 0 ? chainData.steps[chainData.steps.length - 1] : null;
    const newStepNumber = chainData.steps.length + 1;
    const defaultAgent = agentData?.agent?.name ?? 'AGiXT'; // Use fetched agent name or fallback

    // Default new step settings (Prompt type, empty prompt)
    const defaultPromptArgs: Partial<ChainStepPrompt> = {
      promptName: '', // Empty prompt name initially
      promptCategory: 'Default',
      commandName: null,
      chainName: null,
    };

    try {
      await context.agixt.addStep(
        currentChainName,
        newStepNumber,
        lastStep ? lastStep.agentName : defaultAgent, // Agent name
        'Prompt', // Default type
        defaultPromptArgs, // Default args
      );
      await mutateChain(); // Re-fetch current chain data
      toast({ title: 'Step Added', description: `Step ${newStepNumber} added to chain.` });
      // Refit the view to include the new node
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 100);
    } catch (err: any) {
      console.error('Error adding step:', err);
      toast({ title: 'Error Adding Step', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Memoize the custom node type for React Flow
  const nodeTypes = useMemo(() => ({ chainStep: ChainStepNode }), []);

  // --- JSX Rendering ---
  return (
    <>
      {/* Card for selecting/managing the chain */}
      <Card>
        <CardContent className='p-4 space-y-4'>
          <Label>Select or Manage Chain</Label>
          <TooltipProvider delayDuration={100}>
            <div className='flex items-center space-x-2'>
              {/* Chain Selector or Rename Input */}
              <div className='flex-1'>
                {renaming ? (
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder='Enter new chain name'
                    className='h-9'
                  />
                ) : (
                  // Chain Selection Dropdown
                  <Select value={currentChainName || ''} onValueChange={handleSelectChain} disabled={!chainsData}>
                    <SelectTrigger className='w-full h-9'>
                      <SelectValue placeholder={!chainsData ? 'Loading Chains...' : 'Select a Chain'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='/'>- Select -</SelectItem>
                      {/* Populate dropdown with fetched chains */}
                      {chainsData?.map((chain) => (
                        <SelectItem key={chain.id} value={chain.chainName}>
                          {chain.chainName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* Action Buttons */}
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Create/Import Button */}
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setShowCreateDialog(true)}
                    disabled={renaming} // Disable while renaming
                    className='h-9 w-9'
                  >
                    <Plus className='h-4 w-4' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create or Import Chain</TooltipContent>
              </Tooltip>
              {/* Buttons visible only when a chain is selected */}
              {currentChainName && (
                <>
                  {/* Export Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleExportChain}
                        disabled={renaming || !chainData} // Disable while renaming or if no data
                        className='h-9 w-9'
                      >
                        <Download className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export Chain Steps (JSON)</TooltipContent>
                  </Tooltip>
                  {/* Rename/Confirm Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={renaming ? handleRenameChain : () => setRenaming(true)}
                        disabled={!currentChainName} // Disable if no chain selected
                        className='h-9 w-9'
                      >
                        {renaming ? <Check className='h-4 w-4' /> : <Pencil className='h-4 w-4' />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{renaming ? 'Save New Name' : 'Rename Chain'}</TooltipContent>
                  </Tooltip>
                  {/* Cancel Rename Button (visible only during rename) */}
                  {renaming && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            setRenaming(false);
                            setNewName(currentChainName || ''); // Reset input
                          }}
                          className='h-9 w-9 text-muted-foreground'
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel Rename</TooltipContent>
                    </Tooltip>
                  )}
                  {/* Delete Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='icon'
                        onClick={handleDeleteChain}
                        disabled={renaming || !currentChainName} // Disable while renaming or if no chain selected
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

      {/* React Flow Area */}
      <div className='flex-grow w-full h-[600px] border rounded-md relative overflow-hidden'>
        {/* Add Step Button */}
        <Button
          onClick={handleAddStep}
          variant='outline'
          size='sm'
          className='absolute bottom-4 right-4 z-10 flex items-center shadow-md bg-background hover:bg-muted'
          // Disable if loading, no chain selected, or renaming
          disabled={isChainLoading || !chainData || !currentChainName || renaming}
        >
          <Plus className='mr-1 h-4 w-4' /> Add Step
        </Button>

        {/* Conditional Rendering for Flow Area */}
        {!currentChainName ? (
          // Placeholder when no chain is selected
          <div className='flex items-center justify-center h-full text-muted-foreground'>
            {!chainsData
              ? 'Loading chains...'
              : chainsData.length === 0
                ? 'No chains exist. Create one!'
                : 'Select a chain to view its steps.'}
          </div>
        ) : isChainLoading ? (
          // Loading indicator
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-20'>Loading chain...</div>
        ) : chainError ? (
          // Error message
          <div className='p-4 text-red-500'>Error loading chain data. Please try selecting it again.</div>
        ) : (
          // Render React Flow component
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange} // Handle node position changes (though dragging is disabled)
            onEdgesChange={onEdgesChange} // Handle edge changes (if any)
            // onConnect={onConnect} // Handle connections (disabled)
            nodeTypes={nodeTypes} // Register custom node type
            fitView // Fit content to view on load/change
            fitViewOptions={{ padding: 0.2, duration: 300 }} // Options for fitView
            className='bg-background'
            proOptions={{ hideAttribution: true }} // Hide React Flow attribution
            minZoom={0.1}
            maxZoom={2}
            // Interaction options
            nodesDraggable={false} // Disable node dragging
            nodesConnectable={false} // Disable connecting nodes by dragging handles
            elementsSelectable={false} // Disable selecting nodes/edges by clicking
            panOnDrag={true} // Enable panning by dragging the background
            panOnScroll={true} // Enable panning with scroll wheel
            zoomOnScroll={true} // Enable zooming with scroll wheel
            zoomOnPinch={true} // Enable pinch zoom on touch devices
            zoomOnDoubleClick={true} // Enable zoom on double click
            preventScrolling={false} // Allow page scrolling when mouse is over the flow area
            // Ensure panning is default by explicitly disabling selection interactions
            nodesFocusable={false} // Prevents focus outline on node click
            selectionOnDrag={false} // Disable box selection by dragging
            // selectionKeyCode={null} // Disable selection with key (e.g., Shift)
            // multiSelectionKeyCode={null} // Disable multi-selection with key (e.g., Ctrl/Cmd)
          >
            <Controls className='react-flow__controls !bottom-auto !top-4 !left-4' /> {/* Position controls */}
            <Background /> {/* Render background pattern */}
          </ReactFlow>
        )}
      </div>

      {/* Dialog for Creating or Importing a Chain */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create or Import Chain</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            {/* Chain Name Input */}
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
            {/* Import File Input */}
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='import-chain-dialog' className='text-right'>
                Import File
              </Label>
              <Input
                id='import-chain-dialog'
                type='file'
                accept='.json' // Accept only JSON files
                onChange={handleChainImport} // Use import handler on change
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
            {/* Cancel Button */}
            <Button
              variant='outline'
              onClick={() => {
                setShowCreateDialog(false);
                setNewChainName(''); // Reset name on cancel
              }}
            >
              Cancel
            </Button>
            {/* Create Button */}
            <Button onClick={handleNewChain} disabled={!newChainName}>
              Create Chain
            </Button>
            {/* Import button is implicitly handled by the file input's onChange */}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Wrapper component to provide ReactFlow context
export default function ChainPageWrapper() {
  return (
    <SidebarPage title='Chains'>
      <ReactFlowProvider>
        {' '}
        {/* Provides context for useReactFlow hook */}
        <ChainFlow />
      </ReactFlowProvider>
    </SidebarPage>
  );
}
