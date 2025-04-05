'use client';

import React, { useState, useEffect, useMemo, useCallback, useContext, memo, useRef, createContext } from 'react';
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
import {
  Check,
  Download,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
  ArrowDown,
  ArrowUp,
  Loader2,
  SaveAll,
  Info,
} from 'lucide-react';
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
// Ensure Chain type includes 'description' if your hook provides it
import { useChain, useChains, ChainStep as ChainStepType, Chain } from '@/components/interactive/useChain';
import { toast } from '@/components/layout/toast';
import { cn } from '@/lib/utils';
// Removed 'describe' import as it seemed unused and potentially problematic
// import { describe } from 'node:test';

// --- Chain Editor Context ---

interface StepApi {
  handleSave: () => Promise<void>;
  isModified: boolean;
}

interface ChainEditorContextType {
  registerStep: (stepNumber: number, api: StepApi) => void;
  unregisterStep: (stepNumber: number) => void;
  getStepsToSave: () => Array<{ stepNumber: number; saveData: () => Promise<void> }>;
}

const ChainEditorContext = createContext<ChainEditorContextType | null>(null);

const ChainEditorProvider = ({ children }: { children: React.ReactNode }) => {
  const [stepsApi, setStepsApi] = useState<Record<number, StepApi>>({});

  const registerStep = useCallback((stepNumber: number, api: StepApi) => {
    setStepsApi((prev) => ({ ...prev, [stepNumber]: api }));
  }, []);

  const unregisterStep = useCallback((stepNumber: number) => {
    setStepsApi((prev) => {
      const newState = { ...prev };
      delete newState[stepNumber];
      return newState;
    });
  }, []);

  const getStepsToSave = useCallback(() => {
    return Object.entries(stepsApi)
      .filter(([_, api]) => api.isModified)
      .map(([stepNumberStr, api]) => ({
        stepNumber: parseInt(stepNumberStr, 10),
        saveData: api.handleSave,
      }));
  }, [stepsApi]);

  const value = useMemo(
    () => ({
      registerStep,
      unregisterStep,
      getStepsToSave,
    }),
    [registerStep, unregisterStep, getStepsToSave],
  );

  return <ChainEditorContext.Provider value={value}>{children}</ChainEditorContext.Provider>;
};

const useChainEditor = () => {
  const context = useContext(ChainEditorContext);
  if (!context) {
    throw new Error('useChainEditor must be used within a ChainEditorProvider');
  }
  return context;
};

// --- End Chain Editor Context ---

type ChainStepPrompt = {
  prompt_name?: string | null;
  prompt_category?: string | null;
  command_name?: string | null;
  chain_name?: string | null;
  [key: string]: any;
};

// --- Selectors ---
const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
  e.stopPropagation();
};

