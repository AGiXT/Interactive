'use client';

import { useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import { useRouter } from 'next/navigation';

import { InteractiveConfigContext, Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useCompany } from '@/components/interactive/useUser';
import { useConversations } from '@/components/interactive/useConversation';
import { toast } from '@/components/layout/toast';

import { Activity as ChatActivity } from '@/components/conversation/activity';
import Message from '@/components/conversation/Message/Message';
import { SidebarContent } from '@/components/layout/SidebarContentManager';
import { ChatBar } from '@/components/conversation/input/chat-input';

import { Badge, Paperclip, Pencil, Plus, Check, Download, Trash2 } from 'lucide-react';
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

      // Properly invalidate both the conversation list and the specific conversation
      await mutate('/conversations');
      await mutate(conversationSWRPath + (interactiveConfig?.overrides?.conversation || ''));

      // Update the state to a new conversation
      if (interactiveConfig?.mutate) {
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
      await mutate(conversationSWRPath + (interactiveConfig?.overrides?.conversation || ''));

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
  }, [renaming, currentConversation?.name]);

  const handleRenameClick = useCallback(() => {
    if (!open) {
      setWasExpanded(true);
      setOpen(true);
    }
    setRenaming(true);
  }, [open, setOpen]);

  return (
    <SidebarGroup>
      <SidebarContent className='p-2 space-y-4'>
        {currentConversation && (
          <div>
            {renaming ? (
              <div className='space-y-2'>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameConversation(newName);
                    } else if (e.key === 'Escape') {
                      setRenaming(false);
                    }
                  }}
                  className='text-sm'
                  autoFocus
                />
                <Button size='sm' onClick={() => handleRenameConversation(newName)} disabled={loading} className='w-full'>
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
        )}
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
                  mutate(conversationSWRPath + (interactiveConfig?.overrides?.conversation || ''));
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
      </SidebarContent>

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
            <Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant='destructive' onClick={handleDeleteConversation} disabled={loading}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarGroup>
  );
}

