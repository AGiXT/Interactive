'use client';

import { SidebarContent } from '@/components/jrg/appwrapper/SidebarContentManager';
import { useCompany } from '@/components/jrg/auth/hooks/useUser';
import log from '@/components/jrg/next-log/log';
import { Input } from '@/components/ui/input';
import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { toast } from '@/hooks/useToast';
import axios from 'axios';
import { getCookie } from 'cookies-next';
import { Badge, Check, Download, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useContext, useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { UIProps } from '../InteractiveAGiXT';
import { InteractiveConfig, InteractiveConfigContext, Overrides } from '../InteractiveConfigContext';
import { useConversations } from '../hooks/useConversation';
import ChatBar from './ChatInput';
import ChatLog from './ChatLog';

interface Message {
  id: string;
  message: string;
  role?: string;
  timestamp?: string;
  children: Message[];
}

interface Conversation {
  id: string;
  name: string;
  attachmentCount: number;
  createdAt: string;
  updatedAt: string;
  hasNotifications: boolean;
  summary?: unknown;
}

interface MenuItem {
  title: string;
  icon: React.ComponentType<any>;
  func: () => void;
  disabled: boolean;
}



type ChatProps = Omit<UIProps & Overrides, 'enableFileUpload' | 'enableVoiceInput' | 'showOverrideSwitchesCSV'> & {
  showChatThemeToggles?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  showOverrideSwitchesCSV?: string;
  showResetConversation?: boolean;
};

const Chat = ({
  showChatThemeToggles,
  alternateBackground,
  enableFileUpload = false,
  enableVoiceInput = false,
  showOverrideSwitchesCSV = '',
  ...props
}: ChatProps): React.JSX.Element => {
  const conversationSWRPath = '/conversation/';
  
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  
  const state = useContext<InteractiveConfig>(InteractiveConfigContext);
  const { data: conversations, isLoading: isLoadingConversations } = useConversations();
  const { data: activeCompany } = useCompany();
  const router = useRouter();

  const currentConversation = conversations?.find((conv: Conversation) => 
    conv.id === state?.overrides?.conversation
  );

  const conversation = useSWR(
    state?.overrides?.conversation ? conversationSWRPath + state.overrides.conversation : null,
    async () => {
      const rawConversation = await state?.agixt?.getConversation('', state?.overrides?.conversation ?? '', 100, 1);
      log(['Raw conversation: ', rawConversation], { client: 3 });
      return rawConversation.reduce((accumulator: Message[], currentMessage: Message) => {
        const messageType = currentMessage.message.split(' ')[0];
        if (messageType.startsWith('[SUBACTIVITY]')) {
          let target: Message | undefined;
          const parent = messageType.split('[')[2].split(']')[0];
          const parentIndex = accumulator.findIndex((message: Message) => {
            return message.id === parent || message.children.some((child: Message) => child.id === parent);
          });
          if (parentIndex !== -1) {
            if (accumulator[parentIndex].id === parent) {
              target = accumulator[parentIndex];
            } else {
              target = accumulator[parentIndex].children.find((child: Message) => child.id === parent);
            }
            target?.children.push({ ...currentMessage, children: [] });
          } else {
            throw new Error(
              `Parent message not found for subactivity ${currentMessage.id} - ${currentMessage.message}, parent ID: ${parent}`,
            );
          }
        } else {
          accumulator.push({ ...currentMessage, children: [] });
        }
        return accumulator;
      }, []);
    },
    {
      fallbackData: [],
      refreshInterval: loading ? 1000 : 0,
    },
  );

  async function chat(message: string | object, uploadedFiles?: Record<string, string>): Promise<string> {
    try {
      setLoading(true);
      
      const messageTextBody = typeof message === 'string' ? message : JSON.stringify(message);
      const messageAttachedFiles = uploadedFiles || {};

      const messages = [{
        role: 'user',
        content: [
          { type: 'text', text: messageTextBody },
          ...Object.entries(messageAttachedFiles).map(([fileName, fileContent]: [string, string]) => ({
            type: `${fileContent.split(':')[1].split('/')[0]}_url`,
            file_name: fileName,
            [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
              url: fileContent,
            },
          })),
        ],
        ...(activeCompany?.id ? { company_id: activeCompany.id } : {}),
        ...(getCookie('agixt-create-image') ? { create_image: getCookie('agixt-create-image') } : {}),
        ...(getCookie('agixt-tts') ? { tts: getCookie('agixt-tts') } : {}),
        ...(getCookie('agixt-websearch') ? { websearch: getCookie('agixt-websearch') } : {}),
        ...(getCookie('agixt-analyze-user-input') ? { analyze_user_input: getCookie('agixt-analyze-user-input') } : {}),
      }];

      const toOpenAI = {
        messages,
        model: getCookie('agixt-agent'),
        user: state?.overrides?.conversation ?? '-',
      };

      log(['Sending: ', state?.openai, toOpenAI], { client: 1 });
      
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        toOpenAI,
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (completionResponse.status === 200) {
        const chatCompletion = completionResponse.data;
        log(['RESPONSE: ', chatCompletion], { client: 1 });

        const newConversationId = chatCompletion.id;

        if (state?.mutate) {
          await state.mutate((oldState: InteractiveConfig) => ({
            ...oldState,
            overrides: {
              ...oldState.overrides,
              conversation: newConversationId,
            },
          }));
        }

        const currentConv = state?.overrides?.conversation;
        if (currentConv === '-' && state?.agixt) {
          await state.agixt.renameConversation(state.agent, newConversationId);
          await mutate('/conversation');
        }

        router.push(`/chat/${newConversationId}`);
        
        mutate(conversationSWRPath + newConversationId);
        mutate('/user');

        if (chatCompletion?.choices?.[0]?.message?.content?.length > 0) {
          return chatCompletion.choices[0].message.content;
        }
        throw new Error('Empty response from agent');
      }
      throw new Error('Failed to get response from agent');
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get response from the agent',
        duration: 5000,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (renaming) {
      setNewName(currentConversation?.name || '');
    }
  }, [renaming, currentConversation]);

  useEffect(() => {
    const conversation = state?.overrides?.conversation;
    if (state?.mutate && conversation && Array.isArray(conversation)) {
      state.mutate((oldState: InteractiveConfig) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: conversation[0] },
      }));
    }
  }, [state?.overrides?.conversation]);

  useEffect(() => {
    const conv = state?.overrides?.conversation;
    if (conv) {
      mutate(conversationSWRPath + conv);
    }
  }, [state?.overrides?.conversation]);

  useEffect(() => {
    if (!loading) {
      const conv = state?.overrides?.conversation;
      if (conv) {
        setTimeout(() => {
          mutate(conversationSWRPath + conv);
        }, 1000);
      }
    }
  }, [loading, state?.overrides?.conversation]);

  const handleDeleteConversation = async (): Promise<void> => {
    if (state?.agixt && state?.mutate) {
      await state.agixt.deleteConversation(currentConversation?.id || '-');
      await mutate('/conversation');
      state.mutate((oldState: InteractiveConfig) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: '-' },
      }));
    }
  };

  const handleExportConversation = async (): Promise<void> => {
    if (!state?.agixt || !currentConversation) return;

    const conversationContent = await state.agixt.getConversation('', currentConversation.id);
    const exportData = {
      name: currentConversation.name,
      id: currentConversation.id,
      createdAt: currentConversation.createdAt,
      messages: conversationContent.map((msg: Message) => ({
        role: msg.role,
        content: msg.message,
        timestamp: msg.timestamp,
      })),
    };

    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${currentConversation.name}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const menuItems = [
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
            if (currentConversation?.id && state?.agixt) {
              state.agixt.renameConversation(state.agent, currentConversation.id, newName);
              setRenaming(false);
            }
          }
        : () => setRenaming(true),
      disabled: false,
    },
    {
      title: 'Import Conversation',
      icon: Upload,
      func: () => {},
      disabled: true,
    },
    {
      title: 'Export Conversation',
      icon: Download,
      func: handleExportConversation,
      disabled: renaming,
    },
    {
      title: 'Delete Conversation',
      icon: Trash2,
      func: handleDeleteConversation,
      disabled: renaming,
    },
  ];

  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <div className="w-full group-data-[collapsible=icon]:hidden">
            {renaming ? (
              <Input 
                value={newName} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} 
                className="w-full" 
              />
            ) : (
              <h4>{currentConversation?.name}</h4>
            )}
            {currentConversation && currentConversation.attachmentCount > 0 && (
              <Badge className="gap-1">
                <Paperclip className="w-3 h-3" />
                {currentConversation.attachmentCount}
              </Badge>
            )}
          </div>
          <SidebarGroupLabel>Conversation Functions</SidebarGroupLabel>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton tooltip={item.title} onClick={item.func} disabled={item.disabled}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <ChatLog
        conversation={conversation.data}
        alternateBackground={alternateBackground || 'primary'}
        setLoading={setLoading}
        loading={loading}
      />
      <ChatBar
        onSend={chat}
        disabled={loading}
        showChatThemeToggles={Boolean(showChatThemeToggles)}
        enableFileUpload={Boolean(enableFileUpload)}
        enableVoiceInput={Boolean(enableVoiceInput)}
        loading={loading}
        setLoading={setLoading}
        showOverrideSwitchesCSV={showOverrideSwitchesCSV}
        showResetConversation={Boolean(
          process.env.NEXT_PUBLIC_AGIXT_SHOW_CONVERSATION_BAR !== 'true' &&
          process.env.NEXT_PUBLIC_AGIXT_CONVERSATION_MODE === 'uuid'
        )}
        {...props}
      />
    </>
  );
};

export default Chat;
