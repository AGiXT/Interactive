'use client';
import axios from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LuDownload, LuPencil, LuTrash2, LuPlus } from 'react-icons/lu';
import { useAgent } from '../../hooks/useAgent';
import { AgentDialog } from './AgentDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/components/idiot/auth/hooks/useUser';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

export default function AgentPanel() {
  const [renaming, setRenaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { data: agentData, mutate: mutateAgent } = useAgent();
  const [newName, setNewName] = useState('');
  const [editName, setEditName] = useState('');

  const context = useInteractiveConfig();
  const router = useRouter();
  const pathname = usePathname();
  const { data: companyData, mutate: mutateCompany } = useCompany();

  const handleConfirm = async () => {
    if (renaming) {
      try {
        await context.agixt.renameAgent(agentData?.agent?.name || '', newName);
        setRenaming(false);
        setCookie('agixt-agent', newName, {
          domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        });
        mutateAgent();
      } catch (error) {
        console.error('Failed to rename agent:', error);
      }
    } else if (creating) {
      try {
        const newResponse = await axios.post(
          `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent`,
          { agent_name: newName, settings: { company_id: companyData?.id } },
          {
            headers: {
              Authorization: getCookie('jwt'),
              'Content-Type': 'application/json',
            },
          },
        );
        setCookie('agixt-agent', newName, {
          domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        });

        mutateCompany();
        mutateAgent();
        setCreating(false);
      } catch (error) {
        console.error('Failed to create agent:', error);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await context.agixt.deleteAgent(agentData?.agent?.name || '');
      mutateCompany();
      mutateAgent();
      router.push(pathname);
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleExport = async () => {
    try {
      const agentConfig = await context.agixt.getAgentConfig(agentData?.agent?.name || '');
      const element = document.createElement('a');
      const file = new Blob([JSON.stringify(agentConfig)], { type: 'application/json' });
      element.href = URL.createObjectURL(file);
      element.download = `${agentData?.agent?.name}.json`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error('Failed to export agent:', error);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await context.agixt.renameAgent(agentData?.agent?.name || '', editName);
      setCookie('agixt-agent', editName, {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      });
      mutateAgent();
    } catch (error) {
      console.error('Failed to rename agent:', error);
    }
  };

  return (
    <div className='flex items-center justify-center p-4'>
      <Card className='w-full shadow-lg'>
        <CardHeader className='pb-2'>
          <div className='flex justify-between items-center'>
            <CardTitle className='text-xl font-bold'>{agentData?.agent?.name}</CardTitle>
            {agentData?.agent?.default && (
              <Badge variant='secondary' className='ml-2'>
                Default
              </Badge>
            )}
          </div>
          <p className='text-muted-foreground'>{companyData?.name}</p>
        </CardHeader>

        <CardContent className='space-y-2 pb-2'>
          <div className='grid grid-cols-[auto_1fr] gap-x-2 text-sm'>
            <span className='font-medium text-muted-foreground'>Status:</span>
            <span>{agentData?.agent?.status ? 'Active' : 'Inactive'}</span>

            <span className='font-medium text-muted-foreground'>Agent ID:</span>
            <span className='truncate' title={agentData?.agent?.id}>
              {agentData?.agent?.id}
            </span>

            <span className='font-medium text-muted-foreground'>Company ID:</span>
            <span className='truncate' title={agentData?.agent?.companyId}>
              {agentData?.agent?.companyId}
            </span>
          </div>
        </CardContent>

        <CardFooter className='flex justify-end gap-2 pt-2'>
          <Button variant='outline' size='sm' className='flex items-center' onClick={() => setIsCreateDialogOpen(true)}>
            <LuPlus className='h-4 w-4 mr-1' />
            Create Agent
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant='outline' size='sm' className='flex items-center'>
                <LuPencil className='h-4 w-4 mr-1' />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Agent</DialogTitle>
              </DialogHeader>
              <div className='py-4'>
                <Label htmlFor='name'>Agent Name</Label>
                <Input id='name' value={editName} onChange={(e) => setEditName(e.target.value)} className='mt-1' />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant='outline'>Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={handleSaveEdit}>Save</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant='outline' size='sm' className='flex items-center' onClick={handleExport}>
            <LuDownload className='h-4 w-4 mr-1' />
            Export
          </Button>

          <Button
            variant='destructive'
            size='sm'
            className='flex items-center'
            disabled={agentData?.agent?.default}
            onClick={handleDelete}
          >
            <LuTrash2 className='h-4 w-4 mr-1' />
            Delete
          </Button>
        </CardFooter>
      </Card>
      <AgentDialog open={isCreateDialogOpen} setOpen={setIsCreateDialogOpen} />
    </div>
  );
}
