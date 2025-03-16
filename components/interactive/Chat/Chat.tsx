'use client';

import { SidebarContent } from '@/components/idiot/appwrapper/SidebarContentManager';
import { useCompany } from '@/components/idiot/auth/hooks/useUser';
import { Input } from '@/components/ui/input';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { toast } from '@/hooks/useToast';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { Badge, Check, Download, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useContext, useEffect, useState, ForwardRefExoticComponent, RefAttributes, ReactNode } from 'react';
import useSWR, { mutate as swrMutate } from 'swr';
import { UIProps } from '../InteractiveAGiXT';
import { InteractiveConfigContext, Overrides, InteractiveConfig } from '../InteractiveConfigContext';
import ChatBar from './ChatInput';
import ChatLog from './ChatLog';
import { LucideProps } from 'lucide-react';

interface ConversationMessage {
  role: string;
  message: string;
  timestamp: string;
}

interface Conversation {
  id: string;
  conversation_name: string;
  created_at: string;
  attachment_count: number;
}

export async function getAndFormatConversastion(state: InteractiveConfig): Promise<any[]> {
  if (!state?.agixt || !state?.overrides?.conversation) return [];

  try {
    const rawConversation = await state.agixt.getConversation('', state.overrides.conversation, 100, 1);

    // Create a map of activity messages for faster lookups
    const activityMessages: { [key: string]: any } = {};
    const formattedConversation: any[] = [];

    // First pass: identify and store all activities
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
  } catch (error) {
    console.error("Error formatting conversation", error);
    return [];
  }
}