function CommandSelector({
  agentName,
  value,
  onChange,
  onMouseDown,
  onTouchStart,
  onBlur,
}: {
  agentName: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onBlur?: () => void;
}): React.JSX.Element {
  const { data: agentData, error, isLoading } = useAgent(false, agentName);

  if (isLoading) return <div className='text-xs text-muted-foreground h-8 flex items-center'>Loading Commands...</div>;
  if (error) return <div className='text-xs text-destructive h-8 flex items-center'>Command Load Error</div>;

  const commandsObject = agentData?.commands ?? {};
  const commandKeys = commandsObject && typeof commandsObject === 'object' ? Object.keys(commandsObject) : [];
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
          onBlur={onBlur}
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
  onMouseDown,
  onTouchStart,
  onBlur,
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onBlur?: () => void;
}): React.JSX.Element {
  const { data: chainData, error, isLoading } = useChains();

  if (isLoading) return <div className='text-xs text-muted-foreground h-8 flex items-center'>Loading Chains...</div>;
  if (error) return <div className='text-xs text-destructive h-8 flex items-center'>Chain Load Error</div>;
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
          onBlur={onBlur}
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
// --- End Selectors ---

// --- ReactFlow Custom Node ---

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
const conditionalArgs = ['context', 'user_input'];
const ignoreArgsForGenericRender = [...systemInjectedArgs, ...structuralArgs, ...conditionalArgs];

const extractArgsFromPrompt = (prompt: ChainStepPrompt): Record<string, string | number | boolean> => {
  const extractedArgs: Record<string, string | number | boolean> = {};
  if (prompt) {
    for (const key in prompt) {
      if (!structuralArgs.includes(key) && !systemInjectedArgs.includes(key)) {
        const value = prompt[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          extractedArgs[key] = value;
        } else {
          try {
            extractedArgs[key] = JSON.stringify(value);
          } catch {
            extractedArgs[key] = '';
          }
        }
      }
    }
  }
  return extractedArgs;
};

const ChainStepNode = memo(
  ({
    data,
    isConnectable,
  }: NodeProps<{
    stepData: ChainStepType;
    chain_name: string;
    mutateChain: () => void;
    mutateChains: () => void;
    isLastStep: boolean;
    moveStep: (stepNumber: number, direction: 'up' | 'down') => Promise<void>;
    isAutosaveEnabled: boolean;
  }>) => {
    const { stepData, chain_name, mutateChain, mutateChains, isLastStep, moveStep, isAutosaveEnabled } = data;
    const context = useInteractiveConfig();
    const { registerStep, unregisterStep } = useChainEditor();

    const [agentName, setAgentName] = useState(stepData.agentName);
    const [stepType, setStepType] = useState(stepData.promptType || 'Prompt');
    const [targetName, setTargetName] = useState(stepData.targetName || '');
    const [args, setArgs] = useState<Record<string, string | number | boolean>>({});
    const [availableArgs, setAvailableArgs] = useState<string[]>([]);
    const [modified, setModified] = useState(false);
    const [isLoadingArgs, setIsLoadingArgs] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
      setAgentName(stepData.agentName);
      const newStepType = stepData.promptType || 'Prompt';
      setStepType(newStepType);
      let newTargetName = stepData.targetName || '';
      if (!newTargetName) {
        if (newStepType === 'Chain') newTargetName = stepData.prompt?.chain_name || '';
        else if (newStepType === 'Command') newTargetName = stepData.prompt?.command_name || '';
        else newTargetName = stepData.prompt?.prompt_name || '';
      }
      setTargetName(newTargetName);
      const initialArgs = extractArgsFromPrompt(stepData.prompt);
      setArgs(initialArgs);
      setModified(false);
    }, [stepData]);

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

    const fetchAvailableArgs = useCallback(async () => {
      if (!targetName || !stepType || (stepType === 'Command' && !agentName)) {
        setAvailableArgs([]);
        setIsLoadingArgs(false);
        return;
      }
      setIsLoadingArgs(true);
      try {
        let fetchedArgNames: string[] = [];
        let argsResult: any;
        if (stepType === 'Prompt') {
          try {
            const promptResult = await context.agixt.getPrompt(targetName, 'Default');
            if (promptResult && typeof promptResult.prompt === 'string') {
              const matches = promptResult.prompt.match(/\{([^}]+)\}/g) || [];
              fetchedArgNames = matches.map((match) => match.replace(/[{}]/g, ''));
            }
            if (fetchedArgNames.length === 0) {
              argsResult = await context.agixt.getPromptArgs(targetName, 'Default');
            }
          } catch (err) {
            argsResult = await context.agixt.getPromptArgs(targetName, 'Default');
          }
        } else if (stepType === 'Command') {
          argsResult = await context.agixt.getCommandArgs(targetName);
        } else if (stepType === 'Chain') {
          argsResult = await context.agixt.getChainArgs(targetName);
        }

        if (argsResult) {
          if (Array.isArray(argsResult)) {
            fetchedArgNames = argsResult;
          } else if (argsResult && Array.isArray(argsResult.prompt_args)) {
            fetchedArgNames = argsResult.prompt_args;
          } else if (typeof argsResult === 'object' && argsResult !== null && !Array.isArray(argsResult)) {
            fetchedArgNames = Object.keys(argsResult);
          }
        }

        const filteredFetchedArgs = fetchedArgNames.filter((arg) => !ignoreArgsForGenericRender.includes(arg));
        setAvailableArgs(filteredFetchedArgs);
      } catch (error: any) {
        console.error(`Error fetching available args for ${stepType} ${targetName}:`, error);
        toast({ title: 'Fetch Args Error', description: error.message || 'API error.', variant: 'destructive' });
        setAvailableArgs([]);
      } finally {
        setIsLoadingArgs(false);
      }
    }, [stepType, targetName, agentName, context.agixt]);

    useEffect(() => {
      fetchAvailableArgs();
    }, [fetchAvailableArgs]);

    const handleSave = useCallback(async (): Promise<void> => {
      if (!chain_name || !agentName) {
        toast({ title: 'Error', description: 'Chain name and Agent are required.', variant: 'destructive' });
        return;
      }
      const promptData: Partial<ChainStepPrompt> = {};
      let validationError = false;

      if (stepType === 'Prompt') {
        if (!targetName) validationError = true;
        promptData.prompt_name = targetName;
        promptData.prompt_category = 'Default';
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
        validationError = true;
        toast({ title: 'Error', description: `Invalid step type: ${stepType}.`, variant: 'destructive' });
        return;
      }

      if (validationError) {
        toast({ title: 'Error', description: `A ${stepType} Name must be selected.`, variant: 'destructive' });
        return;
      }

      const finalArgs: ChainStepPrompt = { ...promptData };
      Object.keys(args).forEach((key) => {
        if ((availableArgs.includes(key) || conditionalArgs.includes(key)) && !structuralArgs.includes(key)) {
          const value = args[key];
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

      // Explicitly remove context if not Prompt type
      if (stepType !== 'Prompt' && finalArgs.hasOwnProperty('context')) {
        delete finalArgs['context'];
      }
      // Explicitly remove user_input if not Chain type
      if (stepType !== 'Chain' && finalArgs.hasOwnProperty('user_input')) {
        delete finalArgs['user_input'];
      }

      try {
        await context.agixt.updateStep(chain_name, stepData.step, agentName, stepType, finalArgs, targetName);
        await mutateChain();
        setModified(false);
        toast({ title: 'Step Saved', description: `Step ${stepData.step} updated successfully.` });
      } catch (err: any) {
        console.error('Save step error:', err);
        toast({ title: 'Save Error', description: err.message || 'API error occurred.', variant: 'destructive' });
        throw err;
      }
    }, [
      chain_name,
      stepData.step,
      agentName,
      stepType,
      targetName,
      args,
      availableArgs,
      context.agixt,
      mutateChain,
      setModified,
    ]);

    const handleBlurSave = useCallback(() => {
      if (isAutosaveEnabled && modified) {
        handleSave();
      }
    }, [isAutosaveEnabled, modified, handleSave]);

    useEffect(() => {
      registerStep(stepData.step, { handleSave, isModified: modified });
    }, [registerStep, stepData.step, handleSave, modified]);

    useEffect(() => {
      return () => {
        unregisterStep(stepData.step);
      };
    }, [unregisterStep, stepData.step]);

    const handleDeleteConfirm = async (): Promise<void> => {
      if (!chain_name) {
        toast({ title: 'Error', description: 'Chain name is invalid.', variant: 'destructive' });
        setIsDeleteConfirmOpen(false);
        return;
      }
      try {
        await context.agixt.deleteStep(chain_name, stepData.step);
        await mutateChain();
        toast({ title: 'Step Deleted', description: `Step ${stepData.step} deleted.` });
        setIsDeleteConfirmOpen(false);
      } catch (err: any) {
        console.error('Delete step error:', err);
        toast({ title: 'Delete Error', description: err.message || 'API error occurred.', variant: 'destructive' });
        setIsDeleteConfirmOpen(false);
      }
    };

    const stepTypeComponents = useMemo(
      () => ({
        Prompt: (
          <div>
            <Label htmlFor={`prompt-name-${stepData.step}`} className='text-xs'>
              Prompt Name
            </Label>
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
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
              onBlur={handleBlurSave}
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
              value={targetName}
              onChange={(val) => {
                if (val !== targetName) {
                  setTargetName(val || '');
                  setModified(true);
                  setArgs({});
                  setAvailableArgs([]);
                }
              }}
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
              onBlur={handleBlurSave}
            />
          </div>
        ),
        /* // Chain step type temporarily disabled or under review
        Chain: (
          <div>
            <Label htmlFor={`chain-name-${stepData.step}`} className='text-xs'>
              Chain Name
            </Label>
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
              onMouseDown={stopPropagation}
              onTouchStart={stopPropagation}
              onBlur={handleBlurSave}
            />
          </div>
        ),
        */
      }),
      [agentName, targetName, stepData.step, handleBlurSave],
    );

    return (
      <Card className='w-80 shadow-md nowheel nopan'>
        <Handle type='target' position={Position.Left} style={{ background: '#555' }} isConnectable={isConnectable} />
        <CardHeader className='p-3 bg-muted/50 cursor-default'>
          <CardTitle className='text-sm font-semibold flex justify-between items-center'>
            <span>Step {stepData.step}</span>
            <div className='flex items-center space-x-1' onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
              <TooltipProvider delayDuration={100}>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-6 w-6' onClick={handleSave} disabled={!modified}>
                      <Save className={cn('h-3 w-3', !modified && 'text-muted-foreground/50')} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{modified ? 'Save Changes' : 'No Changes'}</TooltipContent>
                </Tooltip>
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
          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <Label htmlFor={`agent-name-${stepData.step}`} className='text-xs'>
              Agent
            </Label>
            <Select
              value={agentName}
              onValueChange={(value) => {
                if (value !== agentName) {
                  setAgentName(value);
                  setModified(true);
                  if (stepType === 'Command') {
                    setTargetName('');
                    setArgs({});
                    setAvailableArgs([]);
                  }
                  // Apply change immediately if autosave is on
                  if (isAutosaveEnabled) {
                    handleSave();
                  }
                }
              }}
              disabled={isAgentsLoading || !sortedAgents.length}
            >
              <SelectTrigger id={`agent-name-${stepData.step}`} className='h-8 text-xs nopan' onBlur={handleBlurSave}>
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

          <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <Label htmlFor={`step-type-${stepData.step}`} className='text-xs'>
              Type
            </Label>
            <Select
              value={stepType}
              onValueChange={(value) => {
                if (value !== stepType) {
                  setTargetName('');
                  setStepType(value);
                  setAvailableArgs([]);
                  setArgs({});
                  setModified(true);
                  // Apply change immediately if autosave is on
                  // Need to be careful here, as changing type invalidates targetName
                  // Maybe only save if a valid target is selected *after* type change?
                  // For now, let's not autosave on type change itself, wait for target selection or blur.
                }
              }}
            >
              <SelectTrigger id={`step-type-${stepData.step}`} className='h-8 text-xs nopan' onBlur={handleBlurSave}>
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

          {stepType && stepTypeComponents[stepType as keyof typeof stepTypeComponents]}

          {(isLoadingArgs ||
            stepType === 'Prompt' ||
            stepType === 'Chain' ||
            (stepType === 'Command' && availableArgs.length > 0)) && (
            <div className='mt-3 border-t pt-2'>
              <Label className='text-xs font-medium'>Arguments</Label>
            </div>
          )}

          {isLoadingArgs && (
            <div className='flex items-center justify-center py-2'>
              <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
              <span className='ml-2 text-xs'>Loading arguments...</span>
            </div>
          )}

          {!isLoadingArgs && (
            <div className='space-y-2'>
              {stepType === 'Prompt' && (
                <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                  <Label htmlFor={`arg-${stepData.step}-context`} className='text-xs'>
                    Context
                  </Label>
                  <Textarea
                    id={`arg-${stepData.step}-context`}
                    value={String(args['context'] ?? '')}
                    onChange={(e) => {
                      setArgs((prev) => ({ ...prev, context: e.target.value }));
                      setModified(true);
                    }}
                    onBlur={handleBlurSave}
                    rows={3}
                    className='w-full text-xs nopan mt-1'
                    placeholder={`Context for prompt (e.g., {STEP1})`}
                  />
                </div>
              )}
              {/* Chain arguments section might need review/re-enabling if Chain step type is used */}
              {/*
              {stepType === 'Chain' && (
                <div onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                  <Label htmlFor={`arg-${stepData.step}-user_input`} className='text-xs'>
                    User Input
                  </Label>
                  <Textarea
                    id={`arg-${stepData.step}-user_input`}
                    value={String(args['user_input'] ?? '')}
                    onChange={(e) => {
                      setArgs((prev) => ({ ...prev, user_input: e.target.value }));
                      setModified(true);
                    }}
                    onBlur={handleBlurSave}
                    rows={3}
                    className='w-full text-xs nopan mt-1'
                    placeholder={`Input for sub-chain (e.g., {STEP1})`}
                  />
                </div>
              )}
              */}

              {availableArgs.map((name) => {
                if (!name) return null;
                const label = name.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
                const argId = `arg-${stepData.step}-${name}`;
                const currentValue = args.hasOwnProperty(name) ? args[name] : '';
                const isBoolean =
                  typeof currentValue === 'boolean' || ['true', 'false'].includes(String(currentValue).toLowerCase());
                const isNumber = typeof currentValue === 'number';

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
                          setArgs((prev) => ({ ...prev, [name]: checked }));
                          setModified(true);
                          // Autosave immediately for boolean toggles
                          if (isAutosaveEnabled) {
                            handleSave(); // Call handleSave directly for immediate effect
                          }
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
                  <div key={name} onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
                    <Label htmlFor={argId} className='text-xs'>
                      {label}
                    </Label>
                    <Input
                      id={argId}
                      value={String(currentValue ?? '')}
                      type={isNumber ? 'number' : 'text'}
                      onChange={(e) => {
                        setArgs((prev) => ({ ...prev, [name]: e.target.value }));
                        setModified(true);
                      }}
                      onBlur={handleBlurSave}
                      className='w-full h-8 text-xs nopan mt-1'
                      placeholder={`Enter ${label}`}
                    />
                  </div>
                );
              })}

              {!isLoadingArgs && availableArgs.length === 0 && stepType === 'Command' && targetName && (
                <p className='text-xs text-muted-foreground mt-1 italic'>No configurable arguments for this Command.</p>
              )}
              {!isLoadingArgs && availableArgs.length === 0 && stepType === 'Prompt' && targetName && !args['context'] && (
                <p className='text-xs text-muted-foreground mt-1 italic'>
                  No configurable arguments found for this Prompt (excluding context).
                </p>
              )}
              {/* Add similar message for Chain if needed */}
            </div>
          )}
        </CardContent>
        <Handle type='source' position={Position.Right} style={{ background: '#555' }} isConnectable={isConnectable} />
      </Card>
    );
  },
);
ChainStepNode.displayName = 'ChainStepNode';
// --- End ChainStepNode ---

