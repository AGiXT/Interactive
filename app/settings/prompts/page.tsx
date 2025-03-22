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

  return (
    <SidebarPage title='Prompt Management'>
      <div className='container mx-auto p-6 space-y-6'>
        <div className='space-y-6'>
          <Card className='p-6'>
            <h2 className='text-2xl font-bold mb-6'>Prompt Management</h2>

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
                    setIsDialogOpen(true);
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
                    setIsDialogOpen(true);
                  }}
                  disabled={renaming}
                >
                  <Upload className='h-4 w-4 mr-2' />
                  Import
                </Button>
                <Button variant='outline' size='sm' onClick={() => prompt.export()} disabled={renaming}>
                  <Download className='h-4 w-4 mr-2' />
                  Export
                </Button>
                <Button variant='outline' size='sm' onClick={() => prompt.delete()} disabled={renaming}>
                  <Trash2 className='h-4 w-4 mr-2' />
                  Delete
                </Button>
              </div>
            </div>
          </Card>

          {promptBody ? (
            <>
              <Card className='p-6'>
                <AutoResizeTextarea
                  value={promptBody}
                  onChange={(e) => {
                    setPromptBody(e.target.value);
                    setHasChanges(e.target.value !== prompt.data?.content);
                  }}
                  placeholder=''
                />
                <IconButton
                  Icon={Save}
                  label='Save'
                  description={hasChanges ? 'Save changes to prompt.' : 'No changes to save.'}
                  onClick={() => {
                    prompt.update(promptBody);
                    setHasChanges(false);
                  }}
                  disabled={!hasChanges || renaming}
                  className='mt-4'
                />
              </Card>
              <Card className='p-6'>
                <PromptTest promptName={prompt.data?.name} promptContent={promptBody} saved={!hasChanges} />
              </Card>
            </>
          ) : (
            <div className='text-center py-8 text-muted-foreground'>Select or create a prompt to begin editing</div>
          )}
          <PromptDialog open={isDialogOpen} setOpen={setIsDialogOpen} importMode={importMode} />
        </div>
        <PromptDialog open={showCreateDialog} setOpen={setShowCreateDialog} />
      </div>
    </SidebarPage>
  );
}
