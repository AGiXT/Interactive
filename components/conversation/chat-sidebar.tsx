'use client';

import { Badge, Check, Download, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useContext, useEffect, useState } from 'react';
import { mutate } from 'swr';
import { SidebarContent } from '@/components/layout/SidebarContentManager';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { toast } from '@/components/layout/toast';
import { InteractiveConfigContext } from '@/components/idiot/interactive/InteractiveConfigContext';

const conversationSWRPath = '/conversation/';

export function ChatSidebar({ currentConversation }: { currentConversation: any }): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);

  // Function to handle importing a conversation
  const handleImportConversation = async () => {
    // Create a file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    // Handle file selection
    fileInput.onchange = async (event) => {
      try {
        const file = event.target.files[0];
        if (!file) return;

        // Extract the file name without extension to use as part of the conversation name
        const fileName = file.name.replace(/\.[^/.]+$/, '');

        // Read the file content
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            // Parse the JSON content
            const content = JSON.parse(e.target.result);

            // Use the name from the JSON if available, otherwise use filename
            const baseName = content.name || fileName;
            const timestamp = new Date().toISOString().split('.')[0].replace(/:/g, '-');
            const conversationName = `${baseName}_${timestamp}`;

            // Format the conversation content
            let conversationContent = [];
            if (content.messages && Array.isArray(content.messages)) {
              conversationContent = content.messages.map((msg) => ({
                role: msg.role || 'user',
                message: msg.content || msg.message || '',
                timestamp: msg.timestamp || new Date().toISOString(),
              }));
            } else if (content.conversation_history && Array.isArray(content.conversation_history)) {
              // Alternative format that might be used
              conversationContent = content.conversation_history.map((msg) => ({
                role: msg.role || 'user',
                message: msg.message || msg.content || '',
                timestamp: msg.timestamp || new Date().toISOString(),
              }));
            }

            // Check if there are any messages to import
            if (conversationContent.length === 0) {
              throw new Error('No valid conversation messages found in the imported file');
            }

            // Create the new conversation
            const newConversation = await state.agixt.newConversation(state.agent, conversationName, conversationContent);
            const newConversationID = newConversation.id || '-';
            // Update the conversation list and navigate to the new conversation
            await mutate('/conversations');

            // Set the new conversation as active
            state.mutate((oldState) => ({
              ...oldState,
              overrides: { ...oldState.overrides, conversation: conversationName },
            }));

            // Navigate to the new conversation
            router.push(`/chat/${newConversationID}`);

            toast({
              title: 'Success',
              description: 'Conversation imported successfully',
              duration: 3000,
            });
          } catch (error) {
            console.error('Error processing file:', error);
            toast({
              title: 'Error',
              description: `Failed to process the imported conversation file: ${error.message || 'Unknown error'}`,
              duration: 5000,
              variant: 'destructive',
            });
          }
        };

        reader.readAsText(file);
      } catch (error) {
        console.error('Error importing conversation:', error);
        toast({
          title: 'Error',
          description: 'Failed to import conversation',
          duration: 5000,
          variant: 'destructive',
        });
      }
    };

    // Trigger the file input click
    fileInput.click();
  };
  // Fix for the handleDeleteConversation function
  const handleDeleteConversation = async (): Promise<void> => {
    try {
      await state.agixt.deleteConversation(currentConversation?.id || '-');

      // Properly invalidate both the conversation list and the specific conversation cache
      await mutate('/conversations'); // Assuming this is the key used in useConversations()
      await mutate(conversationSWRPath + state.overrides.conversation);

      // Update the state
      state.mutate((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: '-' },
      }));

      // Navigate to the main chat route
      router.push('/chat');

      toast({
        title: 'Success',
        description: 'Conversation deleted successfully',
        duration: 3000,
      });
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
      await state.agixt.renameConversation(state.agent, currentConversation?.id || '-', newName);

      // Properly invalidate both the conversation list and the specific conversation
      await mutate('/conversations'); // Assuming this is the key used in useConversations()
      await mutate(conversationSWRPath + state.overrides.conversation);

      toast({
        title: 'Success',
        description: 'Conversation renamed successfully',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to rename conversation',
        duration: 5000,
        variant: 'destructive',
      });
    }
  };

  const handleExportConversation = async (): Promise<void> => {
    // Get the full conversation content
    const conversationContent = await state.agixt.getConversation('', currentConversation?.id || '-');

    // Format the conversation for export
    const exportData = {
      name: currentConversation?.name || 'New',
      id: currentConversation?.id || '-',
      created_at: currentConversation?.created_at || new Date().toISOString(),
      messages: conversationContent.map((msg) => ({
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
    element.download = `${currentConversation?.name || 'New'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  const [newName, setNewName] = useState('');
  const router = useRouter();

  useEffect(() => {
    mutate(conversationSWRPath + state.overrides.conversation);
  }, [state.overrides.conversation]);

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        mutate(conversationSWRPath + state.overrides.conversation);
      }, 1000);
    }
  }, [loading, state.overrides.conversation]);

  const [renaming, setRenaming] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (renaming) {
      setNewName(currentConversation?.name || '');
    }
  }, [renaming, currentConversation]);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  return (
    <SidebarContent>
      <SidebarGroup>
        {
          <div className='w-full group-data-[collapsible=icon]:hidden'>
            {renaming ? (
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className='w-full' />
            ) : (
              <h4>{currentConversation?.name}</h4>
            )}
            {currentConversation && currentConversation.attachment_count > 0 && (
              <Badge className='gap-1'>
                <Paperclip className='w-3 h-3' />
                {currentConversation.attachment_count}
              </Badge>
            )}
          </div>
        }
        <SidebarGroupLabel>Conversation Functions</SidebarGroupLabel>
        <SidebarMenu>
          {[
            {
              title: 'New Conversation',
              icon: Plus,
              func: () => {
                router.push('/chat');
              },
              disabled: renaming,
            },
            {
              title: renaming ? 'Save Name' : 'Rename Conversation',
              icon: renaming ? Check : Pencil,
              func: renaming
                ? () => {
                    handleRenameConversation(newName);
                    setRenaming(false);
                  }
                : () => setRenaming(true),
              disabled: false,
            },
            {
              title: 'Import Conversation',
              icon: Upload,
              func: () => {
                handleImportConversation();
              },
              disabled: renaming,
            },
            {
              title: 'Export Conversation',
              icon: Download,
              func: () => handleExportConversation(),
              disabled: renaming,
            },
            {
              title: 'Delete Conversation',
              icon: Trash2,
              func: () => setDeleteDialogOpen(true),
              disabled: renaming,
            },
          ].map(
            (item) =>
              item.visible !== false && (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton side='left' tooltip={item.title} onClick={item.func} disabled={item.disabled}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
          )}
        </SidebarMenu>
      </SidebarGroup>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button className='px-4 py-2 text-sm rounded hover:bg-gray-100' onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </button>
            <button
              className='px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded hover:bg-red-600'
              onClick={() => {
                handleDeleteConversation();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarContent>
  );
}
