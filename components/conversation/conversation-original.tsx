'use client';

import { useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { mutate } from 'swr';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Paperclip, Pencil, Plus, Check, Download, Trash2 } from 'lucide-react';

import { useConversationWebSocket } from '@/hooks/useConversationWebSocket';

import { InteractiveConfigContext, Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useCompany } from '@/components/interactive/useUser';
import { useConversations } from '@/components/interactive/useConversation';
import { toast } from '@/components/layout/toast';

import { Activity as ChatActivity } from '@/components/conversation/activity';
import Message from '@/components/conversation/Message/Message';
import { SidebarContent } from '@/components/layout/SidebarContentManager';
import { ChatBar } from '@/components/conversation/input/chat-input-fixed';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export type UIProps = {
  showSelectorsCSV?: string;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  footerMessage?: string;
  showOverrideSwitchesCSV?: string;
};

const conversationSWRPath = '/conversation/';

export function ChatSidebar({ currentConversation }: { currentConversation: any }): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const interactiveConfig = useContext(InteractiveConfigContext);
  const router = useRouter();
  const { open, setOpen } = useSidebar('right');

  // Track state for rename operation
  const [wasExpanded, setWasExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Function to handle conversation deletion
  const handleDeleteConversation = async (): Promise<void> => {
    try {
      setLoading(true);
      const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || 'AGiXT';
      await interactiveConfig.agixt.deleteConversation(currentConversation?.id || '-', agentName);

      // Properly invalidate both the conversation list and the specific conversation cache
      await mutate('/conversations');
      await mutate(conversationSWRPath + interactiveConfig.overrides.conversation);

      // Update the state to a new conversation
      if (interactiveConfig.mutate) {
        interactiveConfig.mutate((oldState) => ({
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        duration: 5000,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRenameConversation = async (newName: string): Promise<void> => {
    try {
      setLoading(true);
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

      const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || 'AGiXT';
      await interactiveConfig.agixt.renameConversation(agentName, currentConversation?.id || '-', newName);

      // Properly invalidate both the conversation list and the specific conversation
      await mutate('/conversations');
      await mutate(conversationSWRPath + interactiveConfig.overrides.conversation);

      toast({
        title: 'Success',
        description: 'Conversation renamed successfully',
        duration: 3000,
      });

      // If we expanded the sidebar for renaming, collapse it again
      if (wasExpanded) {
        setOpen(false);
        setWasExpanded(false);
      }
      setRenaming(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to rename conversation',
        duration: 5000,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportConversation = async (): Promise<void> => {
    try {
      setLoading(true);
      // Get the full conversation content
      const conversationContent = await interactiveConfig.agixt.getConversation('', currentConversation?.id || '-');

      // Format the conversation for export
      const exportData = {
        name: currentConversation?.name || 'Conversation',
        id: currentConversation?.id || '-',
        created_at: currentConversation?.createdAt || new Date().toISOString(),
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
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export conversation',
        duration: 5000,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Initialize the rename value when renaming state changes
  useEffect(() => {
    if (renaming) {
      setNewName(currentConversation?.name || '');
    }
  }, [renaming, currentConversation]);

  // Clean up loading state on unmount
  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  const handleRenameClick = () => {
    // First ensure the sidebar is open
    if (!open) {
      // Track that we expanded the sidebar
      setWasExpanded(true);
      setOpen(true);
      // Allow time for sidebar animation before enabling rename mode
      setTimeout(() => {
        setRenaming(true);
        setNewName(currentConversation?.name || '');
      }, 300);
    } else {
      // Sidebar is already open, directly enter rename mode
      setRenaming(true);
      setNewName(currentConversation?.name || '');
    }
  };

  // Don't show sidebar content if no conversation exists
  if (!currentConversation || currentConversation.id === '-') {
    return null;
  }

  return (
    <SidebarContent title='Conversation'>
      <SidebarGroup>
        {
          <div className='w-full group-data-[collapsible=icon]:hidden'>
            {renaming ? (
              <div className='flex items-center gap-2'>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className='w-full'
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameConversation(newName);
                    } else if (e.key === 'Escape') {
                      setRenaming(false);
                    }
                  }}
                />
                <Button variant='ghost' size='icon' onClick={() => handleRenameConversation(newName)} disabled={loading}>
                  <Check className='h-4 w-4' />
                </Button>
              </div>
            ) : (
              <h4 className='text-lg font-medium mb-2'>{currentConversation?.name || 'Conversation'}</h4>
            )}
            {currentConversation && currentConversation.attachmentCount > 0 && (
              <Badge className='gap-1 mb-2'>
                <Paperclip className='w-3 h-3' />
                {currentConversation.attachmentCount}
              </Badge>
            )}
          </div>
        }
        <SidebarGroupLabel>Conversation Actions</SidebarGroupLabel>
        <SidebarMenu>
          {[
            {
              title: 'New Conversation',
              icon: Plus,
              func: () => {
                if (interactiveConfig?.mutate) {
                  interactiveConfig.mutate((oldState) => ({
                    ...oldState,
                    overrides: { ...oldState.overrides, conversation: '-' },
                  }));

                  // Force an invalidation of any existing conversation data
                  mutate(conversationSWRPath + interactiveConfig.overrides.conversation);
                }
                router.push('/chat');
              },
              disabled: loading || renaming,
            },
            {
              title: renaming ? 'Save Name' : 'Rename Conversation',
              icon: renaming ? Check : Pencil,
              func: renaming ? () => handleRenameConversation(newName) : handleRenameClick,
              disabled: loading,
            },
            {
              title: 'Export Conversation',
              icon: Download,
              func: handleExportConversation,
              disabled: loading || renaming || !currentConversation?.id || currentConversation?.id === '-',
            },
            {
              title: 'Delete Conversation',
              icon: Trash2,
              func: () => setDeleteDialogOpen(true),
              disabled: loading || renaming || !currentConversation?.id || currentConversation?.id === '-',
            },
          ].map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton side='right' tooltip={item.title} onClick={item.func} disabled={item.disabled}>
                {item.icon && <item.icon className='h-4 w-4' />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                handleDeleteConversation();
                setDeleteDialogOpen(false);
              }}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarContent>
  );
}

export function ChatLog({
  conversation,
  alternateBackground,
  loading,
  setLoading,
}: {
  conversation: { id: string; role: string; message: string; timestamp: string; children: any[] }[];
  setLoading: (loading: boolean) => void;
  loading: boolean;
  alternateBackground?: string;
}): React.JSX.Element {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  let lastUserMessage = ''; // track the last user message

  // Scroll to bottom when conversation updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  return (
    <div className='flex flex-col-reverse flex-grow overflow-auto bg-background pb-28' style={{ flexBasis: '0px' }}>
      <div className='flex flex-col h-min'>
        {conversation && conversation.length > 0 ? (
          conversation.map((chatItem, index: number) => {
            if (chatItem.role === 'user') {
              lastUserMessage = chatItem.message;
            }
            const validTypes = [
              '[ACTIVITY]',
              '[ACTIVITY][ERROR]',
              '[ACTIVITY][WARN]',
              '[ACTIVITY][INFO]',
              '[SUBACTIVITY]',
              '[SUBACTIVITY][THOUGHT]',
              '[SUBACTIVITY][REFLECTION]',
              '[SUBACTIVITY][EXECUTION]',
              '[SUBACTIVITY][ERROR]',
              '[SUBACTIVITY][WARN]',
              '[SUBACTIVITY][INFO]',
            ];
            const messageType = chatItem.message.split(' ')[0];
            const messageBody = validTypes.some((x) => messageType.includes(x))
              ? chatItem.message.substring(chatItem.message.indexOf(' '))
              : chatItem.message;

            return validTypes.includes(messageType) ? (
              <ChatActivity
                key={chatItem.timestamp + '-' + messageBody}
                activityType={
                  messageType === '[ACTIVITY]'
                    ? 'success'
                    : (messageType.split('[')[2]?.split(']')[0]?.toLowerCase() as
                        | 'error'
                        | 'info'
                        | 'success'
                        | 'warn'
                        | 'thought'
                        | 'reflection'
                        | 'execution'
                        | 'diagram')
                }
                nextTimestamp={conversation[index + 1]?.timestamp}
                message={messageBody}
                timestamp={chatItem.timestamp}
                alternateBackground={alternateBackground}
                children={chatItem.children}
              />
            ) : (
              <Message
                key={chatItem.timestamp + '-' + messageBody}
                chatItem={chatItem}
                lastUserMessage={lastUserMessage}
                setLoading={setLoading}
              />
            );
          })
        ) : (
          <div className='max-w-4xl px-2 mx-auto space-y-4 text-center mt-8'>
            <div>
              <h1 className='text-4xl md:text-6xl font-bold mb-4'>
                Welcome {process.env.NEXT_PUBLIC_APP_NAME && `to ${process.env.NEXT_PUBLIC_APP_NAME}`}
              </h1>
              {process.env.NEXT_PUBLIC_APP_DESCRIPTION && (
                <p className='text-lg text-muted-foreground'>{process.env.NEXT_PUBLIC_APP_DESCRIPTION}</p>
              )}
            </div>
            <p className='text-muted-foreground'>Start a conversation by typing a message below</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

// Helper function to format the conversation data from the API
export async function getAndFormatConversation(state): Promise<any[]> {
  // For empty/new conversations, return empty array
  if (!state.overrides.conversation || state.overrides.conversation === '-') {
    return [];
  }

  const rawConversation = await state.agixt.getConversation('', state.overrides.conversation, 100, 1);

  // Create a map of activity messages for faster lookups
  const activityMessages = {};
  const formattedConversation = [];

  // First pass: identify and store all main activities
  rawConversation.forEach((message) => {
    const messageType = message.message.split(' ')[0];
    if (!messageType.startsWith('[SUBACTIVITY]')) {
      formattedConversation.push({ ...message, children: [] });
      activityMessages[message.id] = formattedConversation[formattedConversation.length - 1];
    }
  });

  // Second pass: handle subactivities
  rawConversation.forEach((currentMessage) => {
    const messageType = currentMessage.message.split(' ')[0];
    if (messageType.startsWith('[SUBACTIVITY]')) {
      try {
        // Try to extract parent ID
        const parent = messageType.split('[')[2].split(']')[0];
        let foundParent = false;

        // Look for the parent in our activity map
        if (activityMessages[parent]) {
          activityMessages[parent].children.push({ ...currentMessage, children: [] });
          foundParent = true;
        } else {
          // If no exact match, try to find it in children
          for (const activity of formattedConversation) {
            const targetInChildren = activity.children.find((child) => child.id === parent);
            if (targetInChildren) {
              targetInChildren.children.push({ ...currentMessage, children: [] });
              foundParent = true;
              break;
            }
          }
        }

        // If still not found, add to the last activity as a fallback
        if (!foundParent && formattedConversation.length > 0) {
          const lastActivity = formattedConversation[formattedConversation.length - 1];
          lastActivity.children.push({ ...currentMessage, children: [] });
        }
      } catch (error) {
        // If parsing fails, add to the last activity as a fallback
        if (formattedConversation.length > 0) {
          const lastActivity = formattedConversation[formattedConversation.length - 1];
          lastActivity.children.push({ ...currentMessage, children: [] });
        } else {
          // If no activities exist yet, convert this subactivity to an activity
          formattedConversation.push({ ...currentMessage, children: [] });
        }
      }
    }
  });

  return formattedConversation;
}

export function Chat({
  alternateBackground,
  enableFileUpload,
  enableVoiceInput,
  showOverrideSwitchesCSV,
  conversation: conversationOverride,
}: Overrides & UIProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const [localThinkingActivity, setLocalThinkingActivity] = useState<{
    role: string;
    message: string;
    timestamp: string;
    children: any[];
    id: string;
  } | null>(null);
  const [conversationLengthWhenThinking, setConversationLengthWhenThinking] = useState<number>(0);
  const interactiveConfig = useContext(InteractiveConfigContext);
  const { data: conversations, isLoading: isLoadingConversations } = useConversations();
  const router = useRouter();

  // Find the current conversation
  const currentConversation = conversations?.find((conv) => conv.id === interactiveConfig.overrides.conversation);

  // Use WebSocket for real-time conversation updates instead of SWR polling
  const {
    messages: conversationData,
    connectionStatus,
    isLoading: wsLoading,
  } = useConversationWebSocket({
    conversationId: interactiveConfig.overrides.conversation,
    enabled: interactiveConfig.overrides.conversation !== '-',
    onMessage: (message) => {
      console.log('📨 WebSocket message received:', message.message);
      
      // Clear thinking activity when real messages arrive
      if (localThinkingActivity && !message.id.startsWith('thinking-')) {
        console.log('🧹 Clearing thinking activity - real message received via WebSocket');
        setLocalThinkingActivity(null);
      }
    },
    onConnect: () => {
      console.log('✅ WebSocket connected successfully');
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
    },
  });

  // Fallback function for manual conversation refresh (used by sidebar operations)
  const mutateConversation = useCallback(async () => {
    // For WebSocket implementation, this is mainly used by sidebar operations
    // The WebSocket connection will handle real-time updates
    console.log('🔄 Manual conversation refresh requested');
  }, []);

  // Effect to clear thinking activity when new messages arrive or loading stops
  useEffect(() => {
    if (!localThinkingActivity) return;

    // Simple logic: if loading has stopped, clear thinking activity
    if (!loading) {
      console.log('🧹 Clearing thinking activity - loading stopped');
      setLocalThinkingActivity(null);
      return;
    }

    // If we have more conversation items than when we started thinking, clear it
    if (conversationData.length > conversationLengthWhenThinking) {
      console.log('🧹 Clearing thinking activity - new messages detected:', {
        currentLength: conversationData.length,
        lengthWhenThinking: conversationLengthWhenThinking,
      });
      setLocalThinkingActivity(null);
      return;
    }

    // Also clear if we detect any real messages (not our thinking activity)
    const hasRealNewMessages = conversationData.some((msg: any) => {
      // Skip if it's our thinking activity
      if (msg.id && msg.id.startsWith('thinking-')) return false;
      
      // Check if this message came after we started thinking
      const msgTime = new Date(msg.timestamp);
      const thinkingTime = new Date(localThinkingActivity.timestamp);
      return msgTime >= thinkingTime;
    });

    if (hasRealNewMessages) {
      console.log('🧹 Clearing thinking activity - real messages detected');
      setLocalThinkingActivity(null);
    }
  }, [conversationData, localThinkingActivity, conversationLengthWhenThinking, loading]);

  // Enhanced thinking activity with progressive messages
  useEffect(() => {
    if (localThinkingActivity && loading) {
      let messageIndex = 0;
      const progressMessages = [
        '[ACTIVITY] Thinking...',
        '[ACTIVITY] Processing your request...',
        '[ACTIVITY] Analyzing context...',
        '[ACTIVITY] Generating response...',
        '[ACTIVITY] Almost done...'
      ];

      const timer = setInterval(() => {
        messageIndex = (messageIndex + 1) % progressMessages.length;
        setLocalThinkingActivity(prev => prev ? {
          ...prev,
          message: progressMessages[messageIndex]
        } : null);
      }, 2000); // Update message every 2 seconds

      return () => clearInterval(timer);
    }
  }, [localThinkingActivity, loading]);

  // Backup timer to clear thinking activity after a reasonable time
  useEffect(() => {
    if (localThinkingActivity && loading) {
      const timer = setTimeout(() => {
        console.log('⏰ Clearing thinking activity - backup timer triggered after 3 seconds');
        setLocalThinkingActivity(null);
      }, 3000); // 3 seconds for testing
      
      return () => clearTimeout(timer);
    }
  }, [localThinkingActivity, loading]);

  // Effect to aggressively revalidate when loading starts/stops
  useEffect(() => {
    if (loading) {
      console.log('🚀 Loading started - beginning aggressive polling');
    } else {
      console.log('⏹️ Loading stopped - ending polling');
      // One final revalidation when loading stops to catch any final messages
      mutateConversation();
    }
  }, [loading, mutateConversation]);

  // Combine server data with local thinking activity
  const displayConversationData = useMemo(() => {
    const wsData = conversationData.map(msg => ({
      ...msg,
      children: msg.children || []
    }));
    
    if (localThinkingActivity && loading) {
      return [...wsData, localThinkingActivity];
    }
    return wsData;
  }, [conversationData, localThinkingActivity, loading]);

  // Check if the conversation is empty
  const isEmptyConversation = !displayConversationData?.length;

  // Get company info for API calls
  const { data: activeCompany } = useCompany();

  // Handle array-type conversation ID in state (shouldn't happen, but as precaution)
  useEffect(() => {
    if (Array.isArray(interactiveConfig.overrides.conversation)) {
      interactiveConfig.mutate((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: oldState.overrides.conversation[0] },
      }));
    }
  }, [interactiveConfig]);

  // Refresh conversation data when conversation ID changes or loading state changes
  useEffect(() => {
    mutateConversation();
  }, [interactiveConfig.overrides.conversation, mutateConversation]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        mutateConversation();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, mutateConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  // Handler for sending messages
  async function chat(messageTextBody, messageAttachedFiles): Promise<string> {
    // Handle different types of messageTextBody (string or object)
    const messageText = typeof messageTextBody === 'string' ? messageTextBody : '';

    // Don't send empty messages
    if (!messageText.trim() && Object.keys(messageAttachedFiles).length === 0) {
      return '';
    }

    const messages = [];
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: messageText },
        ...Object.entries(messageAttachedFiles).map(([fileName, fileContent]: [string, string]) => ({
          type: `${fileContent.split(':')[1].split('/')[0]}_url`,
          file_name: fileName,
          [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
            url: fileContent,
          },
        })),
      ],
      // Include flags in the message itself
      ...(getCookie('agixt-create-image') ? { create_image: getCookie('agixt-create-image') } : {}),
      ...(getCookie('agixt-websearch') ? { websearch: getCookie('agixt-websearch') } : {}),
      ...(getCookie('agixt-analyze-user-input') ? { analyze_user_input: getCookie('agixt-analyze-user-input') } : {}),
      // Enable TTS automatically for children (roleId 4) or if the TTS cookie is set or if passed via messageFlags
      ...(activeCompany?.roleId === 4 ? { tts: 'true' } : {}),
    });

    // Build the request payload with proper structure
    const requestPayload = {
      messages: messages,
      model: getCookie('agixt-agent'),
      user: interactiveConfig.overrides?.conversation,
      ...(activeCompany?.id ? { company_id: activeCompany?.id } : {}),
    };

    setLoading(true);

    // Immediately get latest conversation state before starting
    console.log('🔄 Pre-chat conversation revalidation');
    await mutateConversation();

    // Store current conversation length before adding thinking activity
    setConversationLengthWhenThinking(conversationData.length);

    // Add immediate thinking activity to local state
    const thinkingActivity = {
      role: 'assistant',
      message: '[ACTIVITY] Thinking...',
      timestamp: new Date().toISOString(),
      children: [],
      id: `thinking-${Date.now()}`,
    };

    // Set local thinking activity
    console.log('🧠 Adding thinking activity:', thinkingActivity);
    console.log('📊 Conversation length when thinking started:', conversationData.length);
    setLocalThinkingActivity(thinkingActivity);

    try {
      // Fire the request and handle it in the background
      axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        requestPayload,
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      ).then(async (completionResponse) => {
        if (completionResponse.status === 200) {
          const chatCompletion = completionResponse.data;
          const conversationId = chatCompletion.id;

          // Only update route if conversation ID has changed
          if (conversationId !== interactiveConfig.overrides?.conversation) {
            // Update conversation state
            if (interactiveConfig.mutate) {
              interactiveConfig.mutate((oldState: any) => ({
                ...oldState,
                overrides: {
                  ...oldState.overrides,
                  conversation: conversationId,
                },
              }));
            }

            // Push route after state is updated
            router.push(`/chat/${conversationId}`);
          }

          // Trigger proper mutations
          mutate('/conversations');
          mutate('/user');
        }
      }).catch((error) => {
        console.error('❌ Chat API error:', error);
        toast({
          title: 'Error',
          description: 'Failed to get response from the agent',
          duration: 5000,
          variant: 'destructive',
        });
      }).finally(() => {
        // End loading state and final cleanup
        setLoading(false);
        console.log('🔄 Chat request completed, final cleanup');
        mutateConversation();
      });

      // Return immediately while the request processes in the background
      // The polling mechanism will handle updating the UI with real-time activities
      return '';

    } catch (error) {
      setLoading(false);
      setLocalThinkingActivity(null); // Clear thinking activity on error
      toast({
        title: 'Error',
        description: 'Failed to send message',
        duration: 5000,
        variant: 'destructive',
      });
      return '';
    }
  }

  return (
    <>
      <ChatSidebar currentConversation={currentConversation} />
      <ChatLog
        conversation={displayConversationData}
        alternateBackground={alternateBackground}
        setLoading={setLoading}
        loading={loading}
      />
      <ChatBar
        onSend={chat}
        disabled={loading}
        enableFileUpload={enableFileUpload}
        enableVoiceInput={enableVoiceInput}
        loading={loading}
        showResetConversation={false}
        isEmptyConversation={isEmptyConversation}
      />
    </>
  );
}