export function ChatLog({
  conversation,
  alternateBackground,
  loading,
  setLoading,
}: {
  conversation: { role: string; message: string; timestamp: string; children: any[] }[];
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
                chatItem={{ ...chatItem, id: chatItem.timestamp }}
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
export async function getAndFormatConversation(state: any): Promise<any[]> {
  // For empty/new conversations, return empty array
  if (!state.overrides.conversation || state.overrides.conversation === '-') {
    return [];
  }

  const rawConversation = await state.agixt.getConversation('', state.overrides.conversation, 100, 1);

  // Create a map of activity messages for faster lookups
  const activityMessages: { [key: string]: any } = {};
  const formattedConversation: any[] = [];

  // First pass: identify and store all main activities
  rawConversation.forEach((message: any) => {
    const messageType = message.message.split(' ')[0];
    if (!messageType.startsWith('[SUBACTIVITY]')) {
      formattedConversation.push({ ...message, children: [] });
      activityMessages[message.id] = formattedConversation[formattedConversation.length - 1];
    }
  });

  // Second pass: handle subactivities
  rawConversation.forEach((currentMessage: any) => {
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
            const targetInChildren = activity.children.find((child: any) => child.id === parent);
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

// Memoized conversation formatter to prevent unnecessary recalculations
const useFormattedConversation = (interactiveConfig: any) => {
  return useMemo(() => {
    const fetcher = async () => {
      return await getAndFormatConversation(interactiveConfig);
    };
    return fetcher;
  }, [interactiveConfig?.overrides?.conversation]);
};

// Deep comparison function for conversation data
const compareConversationData = (a: any[] | undefined, b: any[] | undefined): boolean => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  // Compare timestamps and message content as a quick check
  for (let i = 0; i < a.length; i++) {
    if (a[i]?.timestamp !== b[i]?.timestamp || a[i]?.message !== b[i]?.message) {
      return false;
    }
  }
  return true;
};

export function Chat({
  alternateBackground,
  enableFileUpload,
  enableVoiceInput,
  showOverrideSwitchesCSV,
  conversation: conversationOverride,
}: Overrides & UIProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const interactiveConfig = useContext(InteractiveConfigContext);
  const { data: conversations, isLoading: isLoadingConversations } = useConversations();
  const router = useRouter();

  // Find the current conversation
  const currentConversation = conversations?.find((conv) => conv.id === interactiveConfig?.overrides?.conversation);

  // Memoized fetcher function to prevent unnecessary re-fetches
  const conversationFetcher = useFormattedConversation(interactiveConfig);

  // Fetch conversation data with SWR - optimized to prevent constant re-renders
  const { data: conversationData = [], mutate: mutateConversation } = useSWR(
    interactiveConfig?.overrides?.conversation ? conversationSWRPath + interactiveConfig.overrides.conversation : null,
    conversationFetcher,
    {
      fallbackData: [],
      refreshInterval: 0, // Remove automatic refresh to prevent constant re-renders
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000, // Dedupe requests for 2 seconds
      compare: compareConversationData, // Use our custom comparison function
    },
  );

  // Check if the conversation is empty
  const isEmptyConversation = !conversationData?.length;

  // Get company info for API calls
  const { data: activeCompany } = useCompany();

  // Handle array-type conversation ID in state (shouldn't happen, but as precaution)
  useEffect(() => {
    if (Array.isArray(interactiveConfig?.overrides?.conversation)) {
      interactiveConfig?.mutate?.((oldState: any) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: oldState.overrides.conversation[0] },
      }));
    }
  }, [interactiveConfig]);

  // Only refresh conversation data when conversation ID actually changes
  const conversationId = interactiveConfig?.overrides?.conversation;
  const previousConversationId = useRef(conversationId);

  useEffect(() => {
    if (conversationId !== previousConversationId.current) {
      previousConversationId.current = conversationId;
      mutateConversation();
    }
  }, [conversationId, mutateConversation]);

  // Only refresh during loading state, with debounced updates
  useEffect(() => {
    if (loading) {
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
  async function chat(message: string | object, uploadedFiles?: { [key: string]: string }): Promise<string> {
    const messageTextBody = typeof message === 'string' ? message : JSON.stringify(message);
    const messageAttachedFiles = uploadedFiles || {};

    // Don't send empty messages
    if (!messageTextBody.trim() && Object.keys(messageAttachedFiles).length === 0) {
      return '';
    }

    const messages = [];
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: messageTextBody },
        ...Object.entries(messageAttachedFiles).map(([fileName, fileContent]) => ({
          type: `${fileContent.split(':')[1].split('/')[0]}_url`,
          file_name: fileName,
          [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
            url: fileContent,
          },
        })),
      ],
      ...(activeCompany?.id ? { company_id: activeCompany?.id } : {}),
      ...(getCookie('agixt-create-image') ? { create_image: getCookie('agixt-create-image') } : {}),
      ...(activeCompany?.roleId === 4 ? { tts: 'true' } : {}),
      ...(getCookie('agixt-websearch') ? { websearch: getCookie('agixt-websearch') } : {}),
      ...(getCookie('agixt-analyze-user-input') ? { analyze_user_input: getCookie('agixt-analyze-user-input') } : {}),
    });

    setLoading(true);

    // Slight delay to allow UI to update
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Refresh conversation data immediately to show the message
    mutateConversation();

    try {
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages: messages,
          model: getCookie('agixt-agent'),
          user: interactiveConfig?.overrides?.conversation,
        },
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (completionResponse.status === 200) {
        const chatCompletion = completionResponse.data;

        // Store conversation ID
        const conversationId = chatCompletion.id;

        // Only update route if conversation ID has changed
        if (conversationId !== interactiveConfig?.overrides?.conversation) {
          // Update conversation state
          interactiveConfig?.mutate?.((oldState: any) => ({
            ...oldState,
            overrides: {
              ...oldState.overrides,
              conversation: conversationId,
            },
          }));

          // Push route after state is updated
          router.push(`/chat/${conversationId}`);
        }

        // Refresh data after updating conversation
        setLoading(false);

        // Trigger proper mutations
        mutateConversation();
        mutate('/conversations');
        mutate('/user');

        if (chatCompletion?.choices[0]?.message.content.length > 0) {
          return chatCompletion.choices[0].message.content;
        } else {
          throw new Error('Failed to get response from the agent');
        }
      } else {
        throw new Error('Failed to get response from the agent');
      }
    } catch (error) {
      setLoading(false);
      toast({
        title: 'Error',
        description: 'Failed to get response from the agent',
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
        conversation={conversationData}
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
        setLoading={setLoading}
        showOverrideSwitchesCSV={showOverrideSwitchesCSV}
        showResetConversation={false}
        isEmptyConversation={isEmptyConversation}
      />
    </>
  );
}
