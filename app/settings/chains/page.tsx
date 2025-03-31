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
  Position,
  MarkerType,
  NodeProps,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Check, Download, Pencil, Plus, Save, Trash2, Upload, X, ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import useSWR from 'swr';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import PromptSelector from '@/components/layout/PromptSelector';

import { SidebarPage } from '@/components/layout/SidebarPage';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useAgent } from '@/components/interactive/useAgent';
import { useChain, useChains, ChainStep as ChainStepType } from '@/components/interactive/useChain';
import { toast } from '@/components/layout/toast';
import { cn } from '@/lib/utils';

// Define ChainStepPrompt structure if not implicitly defined elsewhere
type ChainStepPrompt = {
  prompt_name?: string | null;
  prompt_category?: string | null;
  command_name?: string | null;
  chain_name?: string | null;
  [key: string]: any; // Allow other properties for arguments
};

// --- Selectors ---
const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
  e.stopPropagation();
};

// CommandSelector: Renders dropdown for selecting commands available to an agent
function CommandSelector({
  agentName,
  value,
  onChange,
  onMouseDown,
  onTouchStart,
}: {
  agentName: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}): React.JSX.Element {
  const { data: agentData, error, isLoading } = useAgent(false, agentName);

  if (isLoading) return <div className='text-xs text-muted-foreground h-8 flex items-center'>Loading Commands...</div>;
  if (error) return <div className='text-xs text-destructive h-8 flex items-center'>Command Load Error</div>;

  const commandsObject = agentData?.commands ?? {};
  const commandKeys = commandsObject && typeof commandsObject === 'object' ? Object.keys(commandsObject) : [];

  // Convert null to undefined for the Select component
  const selectValue = value === null ? undefined : value;

  return (
    <div className='w-full'>
      <Select
        disabled={!commandKeys.length}
        value={selectValue}
        onValueChange={(val) => onChange?.(val === '/' ? null : val)}
      >
        <SelectTrigger
          className='w-full h-8 text-xs nopan'
          onMouseDown={onMouseDown || stopPropagation}
          onTouchStart={onTouchStart || stopPropagation}
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

// ChainSelector: Renders dropdown for selecting other chains
function ChainSelector({
  value,
  onChange,
  onMouseDown,
  onTouchStart,
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
}): React.JSX.Element {
  const { data: chainData, error, isLoading } = useChains();

  if (isLoading) return <div className='text-xs text-muted-foreground h-8 flex items-center'>Loading Chains...</div>;
  if (error) return <div className='text-xs text-destructive h-8 flex items-center'>Chain Load Error</div>;

  // Convert null to undefined for the Select component
  const selectValue = value === null ? undefined : value;

  return (
    <div className='w-full'>
      <Select
        disabled={!chainData || chainData.length === 0}
        value={selectValue}
        onValueChange={(val) => onChange?.(val === '/' ? null : val)}
      >
        <SelectTrigger
          className='w-full h-8 text-xs nopan'
          onMouseDown={onMouseDown || stopPropagation}
          onTouchStart={onTouchStart || stopPropagation}
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

// Arguments that are handled structurally or injected by the system, not rendered as generic inputs
const systemInjectedArgs = [
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
const structuralArgs = ['prompt_name', 'prompt_category', 'command_name', 'chain', 'chain_name'];
const conditionalArgs = ['context', 'user_input']; // Handled separately based on step type
const ignoreArgsForGenericRender = [...systemInjectedArgs, ...structuralArgs, ...conditionalArgs];

// Helper function to extract args from prompt
const extractArgsFromPrompt = (prompt: ChainStepPrompt): Record<string, string | number | boolean> => {
  const extractedArgs: Record<string, string | number | boolean> = {};
  if (prompt) {
    for (const key in prompt) {
      // Only include keys that are *not* structural or system args
      if (!structuralArgs.includes(key) && !systemInjectedArgs.includes(key)) {
        const value = prompt[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          extractedArgs[key] = value;
        } else {
          // Handle potential non-primitive values (though the API should ideally send primitives)
          try {
            extractedArgs[key] = JSON.stringify(value); // Attempt to stringify
          } catch {
            extractedArgs[key] = ''; // Fallback to empty string
          }
        }
      }
    }
  }
  return extractedArgs;
};

// ChainStepNode: Component representing a single step in the chain within the ReactFlow diagram
const ChainStepNode = memo(
  ({
    data,
    isConnectable,
  }: NodeProps<{
    stepData: ChainStepType; // Data for this specific step
    chain_name: string; // Name of the parent chain
    mutateChain: () => void; // Function to revalidate chain data
    mutateChains: () => void; // Function to revalidate list of all chains
    isLastStep: boolean; // Flag indicating if this is the last step
    moveStep: (stepNumber: number, direction: 'up' | 'down') => Promise<void>; // Callback to move step
  }>) => {
    const { stepData, chain_name, mutateChain, mutateChains, isLastStep, moveStep } = data;
    const context = useInteractiveConfig(); // Access SDK and global state

    // --- State Initialization ---
    // These states hold the *current* UI representation of the step's configuration
    const [agentName, setAgentName] = useState(stepData.agentName);
    const [stepType, setStepType] = useState(stepData.promptType || 'Prompt');
    const [targetName, setTargetName] = useState(stepData.targetName || '');
    const [args, setArgs] = useState<Record<string, string | number | boolean>>({}); // Initialized in useEffect
    const [availableArgs, setAvailableArgs] = useState<string[]>([]); // Argument keys expected by the target
    const [modified, setModified] = useState(false); // Track if changes have been made since last save/load
    const [isLoadingArgs, setIsLoadingArgs] = useState(false); // Loading indicator for fetching args
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); // State for delete confirmation dialog
    // --- End State Initialization ---

    // Effect to synchronize internal state when the stepData prop changes (e.g., chain load, step move)
    useEffect(() => {
      console.log(`SYNC EFFECT: Step ${stepData.step} received new stepData:`, stepData);
      setAgentName(stepData.agentName);

      // Determine Step Type: Prioritize explicit `promptType`
      const newStepType = stepData.promptType || 'Prompt'; // Default if missing
      setStepType(newStepType);
      console.log(`SYNC EFFECT: Step ${stepData.step} type set to: ${newStepType}`);

      // Determine Target Name: Prioritize explicit `targetName`
      let newTargetName = stepData.targetName || '';
      // Fallback only if targetName is missing (should ideally be present from API)
      console.log(`SYNC EFFECT: Step ${stepData.step} targetName received: ${newTargetName}`);
      if (!newTargetName) {
        if (newStepType === 'Chain') newTargetName = stepData.prompt?.chain_name || '';
        else if (newStepType === 'Command') newTargetName = stepData.prompt?.command_name || '';
        else newTargetName = stepData.prompt?.prompt_name || '';
        console.log(`SYNC EFFECT: Step ${stepData.step} targetName fallback: ${newTargetName}`);
      }
      setTargetName(newTargetName);
      console.log(`SYNC EFFECT: Step ${stepData.step} targetName final set to: ${newTargetName}`);

      // Set Arguments: Directly extract non-structural/system args from the `prompt` object
      const initialArgs = extractArgsFromPrompt(stepData.prompt);
      console.log(`SYNC EFFECT: Step ${stepData.step} setting args state from stepData.prompt:`, initialArgs);
      setArgs(initialArgs);

      setModified(false); // Reset modified flag as we just loaded data
      // Note: Fetching available args will be triggered by the change in stepType/targetName/agentName dependencies below.
    }, [stepData]); // Re-run ONLY when the stepData prop itself changes

    // Fetch list of available agents for the agent selector dropdown
    const { data: agentsData, isLoading: isAgentsLoading } = useSWR('/agents', () => context.agixt.getAgents(), {
      fallbackData: [],
    });
    // Memoized sorted list of agent names
    const sortedAgents = useMemo(
      () =>
        agentsData
          ?.map((agent: any) => agent.name as string)
          .sort((a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase())) || [],
      [agentsData],
    );

    // Fetches the list of *expected* argument names based on the current stepType and targetName
    const fetchAvailableArgs = useCallback(async () => {
      // Skip fetch if essential info is missing
      if (!targetName || !stepType || (stepType === 'Command' && !agentName)) {
        console.log('fetchAvailableArgs: Skipping fetch, missing info', { targetName, stepType, agentName });
        setAvailableArgs([]); // Clear available args list
        setIsLoadingArgs(false);
        return;
      }

      console.log(`fetchAvailableArgs: Fetching for ${stepType} ${targetName} (Agent: ${agentName})`);
      setIsLoadingArgs(true);

      try {
        // Fetch potential arg names based on step type
        let fetchedArgNames: string[] = [];
        let argsResult: any;

        if (stepType === 'Prompt') {
          // Try getting from prompt content first
          try {
            const promptResult = await context.agixt.getPrompt(targetName, 'Default');
            if (promptResult && typeof promptResult.prompt === 'string') {
              const matches = promptResult.prompt.match(/\{([^}]+)\}/g) || [];
              fetchedArgNames = matches.map((match) => match.replace(/[{}]/g, ''));
              console.log(`fetchAvailableArgs: Extracted from prompt content for ${targetName}:`, fetchedArgNames);
            }
            if (fetchedArgNames.length === 0) {
              // Fallback if extraction fails or no args found in content
              throw new Error('No args found in content, trying getPromptArgs');
            }
          } catch (err) {
            console.warn(
              `fetchAvailableArgs: Failed to get prompt content or no args in content for ${targetName}, falling back to getPromptArgs.`,
              err,
            );
            argsResult = await context.agixt.getPromptArgs(targetName, 'Default');
            console.log(`fetchAvailableArgs: Result from getPromptArgs for ${targetName}:`, argsResult);
          }
        } else if (stepType === 'Command') {
          argsResult = await context.agixt.getCommandArgs(targetName);
          console.log(`fetchAvailableArgs: Result from getCommandArgs for ${targetName}:`, argsResult);
        } else if (stepType === 'Chain') {
          argsResult = await context.agixt.getChainArgs(targetName);
          console.log(`fetchAvailableArgs: Result from getChainArgs for ${targetName}:`, argsResult);
        }

        // Handle different response structures for argsResult (if not already extracted from content)
        if (argsResult) {
          if (Array.isArray(argsResult)) {
            fetchedArgNames = argsResult; // Direct array of names
          } else if (argsResult && Array.isArray(argsResult.prompt_args)) {
            fetchedArgNames = argsResult.prompt_args; // Nested under prompt_args (specifically for prompt fallback)
          } else if (typeof argsResult === 'object' && argsResult !== null && !Array.isArray(argsResult)) {
            fetchedArgNames = Object.keys(argsResult); // Keys of an object
          }
        }

        // Filter out ignored args from the fetched list
        const filteredFetchedArgs = fetchedArgNames.filter((arg) => !ignoreArgsForGenericRender.includes(arg));

        console.log(`fetchAvailableArgs: Setting availableArgs state to:`, filteredFetchedArgs);
        setAvailableArgs(filteredFetchedArgs); // Update the list of *expected* args

        // IMPORTANT: DO NOT modify the `args` (values) state here.
        // The `args` state holds the actual values, initialized from stepData.
        // We only update the list of *which* args are expected/configurable.
      } catch (error) {
        console.error(`Error fetching available args for ${stepType} ${targetName}:`, error);
        toast({ title: 'Fetch Args Error', description: error.message || 'API error.', variant: 'destructive' });
        setAvailableArgs([]); // Clear available args on error
      } finally {
        setIsLoadingArgs(false);
      }
    }, [stepType, targetName, agentName, context.agixt]); // Dependencies: fetch when type, target, or agent changes

    // Effect to trigger fetching available arguments
    useEffect(() => {
      console.log('FETCH AVAILABLE ARGS EFFECT: Triggering fetchAvailableArgs', { stepType, targetName, agentName });
      fetchAvailableArgs();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepType, targetName, agentName]); // Trigger fetch only when these change

    // Saves the current step configuration via API call
    const handleSave = async (): Promise<void> => {
      if (!chain_name || !agentName) {
        toast({ title: 'Error', description: 'Chain name and Agent are required.', variant: 'destructive' });
        return;
      }

      // Prepare the base prompt data object based on UI state
      const promptData: Partial<ChainStepPrompt> = {};
      let validationError = false;

      // Set the correct structural argument based on stepType and validate targetName
      if (stepType === 'Prompt') {
        if (!targetName) validationError = true;
        promptData.prompt_name = targetName;
        promptData.prompt_category = 'Default'; // Assuming Default category
        promptData.command_name = null;
        promptData.chain_name = null;
      } else if (stepType === 'Command') {
        if (!targetName) validationError = true;
        promptData.command_name = targetName;
        promptData.prompt_name = null;
        promptData.prompt_category = null;
        promptData.chain_name = null;
      } else if (stepType === 'Chain') {
        if (!targetName) validationError = true;
        promptData.chain_name = targetName;
        promptData.prompt_name = null;
        promptData.prompt_category = null;
        promptData.command_name = null;
      } else {
        validationError = true; // Should not happen
        toast({ title: 'Error', description: `Invalid step type: ${stepType}.`, variant: 'destructive' });
        return;
      }

      if (validationError) {
        toast({ title: 'Error', description: `A ${stepType} Name must be selected.`, variant: 'destructive' });
        return;
      }

      // Combine structural args with the current user-defined args state
      const finalArgs: ChainStepPrompt = { ...promptData }; // Start with structural args

      // Iterate over the current `args` state (values entered by user or loaded from stepData)
      Object.keys(args).forEach((key) => {
        // Include if it's a known available arg OR a conditional arg, AND NOT a structural arg
        if ((availableArgs.includes(key) || conditionalArgs.includes(key)) && !structuralArgs.includes(key)) {
          const value = args[key];
          // Convert string representations of boolean/number back to actual types for saving
          if (typeof value === 'string') {
            if (value.toLowerCase() === 'true') finalArgs[key] = true;
            else if (value.toLowerCase() === 'false') finalArgs[key] = false;
            else if (value.trim() !== '' && !isNaN(Number(value))) finalArgs[key] = Number(value);
            else finalArgs[key] = value;
          } else {
            finalArgs[key] = value;
          }
        }
      });

      // Clean up conditional args if they aren't relevant to the current stepType
      if (stepType !== 'Prompt' && finalArgs.hasOwnProperty('context')) {
        delete finalArgs['context'];
      }
      if (stepType !== 'Chain' && finalArgs.hasOwnProperty('user_input')) {
        delete finalArgs['user_input'];
      }

      console.log(`Saving Step ${stepData.step} - Type: ${stepType}, Target: ${targetName}, Final Args Payload:`, finalArgs);

      // Make the API call to update the step
      try {
        // Pass targetName explicitly if your SDK method requires it
        await context.agixt.updateStep(chain_name, stepData.step, agentName, stepType, finalArgs, targetName);
        await mutateChain(); // Revalidate the chain data locally
        setModified(false); // Reset modification state
        toast({ title: 'Step Saved', description: `Step ${stepData.step} updated successfully.` });
      } catch (err: any) {
        console.error('Save step error:', err);
        toast({ title: 'Save Error', description: err.message || 'API error occurred.', variant: 'destructive' });
      }
    };

    // Handles the confirmation of step deletion
    const handleDeleteConfirm = async (): Promise<void> => {
      if (!chain_name) {
        toast({ title: 'Error', description: 'Chain name is invalid.', variant: 'destructive' });
        setIsDeleteConfirmOpen(false);
        return;
      }
      try {
        await context.agixt.deleteStep(chain_name, stepData.step);
        await mutateChain(); // Revalidate chain data after deletion
        toast({ title: 'Step Deleted', description: `Step ${stepData.step} deleted.` });
        setIsDeleteConfirmOpen(false);
      } catch (err: any) {
        console.error('Delete step error:', err);
        toast({ title: 'Delete Error', description: err.message || 'API error occurred.', variant: 'destructive' });
        setIsDeleteConfirmOpen(false);
      }
    };

    // Memoize selector components to prevent re-renders unless necessary props change
    const stepTypeComponents = useMemo(
      () => ({
        Prompt: (
          <div>
            <Label htmlFor={`prompt-name-${stepData.step}`} className='text-xs'>
              Prompt Name
            </Label>
            <PromptSelector
              value={targetName} // Controlled component using state
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || ''); // Update targetName state
                  setModified(true);
                  setArgs({}); // Clear args when target changes
                  setAvailableArgs([]); // Clear available args
                }
              }}
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
            />
          </div>
        ),
        Command: (
          <div>
            <Label htmlFor={`command-name-${stepData.step}`} className='text-xs'>
              Command Name
            </Label>
            <CommandSelector
              agentName={agentName}
              value={targetName} // Controlled component using state
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || ''); // Update targetName state
                  setModified(true);
                  setArgs({}); // Clear args when target changes
                  setAvailableArgs([]); // Clear available args
                }
              }}
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
            />
          </div>
        ),
        Chain: (
          <div>
            <Label htmlFor={`chain-name-${stepData.step}`} className='text-xs'>
              Chain Name
            </Label>
            <ChainSelector
              value={targetName} // Controlled component using state
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || ''); // Update targetName state
                  setModified(true);
                  setArgs({}); // Clear args when target changes
                  setAvailableArgs([]); // Clear available args
                }
              }}
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
            />
          </div>
        ),
      }),
      // Recreate selectors only if these specific states/props change
      [agentName, targetName, stepData.step],
    );

    console.log(`RENDER Step ${stepData.step}:`, { stepType, targetName, args, availableArgs, isLoadingArgs }); // Debug Render

    // --- JSX Rendering ---
    return (
      <Card className='w-80 shadow-md nowheel nopan'>
        {/* Handles for connecting nodes in ReactFlow */}
        <Handle type='target' position={Position.Left} style={{ background: '#555' }} isConnectable={isConnectable} />
        <CardHeader className='p-3 bg-muted/50 cursor-default'>
          <CardTitle className='text-sm font-semibold flex justify-between items-center'>
            <span>Step {stepData.step}</span>
            {/* Action Buttons: Move Up/Down, Save, Delete */}
            <div className='flex items-center space-x-1' onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
              <TooltipProvider delayDuration={100}>
                {/* Move Up */}
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
                {/* Move Down */}
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
                {/* Save */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-6 w-6' onClick={handleSave} disabled={!modified}>
                      <Save className={cn('h-3 w-3', !modified && 'text-muted-foreground/50')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{modified ? 'Save Changes' : 'No Changes'}</TooltipContent>
                </Tooltip>
                {/* Delete */}
                <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-6 w-6 text-destructive hover:bg-destructive/10'>
                          <X className='h-4 w-4' />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Delete Step</TooltipContent>
                  </Tooltip>
                  {/* Delete Confirmation Dialog */}
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
        <CardContent className='p-3 space-y-2 text-xs max-h-96 overflow-y-auto relative z-10'>
          {/* Agent Selector */}
          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <Label htmlFor={`agent-name-${stepData.step}`} className='text-xs'>
              Agent
            </Label>
            <Select
              value={agentName} // Controlled by state
              onValueChange={(value) => {
                if (value !== agentName) {
                  setAgentName(value); // Update state
                  setModified(true);
                  if (stepType === 'Command') {
                    setTargetName(''); // Reset command if agent changes
                    setArgs({}); // Clear args
                    setAvailableArgs([]); // Clear available args
                  }
                }
              }}
              disabled={isAgentsLoading || !sortedAgents.length}
            >
              <SelectTrigger id={`agent-name-${stepData.step}`} className='h-8 text-xs nopan'>
                <SelectValue placeholder={isAgentsLoading ? 'Loading Agents...' : 'Select Agent'} />
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

          {/* Step Type Selector */}
          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <Label htmlFor={`step-type-${stepData.step}`} className='text-xs'>
              Type
            </Label>
            <Select
              value={stepType} // Controlled by state
              onValueChange={(value) => {
                if (value !== stepType) {
                  setTargetName(''); // Reset target when type changes
                  setStepType(value); // Update state
                  setAvailableArgs([]); // Clear old available args
                  setArgs({}); // Clear args values
                  setModified(true);
                  // Available args will be re-fetched by the useEffect hook
                }
              }}
            >
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

          {/* Dynamic Target Selector based on Step Type */}
          {/* The correct selector is rendered based on stepType state */}
          {stepType && stepTypeComponents[stepType as keyof typeof stepTypeComponents]}

          {/* Divider before arguments */}
          {/* Show divider if loading or if there are *any* args to display (conditional or available) */}
          {(isLoadingArgs ||
            stepType === 'Prompt' || // Always show section for Prompt (context + available)
            stepType === 'Chain' || // Always show section for Chain (user_input + available)
            (stepType === 'Command' && availableArgs.length > 0)) && ( // Command only if available args exist
            <div className='mt-3 border-t pt-2'>
              <Label className='text-xs font-medium'>Arguments</Label>
            </div>
          )}

          {/* Argument Loading Indicator */}
          {isLoadingArgs && (
            <div className='flex items-center justify-center py-2'>
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
              <span className='ml-2 text-xs'>Loading arguments...</span>
            </div>
          )}

          {/* Argument Fields Container */}
          {!isLoadingArgs && (
            <div className='space-y-2'>
              {/* Context (Only for Prompt type) */}
              {stepType === 'Prompt' && (
                <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                  <Label htmlFor={`arg-${stepData.step}-context`} className='text-xs'>
                    Context
                  </Label>
                  <Textarea
                    id={`arg-${stepData.step}-context`}
                    value={String(args['context'] ?? '')} // Read from args state
                    onChange={(e) => {
                      setArgs((prev) => ({ ...prev, context: e.target.value })); // Update args state
                      setModified(true);
                    }}
                    rows={3}
                    className='w-full text-xs nopan mt-1'
                    placeholder={`Context for prompt (e.g., {STEP1})`}
                  />
                </div>
              )}
              {/* User Input (Only for Chain type) */}
              {stepType === 'Chain' && (
                <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                  <Label htmlFor={`arg-${stepData.step}-user_input`} className='text-xs'>
                    User Input
                  </Label>
                  <Textarea
                    id={`arg-${stepData.step}-user_input`}
                    value={String(args['user_input'] ?? '')} // Read from args state
                    onChange={(e) => {
                      setArgs((prev) => ({ ...prev, user_input: e.target.value })); // Update args state
                      setModified(true);
                    }}
                    rows={3}
                    className='w-full text-xs nopan mt-1'
                    placeholder={`Input for sub-chain (e.g., {STEP1})`}
                  />
                </div>
              )}

              {/* Dynamically Rendered Arguments based on availableArgs */}
              {/* Iterate through the list of *expected* args */}
              {availableArgs.map((name) => {
                if (!name) return null; // Should not happen if fetchArgs filters correctly

                const label = name.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
                const argId = `arg-${stepData.step}-${name}`;
                // Get the value for this arg from the `args` state
                const currentValue = args.hasOwnProperty(name) ? args[name] : '';

                // Determine input type (simplified)
                const isBoolean =
                  typeof currentValue === 'boolean' || ['true', 'false'].includes(String(currentValue).toLowerCase());
                const isNumber = typeof currentValue === 'number';

                // Render Boolean Switch
                if (isBoolean) {
                  const checkedValue = currentValue === true || String(currentValue).toLowerCase() === 'true';
                  return (
                    <div
                      key={name}
                      className='flex items-center space-x-2'
                      onMouseDown={stopPropagation}
                      onTouchStart={stopPropagation}
                    >
                      <Switch
                        id={argId}
                        checked={checkedValue}
                        onCheckedChange={(checked) => {
                          setArgs((prev) => ({ ...prev, [name]: checked })); // Update args state
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

                // Render Number or Text Input
                return (
                  <div key={name} onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                    <Label htmlFor={argId} className='text-xs'>
                      {label}
                    </Label>
                    <Input
                      id={argId}
                      value={String(currentValue ?? '')} // Display value from args state
                      type={isNumber ? 'number' : 'text'}
                      onChange={(e) => {
                        setArgs((prev) => ({ ...prev, [name]: e.target.value })); // Update args state
                        setModified(true);
                      }}
                      className='w-full h-8 text-xs nopan mt-1'
                      placeholder={`Enter ${label}`}
                    />
                  </div>
                );
              })}

              {/* Message when no other arguments are available */}
              {!isLoadingArgs &&
                availableArgs.length === 0 &&
                stepType === 'Command' && // Only show for command if no args fetched
                targetName && ( // And a command is selected
                  <p className='text-xs text-muted-foreground mt-1 italic'>No configurable arguments for this Command.</p>
                )}
              {/* No message needed for Prompt/Chain as context/user_input are always shown */}
            </div>
          )}
        </CardContent>
        {/* Source Handle for connecting nodes */}
        <Handle type='source' position={Position.Right} style={{ background: '#555' }} isConnectable={isConnectable} />
      </Card>
    );
  },
);
ChainStepNode.displayName = 'ChainStepNode'; // For React DevTools

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

  // SWR Hooks for data fetching and caching
  const { data: chainsData, mutate: mutateChains, isLoading: isChainsLoading } = useChains();
  const {
    data: chainData,
    mutate: mutateChain,
    error: chainError,
    isLoading: isChainLoading,
  } = useChain(selectedChainName ?? undefined); // Fetch chain details only if selected
  const { data: agentData } = useAgent(false); // Fetch basic agent data (like name)

  // Callback for handling node changes (e.g., position - though dragging is disabled)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  );
  // Callback for handling edge changes (e.g., selection - though not used here)
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );

  // Callback to move a step up or down
  const moveStep = useCallback(
    async (stepNumber: number, direction: 'up' | 'down') => {
      if (!currentChainName || !chainData?.steps) return; // Guard clauses
      const newStepNumber = direction === 'up' ? stepNumber - 1 : stepNumber + 1;
      // Ensure the new position is valid
      if (newStepNumber < 1 || newStepNumber > chainData.steps.length) return;
      try {
        await context.agixt.moveStep(currentChainName, stepNumber, newStepNumber);
        await mutateChain(); // Revalidate chain data after moving
        toast({ title: 'Step Moved', description: `Step ${stepNumber} moved ${direction}.` });
      } catch (err: any) {
        console.error('Move step err:', err);
        toast({ title: 'Move Error', description: err.message || 'API error.', variant: 'destructive' });
      }
    },
    [currentChainName, chainData?.steps, context.agixt, mutateChain], // Dependencies for the callback
  );

  // Effect to Update ReactFlow Nodes and Edges when chain data changes
  useEffect(() => {
    const shouldRenderNodes = currentChainName && chainData?.steps;
    if (shouldRenderNodes) {
      console.log('FLOW: Rendering nodes for chain:', currentChainName, chainData.steps);
      // Create nodes for each step
      const newNodes: Node[] = chainData.steps.map((step, index) => ({
        id: `step-${step.step}`,
        type: 'chainStep', // Custom node type defined above
        position: { x: index * (NODE_WIDTH + HORIZONTAL_SPACING), y: VERTICAL_POSITION }, // Position horizontally
        data: {
          // Data passed to the ChainStepNode component
          stepData: step, // Pass the *current* step data
          chain_name: currentChainName,
          mutateChain,
          mutateChains,
          isLastStep: index === chainData.steps.length - 1,
          moveStep, // Pass the moveStep callback
        },
        draggable: false, // Disable dragging nodes
        connectable: false, // Disable connecting nodes
        selectable: false, // Disable selecting nodes
        style: { width: NODE_WIDTH }, // Set fixed width for nodes
      }));
      // Create edges between consecutive steps
      const newEdges: Edge[] = chainData.steps.slice(0, -1).map((step) => ({
        id: `e${step.step}-${step.step + 1}`,
        source: `step-${step.step}`, // Source node ID
        target: `step-${step.step + 1}`, // Target node ID
        markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 }, // Arrow marker
        type: 'smoothstep', // Edge type
        style: { strokeWidth: 2 }, // Edge style
      }));
      setNodes(newNodes);
      setEdges(newEdges);
      // Fit the view after updating nodes/edges
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 50);
    } else if (!currentChainName) {
      // If no chain is selected, clear nodes and edges
      setNodes([]);
      setEdges([]);
    } else if (currentChainName && !isChainLoading && !chainError && (!chainData?.steps || chainData.steps.length === 0)) {
      // Handle the case where a chain is selected but has no steps
      setNodes([]);
      setEdges([]);
    }
    // Depend on chainData to trigger re-render when steps change
  }, [currentChainName, chainData, isChainLoading, chainError, mutateChain, mutateChains, reactFlowInstance, moveStep]);

  // Effect to Sync Component State with URL Parameters
  useEffect(() => {
    setCurrentChainName(selectedChainName); // Update local state when URL param changes
    if (renaming && selectedChainName) {
      setNewName(selectedChainName); // Pre-fill rename input if renaming mode is active
    } else if (!selectedChainName) {
      // Reset rename state if no chain is selected
      setRenaming(false);
      setNewName('');
    }
  }, [selectedChainName, renaming]);

  // --- Event Handlers ---

  // Handle selecting a chain from the dropdown
  const handleSelectChain = (value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value && value !== '/') {
      current.set('chain', value); // Set chain parameter
    } else {
      current.delete('chain'); // Remove chain parameter if 'None' is selected
    }
    setRenaming(false); // Exit renaming mode when changing chains
    // Update URL without full page reload
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
  };

  // Handle creating a new chain
  const handleNewChain = async () => {
    const trimmedName = newChainName.trim();
    if (!trimmedName) {
      toast({ title: 'Error', description: 'Chain name cannot be empty.', variant: 'destructive' });
      return;
    }
    // Check for name collisions
    if (chainsData?.some((chain) => chain.chainName === trimmedName)) {
      toast({ title: 'Error', description: `Chain "${trimmedName}" already exists.`, variant: 'destructive' });
      return;
    }
    try {
      await context.agixt.addChain(trimmedName);
      await mutateChains(); // Revalidate the list of chains
      setShowCreateDialog(false);
      setNewChainName('');
      // Navigate to the newly created chain
      router.push(`${pathname}?chain=${encodeURIComponent(trimmedName)}`, { scroll: false });
      toast({ title: 'Chain Created', description: `Created chain "${trimmedName}".` });
    } catch (err: any) {
      console.error('Create chain err:', err);
      toast({ title: 'Create Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handle importing a chain from a JSON file
  const handleChainImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const fileInput = event.target; // Reference to reset input later
    if (!file) return;

    // Use provided name or derive from filename
    const baseName = newChainName.trim() || file.name.replace(/\.json$/i, '');
    if (!baseName) {
      toast({ title: 'Error', description: 'Chain name required for import.', variant: 'destructive' });
      if (fileInput) fileInput.value = ''; // Reset file input
      return;
    }

    // Handle potential name collisions by appending numbers
    let finalChainName = baseName;
    let counter = 1;
    while (chainsData?.some((chain) => chain.chainName === finalChainName)) {
      finalChainName = `${baseName}_${counter++}`;
    }
    if (finalChainName !== baseName) {
      toast({ title: 'Notice', description: `Chain name collision. Importing as "${finalChainName}".` });
    }

    try {
      const fileContent = await file.text();
      const steps = JSON.parse(fileContent); // Parse JSON content

      // Basic validation of the imported steps structure
      if (!Array.isArray(steps)) throw new Error('Imported file is not a valid JSON array of steps.');
      steps.forEach((step: any, i: number) => {
        if (
          !step ||
          typeof step !== 'object' ||
          typeof step.step !== 'number' ||
          !step.agentName ||
          !step.prompt ||
          typeof step.prompt !== 'object'
        )
          throw new Error(`Invalid step structure at index ${i}.`);
      });

      // Add the new chain first, then import steps into it
      await context.agixt.addChain(finalChainName);
      await context.agixt.importChain(finalChainName, steps);
      await mutateChains(); // Revalidate chain list
      setShowCreateDialog(false);
      setNewChainName('');
      if (fileInput) fileInput.value = ''; // Reset file input
      router.push(`${pathname}?chain=${encodeURIComponent(finalChainName)}`, { scroll: false }); // Navigate to imported chain
      toast({ title: 'Chain Imported', description: `Imported chain as "${finalChainName}".` });
    } catch (err: any) {
      console.error('Import chain err:', err);
      toast({ title: 'Import Error', description: err.message || 'API/File error.', variant: 'destructive' });
      // Attempt to clean up if import failed mid-way (e.g., invalid JSON structure after chain creation)
      if (err.message.includes('Invalid') || err instanceof SyntaxError) {
        try {
          await context.agixt.deleteChain(finalChainName); // Try to delete partially created chain
        } catch {} // Ignore errors during cleanup
        await mutateChains(); // Refresh chain list after cleanup attempt
      }
      if (fileInput) fileInput.value = ''; // Reset file input on error
    }
  };

  // Handle deleting the currently selected chain
  const handleDeleteChain = async () => {
    if (!currentChainName) return;
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete the chain "${currentChainName}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await context.agixt.deleteChain(currentChainName);
      await mutateChains(); // Revalidate chain list
      handleSelectChain(null); // Deselect the deleted chain
      toast({ title: 'Chain Deleted', description: `Deleted chain "${currentChainName}".` });
    } catch (err: any) {
      console.error('Delete chain err:', err);
      toast({ title: 'Delete Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handle renaming the currently selected chain
  const handleRenameChain = async () => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || !currentChainName) {
      // If new name is empty or no chain selected, cancel rename
      setRenaming(false);
      setNewName(currentChainName || ''); // Reset input to original name
      return;
    }
    if (trimmedNewName === currentChainName) {
      // If name hasn't changed, just exit rename mode
      setRenaming(false);
      toast({ title: 'Info', description: 'Chain name unchanged.' });
      return;
    }
    // Check for name collision
    if (chainsData?.some((chain) => chain.chainName === trimmedNewName)) {
      toast({ title: 'Error', description: `Chain name "${trimmedNewName}" already exists.`, variant: 'destructive' });
      return;
    }
    try {
      await context.agixt.renameChain(currentChainName, trimmedNewName);
      await mutateChains(); // Revalidate chain list
      setRenaming(false);
      // Update URL to reflect the new name
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('chain', trimmedNewName);
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
      toast({ title: 'Chain Renamed', description: `Renamed to "${trimmedNewName}".` });
    } catch (err: any) {
      console.error('Rename chain err:', err);
      toast({ title: 'Rename Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Handle exporting the current chain steps as JSON
  const handleExportChain = async () => {
    if (!currentChainName || !chainData?.steps || chainData.steps.length === 0) {
      toast({ title: 'Error', description: 'No chain selected or chain is empty.', variant: 'destructive' });
      return;
    }
    try {
      // Create a JSON blob from the steps data
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(chainData.steps, null, 2)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `${currentChainName}.json`; // Filename based on chain name
      document.body.appendChild(element);
      element.click(); // Trigger download
      document.body.removeChild(element); // Clean up the element
      URL.revokeObjectURL(element.href); // Release the object URL
      toast({ title: 'Chain Exported', description: `Exported "${currentChainName}".` });
    } catch (err: any) {
      console.error('Export chain err:', err);
      toast({ title: 'Export Error', description: err.message || 'Download error.', variant: 'destructive' });
    }
  };

  // Handle adding a new step to the current chain
  const handleAddStep = async () => {
    if (!currentChainName || !chainData) {
      toast({ title: 'Error', description: 'Cannot add step, chain data not loaded.', variant: 'destructive' });
      return;
    }
    // Determine the number for the new step
    const lastStep = chainData.steps.length > 0 ? chainData.steps[chainData.steps.length - 1] : null;
    const newStepNumber = (lastStep ? lastStep.step : 0) + 1;
    // Default agent for the new step (use last step's agent or global default)
    const defaultAgent = lastStep ? lastStep.agentName : (agentData?.agent?.name ?? 'AGiXT');
    // Default prompt arguments for a new 'Prompt' type step
    const defaultPromptArgs: Partial<ChainStepPrompt> = {
      prompt_name: 'Think About It', // Default to a known prompt
      prompt_category: 'Default',
      command_name: null,
      chain_name: null,
    };
    try {
      await context.agixt.addStep(
        currentChainName,
        newStepNumber,
        defaultAgent,
        'Prompt', // Default to 'Prompt' type for new steps
        defaultPromptArgs,
      );
      await mutateChain(); // Revalidate chain data
      toast({ title: 'Step Added', description: `Step ${newStepNumber} added.` });
      // Fit view after adding step (allow time for re-render)
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 100);
    } catch (err: any) {
      console.error('Add step err:', err);
      toast({ title: 'Add Step Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  // Define custom node types for ReactFlow
  const nodeTypes = useMemo(() => ({ chainStep: ChainStepNode }), []);

  // --- JSX ---
  return (
    <>
      {/* Chain Selection and Management Card */}
      <Card className='mb-4'>
        <CardContent className='p-4 space-y-4'>
          <Label>Select or Manage Chain</Label>
          <TooltipProvider delayDuration={100}>
            <div className='flex items-center space-x-2'>
              {/* Chain Selector / Rename Input */}
              <div className='flex-1'>
                {renaming && currentChainName ? (
                  // Renaming Mode: Input field + Save/Cancel buttons
                  <div className='flex items-center space-x-2'>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder='Enter new chain name'
                      className='h-9'
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameChain();
                        if (e.key === 'Escape') {
                          // Allow canceling with Escape key
                          setRenaming(false);
                          setNewName(currentChainName || '');
                        }
                      }}
                      autoFocus // Focus input when renaming starts
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant='ghost' size='icon' onClick={handleRenameChain} className='h-9 w-9'>
                          <Check className='h-4 w-4 text-green-600' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save Name (Enter)</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => {
                            // Cancel rename
                            setRenaming(false);
                            setNewName(currentChainName || '');
                          }}
                          className='h-9 w-9 text-muted-foreground'
                        >
                          <X className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Cancel (Esc)</TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  // Default Mode: Chain Selector Dropdown
                  <Select
                    value={currentChainName || ''} // Controlled component
                    onValueChange={handleSelectChain}
                    disabled={isChainsLoading || renaming} // Disable while loading or renaming
                  >
                    <SelectTrigger className='w-full h-9' disabled={isChainsLoading || renaming}>
                      <SelectValue placeholder={isChainsLoading ? 'Loading Chains...' : '- Select Chain -'} />
                    </SelectTrigger>
                    <SelectContent>
                      {isChainsLoading && (
                        <SelectItem value='loading' disabled>
                          Loading...
                        </SelectItem>
                      )}
                      {!isChainsLoading && chainsData && chainsData.length === 0 && (
                        <SelectItem value='no-chains' disabled>
                          No chains exist yet
                        </SelectItem>
                      )}
                      {/* Map through available chains */}
                      {chainsData?.map((chain) => (
                        <SelectItem key={chain.id} value={chain.chainName}>
                          {chain.chainName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {/* Action Buttons (Create, Export, Rename, Delete) */}
              {!renaming && ( // Hide these buttons when renaming
                <>
                  {/* Create/Import Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant='ghost' size='icon' onClick={() => setShowCreateDialog(true)} className='h-9 w-9'>
                        <Plus className='h-4 w-4' />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Create or Import Chain</TooltipContent>
                  </Tooltip>
                  {/* Actions available only when a chain is selected */}
                  {currentChainName && (
                    <>
                      {/* Export Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={handleExportChain}
                            // Disable if chain is loading or has no steps
                            disabled={isChainLoading || !chainData?.steps || chainData.steps.length === 0}
                            className='h-9 w-9'
                          >
                            <Download className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export Chain JSON</TooltipContent>
                      </Tooltip>
                      {/* Rename Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => setRenaming(true)} // Enter renaming mode
                            disabled={isChainLoading}
                            className='h-9 w-9'
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename Chain</TooltipContent>
                      </Tooltip>
                      {/* Delete Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={handleDeleteChain}
                            disabled={isChainLoading}
                            className='h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Chain</TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </>
              )}
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* React Flow Area */}
      <div className='flex-grow w-full min-h-[500px] h-[calc(100vh-280px)] border rounded-md relative overflow-hidden bg-background'>
        {/* Add Step Button (visible only when a chain is selected and not renaming) */}
        {currentChainName && !renaming && (
          <Button
            onClick={handleAddStep}
            variant='outline'
            size='sm'
            className='absolute bottom-4 right-4 z-10 flex items-center shadow-md bg-background hover:bg-muted'
            disabled={isChainLoading || !currentChainName} // Disable if loading or no chain selected
          >
            <Plus className='mr-1 h-4 w-4' /> Add Step
          </Button>
        )}
        {/* Conditional Rendering based on state */}
        {!currentChainName ? (
          // No chain selected
          <div className='flex items-center justify-center h-full text-muted-foreground px-4 text-center'>
            {isChainsLoading
              ? 'Loading chains...'
              : chainsData?.length === 0
                ? 'No chains exist. Use the (+) button to create or import a chain.'
                : 'Select a chain from the dropdown above to view or edit.'}
          </div>
        ) : isChainLoading ? (
          // Chain data is loading
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-20'>
            <Loader2 className='h-6 w-6 animate-spin mr-2' /> Loading chain data...
          </div>
        ) : chainError ? (
          // Error loading chain data
          <div className='p-4 text-center text-destructive'>Error loading chain "{currentChainName}". Please try again.</div>
        ) : nodes.length === 0 && !isChainLoading && !chainError ? (
          // Chain selected, but it's empty
          <div className='flex items-center justify-center h-full text-muted-foreground px-4 text-center'>
            Chain "{currentChainName}" is empty. <br /> Click "Add Step" to begin building the chain.
          </div>
        ) : (
          // Chain data loaded, render ReactFlow
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes} // Use the custom ChainStepNode
            fitView // Automatically fit the view to the nodes
            fitViewOptions={{ padding: 0.2, duration: 300 }} // Options for fitView
            className='bg-background' // Apply background color
            proOptions={{ hideAttribution: true }} // Hide ReactFlow attribution
            minZoom={0.1} // Minimum zoom level
            maxZoom={2} // Maximum zoom level
            nodesDraggable={false} // Disable node dragging
            nodesConnectable={false} // Disable connecting nodes
            elementsSelectable={false} // Disable selecting elements
            panOnDrag={true} // Enable panning by dragging background
            panOnScroll={true} // Enable panning with scroll wheel
            zoomOnScroll={true} // Enable zooming with scroll wheel
            zoomOnPinch={true} // Enable pinch zooming
            zoomOnDoubleClick={true} // Enable double-click zooming
            preventScrolling={false} // Allow page scrolling when interacting with flow
            nodesFocusable={false} // Disable focusing nodes with keyboard
            selectionOnDrag={false} // Disable drag selection
          >
            <Controls className='!bottom-auto !top-4 !left-4' /> {/* Position controls top-left */}
            <Background /> {/* Render background pattern */}
          </ReactFlow>
        )}
      </div>

      {/* Create/Import Chain Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create or Import Chain</DialogTitle>
            <DialogDescription>
              Create a new chain by entering a name, or import an existing chain from a JSON file (name is optional for
              import).
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            {/* Name Input for New/Imported Chain */}
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='chain-name-dialog' className='text-right'>
                Name
              </Label>
              <Input
                id='chain-name-dialog'
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                className='col-span-3'
                placeholder='Required for new chain, optional for import'
              />
            </div>
            {/* File Input for Importing Chain */}
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='import-chain-dialog-hidden' className='text-right'>
                Import File
              </Label>
              <div className='col-span-3'>
                {/* Hidden actual file input */}
                <Input
                  id='import-chain-dialog-hidden'
                  type='file'
                  accept='.json' // Accept only JSON files
                  onChange={handleChainImport}
                  className='hidden'
                  // Ref to reset the input value after import/cancel
                  ref={(input) => input && (input.value = '')}
                />
                {/* Button to trigger the hidden file input */}
                <Button
                  variant='outline'
                  onClick={() => document.getElementById('import-chain-dialog-hidden')?.click()}
                  className='w-full justify-start text-left font-normal text-muted-foreground'
                >
                  <Upload className='mr-2 h-4 w-4' /> Select JSON File...
                </Button>
              </div>
            </div>
            {/* Helper text for import naming */}
            <p className='text-xs text-muted-foreground col-span-4 text-center pt-1'>
              If importing with a name that already exists, a number (e.g., _1, _2) will be appended.
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
            {/* Create New Button */}
            <Button onClick={handleNewChain} disabled={!newChainName.trim()}>
              Create New Chain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Wrapper Component that includes the ReactFlowProvider
export default function ChainPageWrapper() {
  return (
    <SidebarPage title='Chain Management'>
      <ReactFlowProvider>
        {' '}
        {/* Provides context for ReactFlow hooks like useReactFlow */}
        <ChainFlow />
      </ReactFlowProvider>
    </SidebarPage>
  );
}
