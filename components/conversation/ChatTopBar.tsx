import { useState, useContext } from 'react';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { toast } from '@/components/layout/toast';
import { getCookie } from 'cookies-next';
import { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const conversationSWRPath = '/conversation/';

interface ChatTopBarProps {
  currentConversation: any;
}

export function ChatTopBar({ currentConversation }: ChatTopBarProps) {
  const [loading, setLoading] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const router = useRouter();

  // Debug information
  console.log('ChatTopBar rendered with currentConversation:', currentConversation);

  // Function to handle conversation deletion
  const handleDeleteConversation = async (): Promise<void> => {
    try {
      if (currentConversation?.id) {
        await state?.agixt?.deleteConversation(currentConversation.id);

        // Properly invalidate both the conversation list and the specific conversation cache
        await mutate('/conversations');
        if (state?.overrides?.conversation) {
          await mutate(conversationSWRPath + state.overrides.conversation);
        }

        // Update the state
        if (state?.mutate) {
          state.mutate((oldState: any) => ({
            ...oldState,
            overrides: { ...oldState.overrides, conversation: '-' },
          }));
        }

        // Navigate to the main chat route
        router.push('/chat');

        toast({
          title: 'Success',
          description: 'Conversation deleted successfully',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  const handleRenameConversation = async (newName: string): Promise<void> => {
    try {
      // Make sure newName isn't empty
      if (!newName.trim()) {
        toast({
          title: 'Error',
          description: 'Conversation name cannot be empty',
          duration: 5000,
          variant: 'destructive',
        });
        return;
      }

      if (currentConversation?.id && state?.agixt) {
        await state.agixt.renameConversation(getCookie('agixt-agent') as string || '', currentConversation.id, newName);

        // Properly invalidate both the conversation list and the specific conversation
        await mutate('/conversations');
        if (state?.overrides?.conversation) {
          await mutate(conversationSWRPath + state.overrides.conversation);
        }

        toast({
          title: 'Success',
          description: 'Conversation renamed successfully',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Rename error:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  const handleExportConversation = async (): Promise<void> => {
    try {
      // Get the full conversation content
      if (currentConversation?.id && state?.agixt) {
        const conversationContent = await state.agixt.getConversation('', currentConversation.id);

        // Format the conversation for export
        const exportData = {
          name: currentConversation?.name || 'Conversation',
          id: currentConversation.id,
          created_at: currentConversation?.createdAt || new Date().toISOString(),
          messages: conversationContent.map((msg: any) => ({
            role: msg.role,
            content: msg.message,
            timestamp: msg.timestamp,
          })),
        };

        // Create and trigger download
        const element = document.createElement('a');
        const file = new Blob([JSON.stringify(exportData, null, 2)], {
          type: 'application/json',
        });
        element.href = URL.createObjectURL(file);
        element.download = `${currentConversation?.name || 'Conversation'}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);

        toast({
          title: 'Success',
          description: 'Conversation exported successfully',
          duration: 3000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  const openRenameDialog = () => {
    setNewName(currentConversation?.name || '');
    setRenameDialogOpen(true);
  };

  const isButtonsDisabled = !currentConversation?.id || currentConversation?.id === '-';

  // Debug information
  console.log('ChatTopBar - currentConversation:', currentConversation);
  console.log('ChatTopBar - isButtonsDisabled:', isButtonsDisabled);

  return (
    <>
      <div className='flex items-center gap-2 h-full'>
        <Button
          variant='outline'
          size='sm'
          onClick={openRenameDialog}
          disabled={isButtonsDisabled}
          className='h-8'
        >
          <Pencil className='h-4 w-4 mr-2' />
          Rename
        </Button>

        <Button
          variant='outline'
          size='sm'
          onClick={handleExportConversation}
          disabled={isButtonsDisabled}
          className='h-8'
        >
          <Download className='h-4 w-4 mr-2' />
          Export
        </Button>

        <Button
          variant='outline'
          size='sm'
          onClick={() => setDeleteDialogOpen(true)}
          disabled={isButtonsDisabled}
          className='h-8'
        >
          <Trash2 className='h-4 w-4 mr-2' />
          Delete
        </Button>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>Enter a new name for this conversation.</DialogDescription>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className='w-full'
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameConversation(newName);
                setRenameDialogOpen(false);
              }
            }}
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleRenameConversation(newName);
                setRenameDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                handleDeleteConversation();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
