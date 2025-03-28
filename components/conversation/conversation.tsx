'use client';

import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import React, { useContext, useEffect, useState, useRef } from 'react';
import useSWR, { mutate } from 'swr';
import { useCompany } from '@/components/interactive/useUser';
import { toast } from '@/components/layout/toast';
import { InteractiveConfigContext, Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { Activity as ChatActivity } from '@/components/conversation/activity';
import Message from '@/components/conversation/Message/Message';
import { Badge, Check, Download, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { SidebarContent } from '@/components/layout/SidebarContentManager';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { ChatBar } from '@/components/conversation/input/chat-input';

export type UIProps = {
  showSelectorsCSV?: string;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  footerMessage?: string;
  showOverrideSwitchesCSV?: string;
};

const conversationSWRPath = '/conversation/';
const DEFAULT_AGENT = 'XT';

export function ChatSidebar({ currentConversation }: { currentConversation: any }): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const agentName = getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || DEFAULT_AGENT;

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
      await state.agixt.renameConversation(agentName, currentConversation?.id || '-', newName);

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
    <SidebarContent title=''>
      <SidebarGroup>
        {
          <div 
            className={renaming ? 'w-full': 'w-full group-data-[collapsible=icon]:hidden'}
          >
            {renaming ? (
              <Input required autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} className='w-full' />
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
                    if (newName.trim() === '') {
                      toast({
                        title: 'Error',
                        description: 'Conversation name cannot be empty',
                        duration: 3000,
                        variant: 'destructive',
                      });
                      return;
                    }
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
  let lastUserMessage = ''; // track the last user message
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  return (
    <div className='flex flex-col-reverse flex-grow overflow-auto bg-background pb-28' style={{ flexBasis: '0px' }}>
      <div className='flex flex-col h-min'>
        {conversation.length > 0 && conversation.map ? (
          conversation.map((chatItem, index: number) => {
            if (chatItem.role === 'USER') {
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
            // To-Do Fix this so the timestamp works. It's not granular enough rn and we get duplicates.
            return validTypes.includes(messageType) ? (
              <ChatActivity
                key={chatItem.timestamp + '-' + messageBody}
                activityType={
                  messageType === '[ACTIVITY]'
                    ? 'success'
                    : (messageType.split('[')[2].split(']')[0].toLowerCase() as
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
          <div className='max-w-4xl px-2 mx-auto space-y-2 text-center'>
            <div>
              <h1 className='text-4xl md:text-6xl'>
                Welcome {process.env.NEXT_PUBLIC_APP_NAME && `to ${process.env.NEXT_PUBLIC_APP_NAME}`}
              </h1>
              {process.env.NEXT_PUBLIC_APP_DESCRIPTION && (
                <p className='text-sm'>{process.env.NEXT_PUBLIC_APP_DESCRIPTION}</p>
              )}
            </div>
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
  showOverrideSwitchesCSV,
}: Overrides & UIProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const { data: conversations, isLoading: isLoadingConversations } = useConversations();

  // Find the current conversation
  const currentConversation = conversations?.find((conv) => conv.id === state.overrides.conversation);
  const conversation = useSWR(
    conversationSWRPath + state.overrides.conversation,
    async () => {
      return await getAndFormatConversastion(state);
    },
    {
      fallbackData: [],
      refreshInterval: loading ? 1000 : 0,
    },
  );
  const { data: activeCompany } = useCompany();
  useEffect(() => {
    if (Array.isArray(state.overrides.conversation)) {
      state.mutate((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: oldState.overrides.conversation[0] },
      }));
    }
  }, [state.overrides.conversation]);
  async function chat(messageTextBody, messageAttachedFiles): Promise<string> {
    const messages = [];

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: messageTextBody },
        ...Object.entries(messageAttachedFiles).map(([fileName, fileContent]: [string, string]) => ({
          type: `${fileContent.split(':')[1].split('/')[0]}_url`,
          file_name: fileName,
          [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
            url: fileContent,
          },
        })), // Spread operator to include all file contents
      ],
      ...(activeCompany?.id ? { company_id: activeCompany?.id } : {}),
      ...(getCookie('agixt-create-image') ? { create_image: getCookie('agixt-create-image') } : {}),
      ...(getCookie('agixt-tts') ? { tts: getCookie('agixt-tts') } : {}),
      ...(getCookie('agixt-websearch') ? { websearch: getCookie('agixt-websearch') } : {}),
      ...(getCookie('agixt-analyze-user-input') ? { analyze_user_input: getCookie('agixt-analyze-user-input') } : {}),
    });

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    mutate(conversationSWRPath + state.overrides.conversation);
    try {
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages: messages,
          model: getCookie('agixt-agent'),
          user: state.overrides.conversation,
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

        // Update conversation state
        state.mutate((oldState) => ({
          ...oldState,
          overrides: {
            ...oldState.overrides,
            conversation: conversationId,
          },
        }));

        // Push route after state is updated
        router.push(`/chat/${conversationId}`);

        // Refresh data after updating conversation
        setLoading(false);

        // Trigger proper mutations
        mutate(conversationSWRPath + conversationId);
        mutate('/conversation');
        mutate('/user');

        if (chatCompletion?.choices[0]?.message.content.length > 0) {
          return chatCompletion.choices[0].message.content;
        } else {
          throw 'Failed to get response from the agent';
        }
      } else {
        throw 'Failed to get response from the agent';
      }
    } catch (error) {
      setLoading(false);
      toast({
        title: 'Error',
        description: 'Failed to get response from the agent',
        duration: 5000,
      });
    }
  }
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

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  return (
    <>
      <ChatSidebar currentConversation={currentConversation} />
      <ChatLog
        conversation={conversation.data}
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
      />
    </>
  );
}

export async function getAndFormatConversastion(state): Promise<any[]> {
  const rawConversation = await state.agixt.getConversation('', state.overrides.conversation, 100, 1);

  // Create a map of activity messages for faster lookups
  const activityMessages = {};
  const formattedConversation = [];

  // First pass: identify and store all activities
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