// --- Main Flow Component ---
const NODE_WIDTH = 320;
const HORIZONTAL_SPACING = 60;
const VERTICAL_POSITION = 50;

function ChainFlow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newChainName, setNewChainName] = useState('');
  const [newChainDescription, setNewChainDescription] = useState(''); // **NEW STATE for description in dialog**
  const [renaming, setRenaming] = useState(false);
  const [currentChainName, setCurrentChainName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  const [chainDescription, setChainDescription] = useState<string | null | undefined>(null);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSavingDescription, setIsSavingDescription] = useState(false);

  const reactFlowInstance = useReactFlow<any, any>();
  const context = useInteractiveConfig();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedChainName = searchParams.get('chain');
  const { getStepsToSave } = useChainEditor();

  const { data: chainsData, mutate: mutateChains, isLoading: isChainsLoading } = useChains();
  const {
    data: chainData,
    mutate: mutateChain,
    error: chainError,
    isLoading: isChainLoading,
  } = useChain(selectedChainName ?? undefined);
  const { data: agentData } = useAgent(false);

  useEffect(() => {
    const savedPreference = localStorage.getItem('chainEditorAutosave');
    setIsAutosaveEnabled(savedPreference === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('chainEditorAutosave', String(isAutosaveEnabled));
  }, [isAutosaveEnabled]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges],
  );

  const moveStep = useCallback(
    async (stepNumber: number, direction: 'up' | 'down') => {
      if (!currentChainName || !chainData?.steps) return;
      const newStepNumber = direction === 'up' ? stepNumber - 1 : stepNumber + 1;
      if (newStepNumber < 1 || newStepNumber > chainData.steps.length) return;
      try {
        await context.agixt.moveStep(currentChainName, stepNumber, newStepNumber);
        await mutateChain();
        toast({ title: 'Step Moved', description: `Step ${stepNumber} moved ${direction}.` });
      } catch (err: any) {
        console.error('Move step err:', err);
        toast({ title: 'Move Error', description: err.message || 'API error.', variant: 'destructive' });
      }
    },
    [currentChainName, chainData?.steps, context.agixt, mutateChain],
  );

  useEffect(() => {
    const shouldRenderNodes = currentChainName && chainData?.steps;
    if (shouldRenderNodes) {
      const newNodes: Node[] = chainData.steps.map((step, index) => ({
        id: `step-${step.step}`,
        type: 'chainStep',
        position: { x: index * (NODE_WIDTH + HORIZONTAL_SPACING), y: VERTICAL_POSITION },
        data: {
          stepData: step,
          chain_name: currentChainName,
          mutateChain,
          mutateChains,
          isLastStep: index === chainData.steps.length - 1,
          moveStep,
          isAutosaveEnabled,
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
    } else if (!currentChainName) {
      setNodes([]);
      setEdges([]);
    } else if (currentChainName && !isChainLoading && !chainError && (!chainData?.steps || chainData.steps.length === 0)) {
      setNodes([]);
      setEdges([]);
    }
  }, [
    currentChainName,
    chainData?.steps, // More specific dependency
    isChainLoading,
    chainError,
    mutateChain,
    mutateChains,
    reactFlowInstance,
    moveStep,
    isAutosaveEnabled,
  ]);

  useEffect(() => {
    const previousChainName = currentChainName; // Capture previous name before update
    setCurrentChainName(selectedChainName);
    if (selectedChainName) {
      if (renaming) {
        setNewName(selectedChainName);
      }
      // Update description state only if the chain *name* has actually changed or if description was null/undefined
      if (selectedChainName !== previousChainName || chainDescription === null || chainDescription === undefined) {
        setChainDescription(chainData?.description);
      }
      // Exit description edit mode if the chain changes
      if (selectedChainName !== previousChainName) {
        setIsEditingDescription(false);
        setEditedDescription('');
      }
    } else {
      setRenaming(false);
      setNewName('');
      setChainDescription(null);
      setIsEditingDescription(false);
      setEditedDescription('');
    }
  }, [selectedChainName, renaming, chainData]); // Removed currentChainName from deps here

  // --- Event Handlers ---

  const handleSaveAll = async () => {
    const stepsToSave = getStepsToSave();
    if (stepsToSave.length === 0) {
      toast({ title: 'No Changes', description: 'There are no unsaved changes.' });
      return;
    }
    setIsSavingAll(true);
    const stepNumbers = stepsToSave.map((s) => s.stepNumber).join(', ');
    toast({ title: 'Saving All', description: `Saving changes in step(s): ${stepNumbers}...` });
    const savePromises = stepsToSave.map((step) => step.saveData());
    const results = await Promise.allSettled(savePromises);
    const failedSteps = results
      .map((result, index) => (result.status === 'rejected' ? stepsToSave[index].stepNumber : null))
      .filter((stepNumber) => stepNumber !== null);
    if (failedSteps.length > 0) {
      toast({
        title: 'Save All Failed',
        description: `Could not save changes for step(s): ${failedSteps.join(', ')}. Please check errors and try again.`,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Save All Complete', description: `Changes saved successfully for all modified steps.` });
    }
    setIsSavingAll(false);
  };

  const handleSelectChain = (value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value && value !== '/') {
      current.set('chain', value);
    } else {
      current.delete('chain');
    }
    setRenaming(false);
    setIsEditingDescription(false);
    router.replace(`${pathname}?${current.toString()}`, { scroll: false });
  };

  // Handle creating a new chain
  const handleNewChain = async () => {
    const trimmedName = newChainName.trim();
    const trimmedDescription = newChainDescription.trim(); // **Get trimmed description**
    if (!trimmedName) {
      toast({ title: 'Error', description: 'Chain name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (chainsData?.some((chain) => chain.chainName === trimmedName)) {
      toast({ title: 'Error', description: `Chain "${trimmedName}" already exists.`, variant: 'destructive' });
      return;
    }
    try {
      // **Pass description to addChain**
      await context.agixt.addChain(trimmedName, trimmedDescription);
      await mutateChains();
      setShowCreateDialog(false);
      setNewChainName('');
      setNewChainDescription(''); // **Reset description state**
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
    const fileInput = event.target;
    if (!file) return;

    const baseName = newChainName.trim() || file.name.replace(/\.json$/i, '');
    const providedDescription = newChainDescription.trim(); // **Get description from dialog**

    if (!baseName) {
      toast({
        title: 'Error',
        description: 'Chain name required for import (can be derived from filename).',
        variant: 'destructive',
      });
      if (fileInput) fileInput.value = '';
      return;
    }

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
      const steps = JSON.parse(fileContent);
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

      // **Add chain with name AND description before importing steps**
      await context.agixt.addChain(finalChainName, providedDescription);
      await context.agixt.importChain(finalChainName, steps);
      await mutateChains();
      setShowCreateDialog(false);
      setNewChainName('');
      setNewChainDescription(''); // **Reset description state**
      if (fileInput) fileInput.value = '';
      router.push(`${pathname}?chain=${encodeURIComponent(finalChainName)}`, { scroll: false });
      toast({ title: 'Chain Imported', description: `Imported chain as "${finalChainName}".` });
    } catch (err: any) {
      console.error('Import chain err:', err);
      toast({ title: 'Import Error', description: err.message || 'API/File error.', variant: 'destructive' });
      // Attempt cleanup if import failed after chain creation
      if (err.message.includes('Invalid') || err instanceof SyntaxError || err.message.includes('API/File error')) {
        try {
          // Check if chain actually exists before trying to delete
          const chains = await context.agixt.getChains();
          if (chains.some((c: Chain) => c.chainName === finalChainName)) {
            await context.agixt.deleteChain(finalChainName);
          }
        } catch (cleanupError) {
          console.error('Error during import cleanup:', cleanupError);
        }
        await mutateChains(); // Re-fetch chains list after potential deletion
      }
      if (fileInput) fileInput.value = ''; // Reset file input regardless
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
      handleSelectChain(null);
      toast({ title: 'Chain Deleted', description: `Deleted chain "${currentChainName}".` });
    } catch (err: any) {
      console.error('Delete chain err:', err);
      toast({ title: 'Delete Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleRenameChain = async () => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName || !currentChainName) {
      setRenaming(false);
      setNewName(currentChainName || '');
      return;
    }
    if (trimmedNewName === currentChainName) {
      setRenaming(false);
      toast({ title: 'Info', description: 'Chain name unchanged.' });
      return;
    }
    if (chainsData?.some((chain) => chain.chainName === trimmedNewName)) {
      toast({ title: 'Error', description: `Chain name "${trimmedNewName}" already exists.`, variant: 'destructive' });
      return;
    }
    try {
      // Rename function might not support description update, only name change
      await context.agixt.renameChain(currentChainName, trimmedNewName);
      await mutateChains();
      setRenaming(false);
      const current = new URLSearchParams(Array.from(searchParams.entries()));
      current.set('chain', trimmedNewName);
      router.replace(`${pathname}?${current.toString()}`, { scroll: false });
      // Need to refetch the specific chain data to get its potentially existing description after rename
      await mutateChain(undefined, {
        // Trigger refetch for the *new* name
        optimisticData: (currentData) => ({ ...currentData, chainName: trimmedNewName }), // Optimistic update
        revalidate: true,
      });
      toast({ title: 'Chain Renamed', description: `Renamed to "${trimmedNewName}".` });
    } catch (err: any) {
      console.error('Rename chain err:', err);
      toast({ title: 'Rename Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleExportChain = async () => {
    if (!currentChainName || !chainData?.steps || chainData.steps.length === 0) {
      toast({ title: 'Error', description: 'No chain selected or chain is empty.', variant: 'destructive' });
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
      URL.revokeObjectURL(element.href);
      toast({ title: 'Chain Exported', description: `Exported "${currentChainName}".` });
    } catch (err: any) {
      console.error('Export chain err:', err);
      toast({ title: 'Export Error', description: err.message || 'Download error.', variant: 'destructive' });
    }
  };

  const handleAddStep = async () => {
    if (!currentChainName) {
      toast({ title: 'Error', description: 'No chain selected to add a step to.', variant: 'destructive' });
      return;
    }

    // Save pending changes before adding if autosave is off
    if (!isAutosaveEnabled) {
      const stepsToSave = getStepsToSave();
      if (stepsToSave.length > 0) {
        const stepNumbers = stepsToSave.map((s) => s.stepNumber).join(', ');
        toast({ title: 'Saving pending changes', description: `Saving step(s): ${stepNumbers}...` });
        setIsSavingAll(true); // Use saving all indicator
        const savePromises = stepsToSave.map((step) => step.saveData());
        try {
          await Promise.all(savePromises);
          toast({ title: 'Pending Saved', description: 'Pending changes saved.' });
        } catch (error) {
          toast({
            title: 'Save Failed Before Add',
            description: 'Could not save pending changes. Please save manually and try again.',
            variant: 'destructive',
          });
          setIsSavingAll(false);
          return; // Stop adding step if save failed
        } finally {
          setIsSavingAll(false);
        }
      }
    }

    // Refetch chain data *just before* adding the step to ensure we have the latest step count
    await mutateChain(); // Revalidate the current chain's data
    // Access the potentially updated chainData from SWR's cache after revalidation
    const currentChainState = reactFlowInstance.getNodes().length > 0 ? chainData : null; // Use node count or SWR cache
    const currentSteps = currentChainState?.steps || [];

    const lastStep = currentSteps.length > 0 ? currentSteps[currentSteps.length - 1] : null;
    const newStepNumber = (lastStep ? lastStep.step : 0) + 1;
    const defaultAgent = lastStep ? lastStep.agentName : (agentData?.agent?.name ?? 'AGiXT');
    const defaultPromptArgs: Partial<ChainStepPrompt> = {
      prompt_name: 'Think About It',
      prompt_category: 'Default',
      command_name: null,
      chain_name: null,
    };

    try {
      await context.agixt.addStep(currentChainName, newStepNumber, defaultAgent, 'Prompt', defaultPromptArgs);
      await mutateChain(); // Revalidate again after adding
      toast({ title: 'Step Added', description: `Step ${newStepNumber} added.` });
      setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 300 }), 100);
    } catch (err: any) {
      console.error('Add step err:', err);
      toast({ title: 'Add Step Error', description: err.message || 'API error.', variant: 'destructive' });
    }
  };

  const handleSaveDescription = async () => {
    // Use setChainDescription API if available, otherwise fallback or show error
    if (!currentChainName || !context.agixt.setChainDescription) {
      toast({
        title: 'Error',
        description: 'Functionality to save description is not available in the current SDK context.',
        variant: 'destructive',
      });
      setIsEditingDescription(false); // Exit edit mode anyway
      return;
    }

    setIsSavingDescription(true);

    try {
      // Use the specific API endpoint if it exists
      await context.agixt.setChainDescription(currentChainName, editedDescription.trim());

      // Manually update the local SWR cache for description for immediate feedback
      mutateChain(
        (currentData) => {
          if (!currentData) return undefined;
          return { ...currentData, description: editedDescription.trim() };
        },
        { revalidate: false }, // Don't refetch immediately, assume success
      );
      // Update local state as well
      setChainDescription(editedDescription.trim());

      setIsEditingDescription(false);
      toast({ title: 'Description Saved', description: 'Chain description updated successfully.' });
    } catch (err: any) {
      console.error('Save description error:', err);
      toast({ title: 'Save Error', description: err.message || 'Failed to save description.', variant: 'destructive' });
      // Optionally revalidate on error to get the server state back
      mutateChain();
    } finally {
      setIsSavingDescription(false);
    }
  };

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
              <div className='flex-1'>
                {renaming && currentChainName ? (
                  <div className='flex items-center space-x-2'>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder='Enter new chain name'
                      className='h-9'
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameChain();
                        if (e.key === 'Escape') {
                          setRenaming(false);
                          setNewName(currentChainName || '');
                        }
                      }}
                      autoFocus
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
                  <Select
                    value={currentChainName || ''}
                    onValueChange={handleSelectChain}
                    disabled={isChainsLoading || renaming}
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
                      {chainsData
                        ?.sort((a, b) => a.chainName.localeCompare(b.chainName))
                        .map(
                          (
                            chain, // Sort alphabetically
                          ) => (
                            <SelectItem key={chain.id} value={chain.chainName}>
                              {chain.chainName}
                            </SelectItem>
                          ),
                        )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {!renaming && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant='ghost' size='icon' onClick={() => setShowCreateDialog(true)} className='h-9 w-9'>
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
                            disabled={isChainLoading || !chainData?.steps || chainData.steps.length === 0}
                            className='h-9 w-9'
                          >
                            <Download className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export Chain JSON</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            onClick={() => {
                              setRenaming(true);
                              setNewName(currentChainName); // Pre-fill rename input
                            }}
                            disabled={isChainLoading}
                            className='h-9 w-9'
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename Chain</TooltipContent>
                      </Tooltip>
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

          {/* Chain Description Section */}
          {currentChainName && !isChainLoading && !renaming && (
            <div className='mt-3 pt-3 border-t'>
              {isEditingDescription ? (
                <div className='space-y-2'>
                  <Label htmlFor='chain-description-edit'>Edit Description</Label>
                  <Textarea
                    id='chain-description-edit'
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    placeholder='Enter a description for this chain...'
                    rows={3}
                    className='text-sm'
                    disabled={isSavingDescription}
                  />
                  <div className='flex justify-end space-x-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => {
                        setIsEditingDescription(false);
                        setEditedDescription(chainDescription || '');
                      }}
                      disabled={isSavingDescription}
                    >
                      Cancel
                    </Button>
                    <Button
                      size='sm'
                      onClick={handleSaveDescription}
                      disabled={isSavingDescription || editedDescription === (chainDescription || '')}
                    >
                      {isSavingDescription ? (
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      ) : (
                        <Check className='mr-2 h-4 w-4' />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className='space-y-1'>
                  <div className='flex justify-between items-start'>
                    <Label>Description</Label>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-6 w-6 -mt-1'
                            onClick={() => {
                              setIsEditingDescription(true);
                              setEditedDescription(chainDescription || '');
                            }}
                          >
                            <Pencil className='h-3 w-3' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Description</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className='text-sm text-muted-foreground whitespace-pre-wrap break-words min-h-[20px]'>
                    {chainDescription ? (
                      chainDescription
                    ) : (
                      <span className='italic'>
                        No description provided. Click <Pencil className='inline h-3 w-3 mx-1' /> to add one.
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
          {currentChainName && isChainLoading && !renaming && (
            <div className='mt-3 pt-3 border-t text-sm text-muted-foreground min-h-[44px] flex items-center'>
              <Loader2 className='h-4 w-4 animate-spin mr-2' /> Loading description...
            </div>
          )}
        </CardContent>
      </Card>

      {/* React Flow Area */}
      <div className='flex-grow w-full min-h-[500px] h-[calc(100vh-380px)] border rounded-md relative overflow-hidden bg-background'>
        {' '}
        {/* Adjusted height slightly */}
        {currentChainName && !renaming && (
          <div className='absolute bottom-4 right-4 z-10 flex items-center space-x-2'>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleSaveAll}
                    variant='outline'
                    size='sm'
                    className='flex items-center shadow-md bg-background hover:bg-muted'
                    disabled={isSavingAll || getStepsToSave().length === 0}
                  >
                    {isSavingAll ? <Loader2 className='mr-1 h-4 w-4 animate-spin' /> : <SaveAll className='mr-1 h-4 w-4' />}
                    Save All ({getStepsToSave().length}) {/* Show count */}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save all modified steps</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className='flex items-center space-x-2 p-2 rounded-md shadow-md border bg-background hover:bg-muted'>
                    <Label htmlFor='autosave-toggle' className='text-sm cursor-pointer'>
                      Autosave
                    </Label>
                    <Switch
                      id='autosave-toggle'
                      checked={isAutosaveEnabled}
                      onCheckedChange={setIsAutosaveEnabled}
                      className='h-4 w-7 [&>span]:h-3 [&>span]:w-3'
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Automatically save step changes on blur/toggle</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleAddStep}
                    variant='outline'
                    size='sm'
                    className='flex items-center shadow-md bg-background hover:bg-muted'
                    disabled={!currentChainName || isChainLoading} // Disable if loading
                  >
                    <Plus className='mr-1 h-4 w-4' /> Add Step
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add a new step to the end of the chain</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {!currentChainName ? (
          <div className='flex items-center justify-center h-full text-muted-foreground px-4 text-center'>
            {isChainsLoading
              ? 'Loading chains...'
              : chainsData?.length === 0
                ? 'No chains exist. Use the (+) button to create or import a chain.'
                : 'Select a chain from the dropdown above to view or edit.'}
          </div>
        ) : isChainLoading ? (
          <div className='absolute inset-0 flex items-center justify-center bg-background/50 z-20'>
            <Loader2 className='h-6 w-6 animate-spin mr-2' /> Loading chain data...
          </div>
        ) : chainError ? (
          <div className='p-4 text-center text-destructive'>Error loading chain "{currentChainName}". Please try again.</div>
        ) : nodes.length === 0 && !isChainLoading && !chainError ? (
          <div className='flex items-center justify-center h-full text-muted-foreground px-4 text-center'>
            Chain "{currentChainName}" is empty. <br /> Click "Add Step" to begin building the chain.
          </div>
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
            panOnDrag={true}
            panOnScroll={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={true}
            preventScrolling={false}
            nodesFocusable={false}
            selectionOnDrag={false}
          >
            <Controls className='!bottom-auto !top-4 !left-4' />
            <Background />
          </ReactFlow>
        )}
      </div>

      {/* Create/Import Chain Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className='sm:max-w-[480px]'>
          {' '}
          {/* Optional: Adjust max width if needed */}
          <DialogHeader>
            <DialogTitle>Create or Import Chain</DialogTitle>
            <DialogDescription>
              Create a new chain by entering a name and optional description, or import an existing chain from a JSON file.
            </DialogDescription>
          </DialogHeader>
          {/* Use space-y for vertical stacking of elements */}
          <div className='space-y-4 py-4'>
            {/* Name Input Section */}
            <div>
              <Label htmlFor='chain-name-dialog' className='block mb-1.5 text-sm font-medium'>
                {' '}
                {/* Use block and margin */}
                Name*
              </Label>
              <Input
                id='chain-name-dialog'
                value={newChainName}
                onChange={(e) => setNewChainName(e.target.value)}
                placeholder='Required for new, optional for import'
                className='w-full' // Ensure input takes full width
              />
            </div>

            {/* Description Input Section */}
            <div>
              <Label htmlFor='chain-description-dialog' className='block mb-1.5 text-sm font-medium'>
                {' '}
                {/* Use block and margin */}
                Description
              </Label>
              <Textarea
                id='chain-description-dialog'
                value={newChainDescription}
                onChange={(e) => setNewChainDescription(e.target.value)}
                placeholder='Optional description for the chain'
                rows={3}
                className='w-full' // Ensure textarea takes full width
              />
            </div>

            {/* Import File Input Section */}
            <div>
              <Label htmlFor='import-chain-dialog-hidden' className='block mb-1.5 text-sm font-medium'>
                {' '}
                {/* Use block and margin */}
                Import File
              </Label>
              {/* Hidden actual file input */}
              <Input
                id='import-chain-dialog-hidden'
                type='file'
                accept='.json'
                onChange={handleChainImport}
                className='hidden'
                ref={(input) => input && (input.value = '')} // Clear value on render
              />
              {/* Visible button to trigger the file input */}
              <Button
                variant='outline'
                onClick={() => document.getElementById('import-chain-dialog-hidden')?.click()}
                className='w-full justify-start text-left font-normal text-muted-foreground' // Full width, left aligned text
              >
                <Upload className='mr-2 h-4 w-4' /> Select JSON File...
              </Button>
            </div>

            {/* Help Text */}
            <p className='text-xs text-muted-foreground text-center pt-1'>
              *Name is required to create a new chain. If importing, name can be derived from filename if left blank.
              Importing with an existing name appends a number (_1, _2).
            </p>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => {
                setShowCreateDialog(false);
                setNewChainName('');
                setNewChainDescription(''); // Reset description on cancel
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleNewChain} disabled={!newChainName.trim()}>
              <Plus className='mr-2 h-4 w-4' /> Create New Chain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Wrapper Component
export default function ChainPageWrapper() {
  return (
    <SidebarPage title='Chain Management'>
      <ReactFlowProvider>
        <ChainEditorProvider>
          <ChainFlow />
        </ChainEditorProvider>
      </ReactFlowProvider>
    </SidebarPage>
  );
}
