'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AgentDialog({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const router = useRouter();
  const context = useInteractiveConfig();
  const [newAgentName, setNewAgentName] = useState('');

  const handleNewAgent = async () => {
    await context.agixt.addAgent(newAgentName);
    setOpen(false);
    router.push(`/agent?agent=${newAgentName}`);
  };

  const handleAgentImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      const fileContent = await file.text();
      if (newAgentName === '') {
        const fileName = file.name.replace('.json', '');
        setNewAgentName(fileName);
      }
      const settings = JSON.parse(fileContent);
      await context.agixt.addAgent(newAgentName, settings);
      router.push(`/agent?agent=${newAgentName}`);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Agent</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 py-4'>
          <div className='grid grid-cols-4 items-center gap-4'>
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
          <div className='grid grid-cols-4 items-center gap-4'>
            <Label htmlFor='import-agent' className='text-right'>
              Import an Agent
            </Label>
            <Input id='import-agent' type='file' onChange={handleAgentImport} className='col-span-3' />
          </div>
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
