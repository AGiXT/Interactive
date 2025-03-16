'use client';

import IconButton from '@/components/idiot/theme/IconButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Download, Pencil, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePrompt } from '../../hooks/usePrompt';
import PromptSelector from '../../Selectors/PromptSelector';
import { AutoResizeTextarea } from '../training';
import NewPromptDialog from './PromptDialog';
import PromptTest from './PromptTest';

export default function PromptPanel() {
  const searchParams = useSearchParams();
  const prompt = usePrompt(searchParams.get('prompt') ?? '');
  const [promptBody, setPromptBody] = useState(prompt.data?.content || '');
  const [hasChanges, setHasChanges] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [importMode, setImportMode] = useState(false);
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
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6">Prompt Management</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Prompt</label>
            <div className="flex gap-2 items-center">
              {renaming ? (
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
              ) : (
                <div className="flex-1">
                  <PromptSelector />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={renaming ? () => {
                  prompt.rename(newName);
                  setRenaming(false);
                } : () => setRenaming(true)}
              >
                {renaming ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                <span className="ml-2">{renaming ? 'Save Name' : 'Rename'}</span>
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportMode(false);
                setIsDialogOpen(true);
              }}
              disabled={renaming}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportMode(true);
                setIsDialogOpen(true);
              }}
              disabled={renaming}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => prompt.export()} disabled={renaming}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => prompt.delete()} disabled={renaming}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Card>
      
      {promptBody ? (
        <>
          <Card className="p-6">
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
              className="mt-4"
            />
          </Card>
          <Card className="p-6">
            <PromptTest promptName={prompt.data?.name} promptContent={promptBody} saved={!hasChanges} />
          </Card>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Select or create a prompt to begin editing
        </div>
      )}
      <NewPromptDialog open={isDialogOpen} setOpen={setIsDialogOpen} importMode={importMode} />
    </div>
  );
}
