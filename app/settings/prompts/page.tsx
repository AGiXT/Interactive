'use client';

import { IconButton } from '@/components/layout/themes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Download, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { usePrompt } from '@/components/interactive/usePrompt';
import PromptSelector from '@/components/layout/PromptSelector';
import { Label } from '@/components/ui/label';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { Loader2, Repeat, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import { toast } from '@/components/layout/toast';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { usePrompts } from '@/components/interactive/usePrompt';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { useRef } from 'react';

interface PromptDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  importMode?: boolean;
}

export function PromptDialog({ open, setOpen, importMode = false }: PromptDialogProps) {
  const prompts = usePrompts();
  const [newPromptName, setNewPromptName] = useState('');
  const [promptBody, setPromptBody] = useState('');

  const handleNewPrompt = async () => {
    await prompts.create(newPromptName, promptBody);
    setOpen(false);
  };

  const handleImportPrompt = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 1) {
      toast({
        title: 'Error',
        description: 'You can only import one file at a time',
        duration: 5000,
      });
    } else {
      prompts.import(newPromptName, files[0]);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{importMode ? 'Import Prompt' : 'Create New Prompt'}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='prompt-name' className='text-right'>
              Prompt Name
            </Label>
            <Input
              id='prompt-name'
              value={newPromptName}
              onChange={(e) => setNewPromptName(e.target.value)}
              className='col-span-3'
            />
          </div>
          {importMode ? (
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='import-prompts' className='text-right'>
                Import Prompt
              </Label>
              <Input id='import-prompts' type='file' onChange={handleImportPrompt} className='col-span-3' />
            </div>
          ) : (
            <div className='grid grid-cols-4 items-center gap-4'>
              <Label htmlFor='prompt-content' className='text-right'>
                Prompt Body
              </Label>
              <Textarea
                id='prompt-content'
                value={promptBody}
                onChange={(e) => setPromptBody(e.target.value)}
                className='col-span-3'
                rows={4}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={importMode ? undefined : handleNewPrompt}>
            {importMode ? 'Import Prompt' : 'Create Prompt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromptTest({
  promptName,
  promptContent,
  saved,
}: {
  promptName: string;
  promptContent: string;
  saved: boolean;
}) {
  const [variables, setVariables] = useState({});
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<string[]>([]);
  const [responseIndex, setResponseIndex] = useState(0);

  const preview = useMemo(() => {
    let result = promptContent;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replaceAll(`{${key}}`, value);
    });
    return result;
  }, [promptContent, variables]);

  const sendPrompt = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${getCookie('agixt-agent')}/prompt`,
        {
          prompt_name: promptName,
          prompt_args: variables,
        },
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (response.status === 200) {
        // Changed to match your specified response format
        setResponses((responses) => [...responses, response.data.response]);
      } else {
        throw new Error(response.data.error?.message || 'Unknown error');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process prompt',
        variant: 'destructive',
      });
    }
    setLoading(false);
  }, [promptName, variables]);

  const vars = useMemo(() => {
    return promptContent
      .split('{')
      .map((v) => v.split('}')[0])
      .slice(1);
  }, [promptContent]);

  useEffect(() => {
    setVariables((currentVars) =>
      vars.reduce(
        (acc, v) => ({
          ...acc,
          [v]: Object.keys(currentVars).includes(v) ? currentVars[v] : '',
        }),
        {},
      ),
    );
  }, [vars]);

  return (
    <div>
      <h3>Test Prompt</h3>
      <div className='grid gap-4 grid-cols-3 my-2'>
        {vars.map((v) => (
          <fieldset key={v}>
            <Label htmlFor={v}>{v}</Label>
            <Input id={v} value={variables[v]} onChange={(e) => setVariables({ ...variables, [v]: e.target.value })} />
          </fieldset>
        ))}
      </div>
      <h4>Prompt Preview</h4>
      <MarkdownBlock content={preview} />
      {loading ? (
        <Loader2 className='animate-spin w-4 h-4' />
      ) : (
        <IconButton
          Icon={responses.length > 1 ? Repeat : Send}
          label='Run'
          disabled={!saved}
          onClick={sendPrompt}
          description={Object.keys(variables).length > 0 ? 'Run the prompt with the provided variables.' : 'Run the prompt.'}
        />
      )}

      {responses.length > 0 && (
        <>
          <h4>
            Response {responseIndex + 1}/{responses.length}
          </h4>
          <MarkdownBlock content={responses[responseIndex]} />
        </>
      )}
    </div>
  );
}

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ value, onChange, placeholder }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div tabIndex={-1}>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className='min-h-[200px] resize-none overflow-hidden'
      />
    </div>
  );
};
export default function PromptPanel() {
  const searchParams = useSearchParams();
  const prompt = usePrompt(searchParams.get('prompt') ?? '');
  const [promptBody, setPromptBody] = useState(prompt.data?.content || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [importMode, setImportMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    if (prompt.data?.content) {
      setPromptBody(prompt.data.content);
      setHasChanges(false);
    }
  }, [prompt.data?.content]);

  useEffect(() => {
    if (renaming) {
      setNewName(searchParams.get('prompt') ?? '');
    }
  }, [renaming, searchParams]);

  const documentationContent = (
    // Removed prose class to apply styles manually for more control
    <div className='max-w-none space-y-4 text-sm text-muted-foreground'>
      <p>
        The Prompt Library is a feature that enables users to create, update, and delete customized prompts for their agents.
        By providing a prompt name and content, users can design custom interactions and tasks for the agent to perform. This
        feature allows users to tailor the behavior of the agent and create specialized prompts that cater to specific
        requirements and use cases. Prompts from the prompt library can be used to create automation chains.
      </p>

      <h3 className='text-base font-semibold text-foreground pt-2'>Prompt Formats</h3>
      <p>
        Each prompt has a specific format for providing instructions to the AI agents. Any variables you add to a prompt like{' '}
        {/* Style the variable */}
        <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>
          {'{user_input}'}
        </code>{' '}
        will be formatted with their input variables. For example, if you have a prompt that says{' '}
        {/* Style the variables within the example */}
        <code className='px-1 py-0.5 rounded bg-muted'>
          Do <span className='text-blue-600 dark:text-blue-400 font-medium'>{'{user_input}'}</span>{' '}
          <span className='text-blue-600 dark:text-blue-400 font-medium'>{'{when}'}</span>
        </code>
        , and you provide the input variables <code className='px-1 py-0.5 rounded bg-muted'>user_input=the dishes</code> and{' '}
        <code className='px-1 py-0.5 rounded bg-muted'>when=now</code>, the prompt will be formatted to{' '}
        <code className='px-1 py-0.5 rounded bg-muted'>Do the dishes now</code>.
      </p>

      <h3 className='text-base font-semibold text-foreground pt-2'>Predefined Injection Variables</h3>
      {/* Use a styled list */}
      <ul className='list-disc space-y-1.5 pl-5'>
        <li>
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>
            {'{agent_name}'}
          </code>{' '}
          will cause the agent name to be injected.
        </li>
        <li>
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>
            {'{context}'}
          </code>{' '}
          will cause the current context from memory to be injected. This will only work if you have{' '}
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>
            {'{user_input}'}
          </code>{' '}
          in your prompt arguments for the memory search.
        </li>
        <li>
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>{'{date}'}</code> will
          cause the current date and timestamp to be injected.
        </li>
        <li>
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>
            {'{conversation_history}'}
          </code>{' '}
          will cause the conversation history to be injected.
        </li>
        <li>
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>
            {'{COMMANDS}'}
          </code>{' '}
          will cause the available commands list to be injected and for automatic commands execution from the agent based on
          its suggestions.
        </li>
        <li>
          {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>{'{STEPx}'}</code> will
          cause the step <code className='px-1 py-0.5 rounded bg-muted'>x</code> response from a chain to be injected. For
          example, {/* Style the variable */}
          <code className='px-1 py-0.5 rounded bg-muted text-blue-600 dark:text-blue-400 font-medium'>{'{STEP1}'}</code> will
          inject the first step's response in a chain.
        </li>
      </ul>
    </div>
  );

  return (
    <SidebarPage title='Prompt Library'>
      <div className='container mx-auto p-6 space-y-6'>
        <div className='space-y-6'>
          <Card className='p-6'>
            <h2 className='text-2xl font-bold mb-6'>Prompt Library</h2>
            {documentationContent}
            <br />
            <div className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Select Prompt</label>
                <div className='flex gap-2 items-center'>
                  {renaming ? (
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} className='flex-1' />
                  ) : (
                    <div className='flex-1'>
                      <PromptSelector />
                    </div>
                  )}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={
                      renaming
                        ? () => {
                            prompt.rename(newName);
                            setRenaming(false);
                          }
                        : () => setRenaming(true)
                    }
                  >
                    {renaming ? <Check className='h-4 w-4' /> : <Pencil className='h-4 w-4' />}
                    <span className='ml-2'>{renaming ? 'Save Name' : 'Rename'}</span>
                  </Button>
                </div>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setImportMode(false);
                    setIsDialogOpen(true); // Use isDialogOpen state variable
                  }}
                  disabled={renaming}
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Create
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    setImportMode(true);
                    setIsDialogOpen(true); // Use isDialogOpen state variable
                  }}
                  disabled={renaming}
                >
                  <Upload className='h-4 w-4 mr-2' />
                  Import
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => prompt.export()}
                  disabled={renaming || !prompt.data?.name}
                >
                  <Download className='h-4 w-4 mr-2' />
                  Export
                </Button>
                <Button
                  variant='destructive'
                  size='sm'
                  onClick={() => prompt.delete()}
                  disabled={renaming || !prompt.data?.name}
                >
                  {' '}
                  {/* Consider destructive variant */}
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete
                </Button>
              </div>
            </div>
          </Card>

          {prompt.data?.name ? ( // Check if a prompt is selected using its name or data
            <>
              <Card className='p-6'>
                <label htmlFor='prompt-editor' className='text-sm font-medium mb-2 block'>
                  Edit Prompt Content
                </label>
                <AutoResizeTextarea
                  value={promptBody}
                  onChange={(e) => {
                    setPromptBody(e.target.value);
                    setHasChanges(e.target.value !== prompt.data?.content);
                  }}
                  placeholder='Enter your prompt content here. Use {variable_name} for variables.'
                  id='prompt-editor' // Add id for label association
                />
                <div className='mt-4 flex justify-end'>
                  {' '}
                  {/* Align button */}
                  <Button // Use standard Button instead of IconButton for better text label visibility
                    onClick={() => {
                      prompt.update(promptBody);
                      setHasChanges(false);
                    }}
                    disabled={!hasChanges || renaming}
                    size='sm'
                  >
                    <Save className='h-4 w-4 mr-2' />
                    {hasChanges ? 'Save Changes' : 'Saved'}
                  </Button>
                </div>
              </Card>
              <Card className='p-6'>
                <PromptTest promptName={prompt.data?.name} promptContent={promptBody} saved={!hasChanges} />
              </Card>
            </>
          ) : (
            <Card className='p-6 text-center text-muted-foreground'>
              {' '}
              {/* Wrap message in Card */}
              Select or create a prompt using the controls above to begin editing.
            </Card>
          )}
          {/* Ensure Dialog uses the correct state variable */}
          <PromptDialog open={isDialogOpen} setOpen={setIsDialogOpen} importMode={importMode} />
          {/* Remove the second PromptDialog unless it's for a different purpose */}
          {/* <PromptDialog open={showCreateDialog} setOpen={setShowCreateDialog} /> */}
        </div>
      </div>
    </SidebarPage>
  );
}

// Make sure AutoResizeTextarea has necessary props if used (like id for label)
interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}