const conversationSWRPath = '/conversation/';
interface ChatProps extends Omit<UIProps, 'onSend' | 'showChatThemeToggles'> {
  showChatThemeToggles?: boolean;
  onSend: (messageTextBody: string, messageAttachedFiles?: Record<string, string>) => Promise<string | undefined>;
}
export default function Chat({
  showChatThemeToggles = false,
  alternateBackground,
  enableFileUpload,
  enableVoiceInput,
  showOverrideSwitchesCSV,
  onSend
}: ChatProps): React.JSX.Element {
  const [loading, setLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchConversations = async () => {
      if (!state?.agixt) return;

      try {
        const conversationData = await state.agixt.getConversations(true);
        setConversations(conversationData.map((conv: any) => ({
          id: conv.id || conv.conversation_name,
          conversation_name: conv.conversation_name,
          created_at: conv.created_at,
          attachment_count: conv.attachment_count
        })));
      } catch (error) {
        console.error('Error fetching conversations:', error);
      }
    };

    fetchConversations();
  }, [state?.agixt]);

  // Find the current conversation
  const currentConversation = conversations?.find((conv: any) => conv.id === state?.overrides?.conversation);
  const conversation = useSWR(
    conversationSWRPath + state?.overrides?.conversation,
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
    if (Array.isArray(state?.overrides?.conversation) && state?.mutate) {
      state.mutate((oldState: any) => {
        return {
        ...oldState,
        overrides: { ...oldState.overrides, conversation: state?.overrides?.conversation?.[0] || oldState.overrides.conversation },
      }});
    }
  }, [state?.overrides?.conversation, state?.mutate]);
  async function handleSend(messageTextBody: string | object, messageAttachedFiles?: Record<string, string>): Promise<string> {
    if (!state?.agixt || !state?.overrides?.conversation) return '';

    const messages: any[] = [];

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: messageTextBody },
        ...(messageAttachedFiles ? Object.entries(messageAttachedFiles).map(( [fileName, fileContent]) => ({
          type: `${fileContent.split(':')[1].split('/')[0]}_url`,
          file_name: fileName,
          [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
            url: fileContent,
          },
        })) : []), // Spread operator to include all file contents
      ],
      ...(activeCompany?.id ? { company_id: activeCompany?.id } : {}),
      ...(getCookie('agixt-create-image') ? { create_image: getCookie('agixt-create-image') } : {}),
      ...(getCookie('agixt-tts') ? { tts: getCookie('agixt-tts') } : {}),
      ...(getCookie('agixt-websearch') ? { websearch: getCookie('agixt-websearch') } : {}),
      ...(getCookie('agixt-analyze-user-input') ? { analyze_user_input: getCookie('agixt-analyze-user-input') } : {}),
    });

    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (state?.overrides?.conversation) {
      swrMutate(conversationSWRPath + (state?.overrides?.conversation || ''));
    }
    let completionResponse: any;
    try {
      completionResponse = await axios.post(
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
      if (completionResponse?.status === 200 && completionResponse?.data?.choices && completionResponse?.data?.choices[0]?.message?.content) {
        const chatCompletion = completionResponse?.data;

        // Store conversation ID
        const conversationId = chatCompletion?.id;
        if (state?.mutate && conversationId) {
        // Update conversation state
        state.mutate((oldState: any) => {
          return {
          ...oldState,
          overrides: { ...oldState.overrides, conversation: conversationId },
        }});


        // Push route after state is updated
        router.push(`/chat/${conversationId}`);

        // Refresh data after updating conversation


        // Trigger proper mutations
        swrMutate(conversationSWRPath + conversationId);
        swrMutate('/conversation');
        swrMutate('/user');
        setLoading(false);

        return chatCompletion.choices[0].message.content;
      } else {
        throw 'Failed to get response from the agent';
      }
    } else {
        throw 'Failed to get response from the agent';
    }

    } catch (error: any) {
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
  // Function to handle importing a conversation
  const handleImportConversation = async () => {
    // Create a file input element
    const fileInputEl = document.createElement('input');
    fileInputEl.type = 'file';
    fileInputEl.accept = '.json';

    // Handle file selection
    fileInputEl.onchange = async (event: any) => {
      try {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        // Extract the file name without extension to use as part of the conversation name
        const fileName = file.name.replace(/\.[^/.]+$/, '');

        // Read the file content
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          try {
            // Parse the JSON content
            const content = JSON.parse(e.target.result as string);

            // Use the name from the JSON if available, otherwise use filename
            const baseName = content.name || fileName;
            const timestamp = new Date().toISOString().split('.')[0].replace(/:/g, '-');
            const conversationName = `${baseName}_${timestamp}`;

            // Format the conversation content
            let conversationContent: ConversationMessage[] = [];
            if (content.messages && Array.isArray(content.messages)) {
              conversationContent = content.messages.map((msg: any) => ({
                role: msg.role || 'user',
                message: msg.content || msg.message || '',
                timestamp: msg.timestamp || new Date().toISOString(),
              }));
            } else if (content.conversation_history && Array.isArray(content.conversation_history)) {
              // Alternative format that might be used
              conversationContent = content.conversation_history.map((msg: any) => ({
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
            if (state?.agixt) {
              const newConversation = await state.agixt.newConversation(getCookie('agixt-agent') as string, conversationName, conversationContent);
              const newConversationID = newConversation?.id || '-';
              // Update the conversation list and navigate to the new conversation
              swrMutate('/conversations');

              // Set the new conversation as active
              state?.mutate && state.mutate((oldState: any) => ({
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
            }
          } catch (error: any) {
            console.error('Error processing file:', error);
            toast({
              title: 'Error',
              description: `Failed to process the imported conversation file: ${error.message || 'Unknown error'}`,
              duration: 5000,
              variant: 'destructive',
            });
          }
        };

        if (file) {
          reader.readAsText(file);
        }
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
    fileInputEl.click();
  };
  // Fix for the handleDeleteConversation function
  const handleDeleteConversation = async (): Promise<void> => {
    if (!state?.agixt || !currentConversation) return;
    try {
      await state.agixt.deleteConversation(currentConversation?.id || '-');
      if (!state?.overrides?.conversation) return;

      // Properly invalidate both the conversation list and the specific conversation cache
      swrMutate('/conversations'); // Assuming this is the key used in useConversations()
      swrMutate(conversationSWRPath + state.overrides.conversation);

      // Update the state
      state?.mutate && state.mutate((oldState: any) => ({
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
    if (!state?.agixt || !currentConversation) return;
    try {
      await state.agixt.renameConversation(getCookie('agixt-agent') as string, currentConversation?.id || '-', newName);

      // Properly invalidate both the conversation list and the specific conversation
      swrMutate('/conversations'); // Assuming this is the key used in useConversations()
      swrMutate(conversationSWRPath + state?.overrides?.conversation);

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
    if (!state?.agixt || !currentConversation) return;
    // Get the full conversation content
    const conversationContent = await state.agixt.getConversation('', currentConversation?.id || '-');

    // Format the conversation for export
    const exportData = {
      name: currentConversation?.conversation_name || 'New',
      id: currentConversation?.id || '-',
      created_at: currentConversation?.created_at || new Date().toISOString(),
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
    element.download = `${currentConversation?.conversation_name || 'New'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };
  const [newName, setNewName] = useState('');

  useEffect(() => {
    swrMutate(conversationSWRPath + state?.overrides?.conversation);
  }, [state?.overrides?.conversation, swrMutate, conversationSWRPath]);
  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        if (state?.overrides?.conversation) {
          swrMutate(conversationSWRPath + state.overrides.conversation);
        }
      }, 1000);
    }
  }, [loading, state?.overrides?.conversation, swrMutate, conversationSWRPath]);
  const [renaming, setRenaming] = useState(false);
  useEffect(() => {
    if (renaming) {
      setNewName(currentConversation?.conversation_name || '');
    }
  }, [renaming, currentConversation]);
  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);
  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          {
            <div className='w-full group-data-[collapsible=icon]:hidden'>
              {renaming ? (
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} className='w-full' />
              ) : (
                <h4>{currentConversation?.conversation_name}</h4>
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
            {
              [
                {
                  title: 'New Conversation',
                  icon: Plus,
                  func: () => {
                    router.push('/chat');
                  },
                  disabled: renaming,
                  visible: true
                },
                {
                  title: 'Rename Conversation',
                  icon: Pencil,
                  func: () => {
                    if (newName) {
                      handleRenameConversation(newName);
                      setRenaming(false);
                    }
                  },
                  disabled: false,
                  visible: true
                },
                {
                  title: 'Import Conversation',
                  icon: Upload,
                  func: handleImportConversation,
                  disabled: renaming,
                  visible: true
                },
                {
                  title: 'Export Conversation',
                  icon: Download,
                  func: handleExportConversation,
                  disabled: renaming,
                  visible: true
                },
                {
                  title: 'Delete Conversation',
                  icon: Trash2,
                  func: handleDeleteConversation,
                  disabled: renaming,
                  visible: true
                },
              ].map(
              (item) => {
                const menuItem = item as { title: string; icon: ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>; func: () => void; disabled: boolean; visible?: boolean };
                return (menuItem.visible !== false) ? (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton side='left' tooltip={item.title} onClick={item.func} disabled={item.disabled}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null;
              }
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <ChatLog
        conversation={conversation.data}
        alternateBackground={alternateBackground}
        setLoading={setLoading}
        loading={loading}
      />
      <ChatBar
        onSend={handleSend}
        disabled={loading}
        showChatThemeToggles={showChatThemeToggles}
        enableFileUpload={enableFileUpload}
        enableVoiceInput={enableVoiceInput}
        loading={loading}
        setLoading={setLoading}
        showOverrideSwitchesCSV={showOverrideSwitchesCSV}
        showResetConversation={
          process.env.NEXT_PUBLIC_AGIXT_SHOW_CONVERSATION_BAR !== 'true' &&
          process.env.NEXT_PUBLIC_AGIXT_CONVERSATION_MODE === 'uuid'
        }
      />
    </>
  );
}
