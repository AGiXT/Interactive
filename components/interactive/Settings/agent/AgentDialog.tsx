'use client';

import { useState } from 'react';
import { useAgent } from '../../hooks/useAgent';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { useCompany } from '@/components/idiot/auth/hooks/useUser';

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

  const handleAgentImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = Array.from(event.target.files || []);
      for (const file of files) {
        const fileContent = await file.text();
        if (newAgentName === '') {
          const fileName = file.name.replace('.json', '');
          setNewAgentName(fileName);
        }
        const settings = JSON.parse(fileContent);
        await context.agixt.addAgent(newAgentName, settings);
      }
      toast({
        title: 'Success',
        description: `Agent "${newAgentName}" imported successfully`,
      });
      setOpen(false);
    } catch (error) {
      console.error('Failed to import agent:', error);
      toast({
        title: 'Error',
        description: 'Failed to import agent. Please check the file format and try again.',
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
          {/* <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='import-agent' className='text-right'>
              Import an Agent
            </Label>
            <Input id='import-agent' type='file' onChange={handleAgentImport} className='col-span-3' />
          </div> */}
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
