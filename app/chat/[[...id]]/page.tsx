'use client';

import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useEffect, useState, useCallback } from 'react';
import { SidebarPage } from '@/components/layout/SidebarPage';
import React from 'react';
import { Chat } from '@/components/conversation/conversation';
import { Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/layout/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export type FormProps = {
  fieldOverrides?: { [key: string]: ReactNode };
  formContext?: object;
  additionalFields?: { [key: string]: ReactNode };
  additionalOutputButtons: { [key: string]: ReactNode };
  onSubmit?: (data: object) => void;
};
export type UIProps = {
  showSelectorsCSV?: string;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  footerMessage?: string;
  showOverrideSwitchesCSV?: string;
};

export type AGiXTInteractiveProps = {
  overrides?: Overrides;
  uiConfig?: UIProps;
};

const AGiXTInteractive = ({
  overrides = {
    mode: 'prompt',
  },
  uiConfig = {},
}: AGiXTInteractiveProps): React.JSX.Element => {
  const uiConfigWithEnv = React.useMemo(
    () => ({
      showRLHF: process.env.NEXT_PUBLIC_AGIXT_RLHF === 'true',
      footerMessage: process.env.NEXT_PUBLIC_AGIXT_FOOTER_MESSAGE || '',
      showOverrideSwitchesCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_OVERRIDE_SWITCHES || '',
      alternateBackground: 'primary' as 'primary' | 'secondary',
      showSelectorsCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_SELECTION,
      enableVoiceInput: process.env.NEXT_PUBLIC_AGIXT_VOICE_INPUT_ENABLED === 'true',
      enableFileUpload: process.env.NEXT_PUBLIC_AGIXT_FILE_UPLOAD_ENABLED === 'true',
      enableMessageDeletion: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_DELETION === 'true',
      enableMessageEditing: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING === 'true',
      ...uiConfig,
    }),
    [uiConfig],
  );
  return <Chat {...uiConfigWithEnv} {...overrides} />;
};

export function ConvSwitch({ id }: { id: string }) {
  const state = useInteractiveConfig();
  useEffect(() => {
    state?.mutate((oldState) => ({
      ...oldState,
      overrides: { ...oldState.overrides, conversation: id || '-' },
    }));
  }, [id, state]);
  return null;
}

export default function Home({ params }: { params: { id: string[] } }) {
  const router = useRouter();
  const conversationId = params.id?.[0] || '';
  const { data: conversations = [], mutate: mutateConversations } = useConversations();
  
  // State for rename dialog
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  
  // Find the current conversation
  const currentConversation = React.useMemo(() => {
    return conversations.find(conv => conv.id === conversationId);
  }, [conversationId, conversations]);
  
  // Get conversation name (if available and not '-')
  const conversationName = currentConversation?.name !== '-' ? currentConversation?.name : '';
  
  // Open rename dialog
  const handleRenameClick = useCallback(() => {
    setNewName(conversationName || '');
    setIsRenameDialogOpen(true);
  }, [conversationName]);
  
  // Handle rename submission
  const handleRename = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversationId || !newName) return;
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      
      if (!response.ok) throw new Error('Failed to rename conversation');
      
      mutateConversations();
      setIsRenameDialogOpen(false);
      toast({ title: 'Success', description: 'Conversation renamed successfully' });
    } catch (error) {
      console.error('Error renaming conversation:', error);
      toast({ title: 'Error', description: 'Failed to rename conversation', variant: 'destructive' });
    }
  }, [conversationId, newName, mutateConversations]);
  
  // Handle export
  const handleExport = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}/export`);
      if (!response.ok) throw new Error('Failed to export conversation');
      
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${conversationName || 'conversation'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Conversation exported successfully' });
    } catch (error) {
      console.error('Error exporting conversation:', error);
      toast({ title: 'Error', description: 'Failed to export conversation', variant: 'destructive' });
    }
  }, [conversationId, conversationName]);
  
  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!conversationId) return;
    
    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete conversation');
      
      mutateConversations();
      router.push('/chat');
      toast({ title: 'Success', description: 'Conversation deleted successfully' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({ title: 'Error', description: 'Failed to delete conversation', variant: 'destructive' });
    }
  }, [conversationId, mutateConversations, router]);

  return (
    <>
      <SidebarPage 
        title='Chat'
        conversationName={conversationName}
        showControls={!!conversationId}
        onRename={handleRenameClick}
        onExport={handleExport}
        onDelete={handleDelete}
      >
        <ConvSwitch id={conversationId} />
        <AGiXTInteractive
          uiConfig={{
            showChatThemeToggles: false,
            enableVoiceInput: true,
            footerMessage: '',
            alternateBackground: 'primary',
          }}
          overrides={{
            conversation: conversationId,
          }}
        />
      </SidebarPage>
      
      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className='grid gap-4 py-4'>
              <div className='grid gap-2'>
                <Label htmlFor='name'>Name</Label>
                <Input 
                  id='name' 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type='submit'>Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}