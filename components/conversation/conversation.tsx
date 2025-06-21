'use client';

import { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { mutate } from 'swr';
import useSWR from 'swr';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { Paperclip, Pencil, Plus, Check, Download, Trash2 } from 'lucide-react';
import { useConversationWebSocket } from '@/hooks/useConversationWebSocketStable';
import { InteractiveConfigContext, Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useCompany } from '@/components/interactive/useUser';
import { useConversations } from '@/components/interactive/useConversation';
import { toast } from '@/components/layout/toast';
import { Activity as ChatActivity } from '@/components/conversation/activity';
import Message from '@/components/conversation/Message/Message';
import { SidebarContent } from '@/components/layout/SidebarContentManager';
import { ChatBar } from '@/components/conversation/input/chat-input';
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

interface ConversationMessage {
  id: string;
  role: string;
  message: string;
  timestamp: string;
  children: ConversationMessage[];
}
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
      await mutate(conversationSWRPath + interactiveConfig.overrides?.conversation);

      // Update the state to a new conversation
      if (interactiveConfig.mutate) {
        interactiveConfig.mutate((oldState: any) => ({
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
      await mutate(conversationSWRPath + interactiveConfig.overrides?.conversation);

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
    return <div />;
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
                  interactiveConfig.mutate((oldState: any) => ({
                    ...oldState,
                    overrides: { ...oldState.overrides, conversation: '-' },
                  }));

                  // Force an invalidation of any existing conversation data
                  mutate(conversationSWRPath + interactiveConfig.overrides?.conversation);
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
          conversation
            .filter((chatItem) => {
              // Filter out SUBACTIVITY messages as they should only appear as children
              return !chatItem.message.startsWith('[SUBACTIVITY]');
            })
            .map((chatItem, index: number) => {
              if (chatItem.role === 'user') {
                lastUserMessage = chatItem.message;
              }
              const validTypes = ['[ACTIVITY]', '[ACTIVITY][ERROR]', '[ACTIVITY][WARN]', '[ACTIVITY][INFO]'];
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
                  nextTimestamp={(() => {
                    // Look for the next message that definitively ends this activity group
                    for (let i = index + 1; i < conversation.length; i++) {
                      const nextItem = conversation[i];
                      const nextMessageType = nextItem.message.split(' ')[0];
                      
                      // If it's any non-activity, non-subactivity message, the activity is complete
                      if (
                        !validTypes.some((x) => nextMessageType.includes(x)) &&
                        !nextItem.message.startsWith('[SUBACTIVITY]')
                      ) {
                        return nextItem.timestamp;
                      }
                      
                      // If it's a different activity group (different base timestamp), use its timestamp
                      if (validTypes.some((x) => nextMessageType.includes(x)) && nextItem.timestamp !== chatItem.timestamp) {
                        return nextItem.timestamp;
                      }
                    }
                    // No next timestamp found, this activity is still running
                    return undefined;
                  })()}
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

export function Chat({
  alternateBackground,
  enableFileUpload,
  enableVoiceInput,
  conversation: conversationOverride,
}: Overrides & UIProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const interactiveConfig = useContext(InteractiveConfigContext);
  const { data: conversations } = useConversations();
  const router = useRouter();

  // Use conversation override from props as priority, fallback to interactive config
  const activeConversationId = conversationOverride || interactiveConfig.overrides?.conversation;

  // Find the current conversation
  const currentConversation = conversations?.find((conv) => conv.id === activeConversationId);

  // Use WebSocket for real-time conversation updates with SWR fallback for initial data
  // Enable WebSocket for all conversations including new ones with ID "-"
  const { messages: conversationData } = useConversationWebSocket({
    conversationId: activeConversationId,
    enabled: activeConversationId !== undefined, // Enable for all IDs including "-"
    onMessage: () => {
      // WebSocket message received
    },
    onConnect: () => {
      // WebSocket connected successfully
    },
    onError: (error) => {
      console.error('❌ WebSocket error:', error);
    },
  });

  // Always use SWR for initial data, then enhance with WebSocket for real-time updates
  const { data: swrConversationData } = useSWR(
    activeConversationId !== '-' && activeConversationId !== undefined ? conversationSWRPath + activeConversationId : null,
    () => interactiveConfig.agixt.getConversation('', activeConversationId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 0,
      dedupingInterval: 2000,
    },
  );

  // Determine which data source to use - prioritize WebSocket for real-time updates
  const activeConversationData = useMemo(() => {
    // If WebSocket has data, use it as primary source (real-time updates)
    if (conversationData && conversationData.length > 0) {
      // If we also have SWR data, merge missing messages from SWR
      if (swrConversationData && swrConversationData.length > 0) {
        // Use WebSocket data as base, add any missing SWR messages
        const wsIds = new Set(conversationData.map((msg: { id: string }) => msg.id));
        const missingSWRMessages = swrConversationData.filter((swrMsg: { id: string }) => !wsIds.has(swrMsg.id));

        if (missingSWRMessages.length > 0) {
          // Sort by timestamp to maintain chronological order
          return [...conversationData, ...missingSWRMessages].sort(
            (a: { timestamp: string }, b: { timestamp: string }) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
        }
      }

      return conversationData;
    }

    // Fallback to SWR data if no WebSocket data
    if (swrConversationData && swrConversationData.length > 0) {
      return swrConversationData;
    }

    return [];
  }, [conversationData, swrConversationData]); // WebSocket data first in dependencies

  // Ensure conversationData is always an array with valid structure
  const safeConversationData = useMemo(() => {
    try {
      if (!Array.isArray(activeConversationData)) {
        console.warn('activeConversationData is not an array:', activeConversationData);
        return [];
      }

      return activeConversationData.map((msg: any, index: number): ConversationMessage => {
        // Validate each message object
        if (!msg || typeof msg !== 'object') {
          console.warn('Invalid message object at index', index, ':', msg);
          return {
            id: `invalid-msg-${Date.now()}-${index}`,
            role: 'system',
            message: '[Invalid message data]',
            timestamp: new Date().toISOString(),
            children: [],
          };
        }

        return {
          id: msg.id || `msg-${Date.now()}-${index}`,
          role: msg.role || 'unknown',
          message: msg.message || '',
          timestamp: msg.timestamp || new Date().toISOString(),
          children: Array.isArray(msg.children)
            ? msg.children.map(
                (child: any, childIndex: number): ConversationMessage => ({
                  id: child?.id || `child-${Date.now()}-${index}-${childIndex}`,
                  role: child?.role || 'unknown',
                  message: child?.message || '',
                  timestamp: child?.timestamp || new Date().toISOString(),
                  children: [],
                }),
              )
            : [],
        };
      });
    } catch (error) {
      console.error('Error processing conversation data:', error);
      return [];
    }
  }, [activeConversationData]);

  // Combine server data
  const displayConversationData = useMemo(() => {
    return safeConversationData.map((msg) => ({
      ...msg,
      children: msg.children || [],
    }));
  }, [safeConversationData]);

  // Check if the conversation is empty
  const isEmptyConversation = !displayConversationData?.length;

  // Get company info for API calls
  const { data: activeCompany } = useCompany();

  // Handler for sending messages
  async function chat(messageTextBody: any, messageAttachedFiles: any): Promise<string> {
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

    try {
      // Fire the request and handle it in the background
      axios
        .post(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`, requestPayload, {
          headers: {
            Authorization: getCookie('jwt'),
          },
        })
        .then(async (completionResponse) => {
          if (completionResponse.status === 200) {
            const chatCompletion = completionResponse.data;
            const conversationId = chatCompletion.id;

            // Only update route if conversation ID has changed
            if (conversationId !== activeConversationId) {
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
        })
        .catch((error) => {
          console.error('❌ Chat API error:', error);
          toast({
            title: 'Error',
            description: 'Failed to get response from the agent',
            duration: 5000,
            variant: 'destructive',
          });
        })
        .finally(() => {
          // End loading state and final cleanup
          setLoading(false);
        });

      // Return immediately while the request processes in the background
      // The WebSocket connection will handle updating the UI with real-time activities
      return '';
    } catch (error) {
      setLoading(false);
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
