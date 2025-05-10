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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  return (
    <div className='flex flex-col-reverse flex-grow overflow-auto bg-background pb-28' style={{ flexBasis: '0px' }}>
      <div className='flex flex-col h-min'>
        {conversation.length > 0 && conversation.map ? (
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
              >
                {chatItem.children}
              </ChatActivity>
            ) : (
              <Message
                key={chatItem.timestamp + '-' + messageBody}
                // @ts-expect-error - chatItem is expected in the Message component but not properly typed
                chatItem={{
                  id: chatItem.timestamp, // Use timestamp as id since it's always present
                  role: chatItem.role,
                  message: messageBody,
                  timestamp: chatItem.timestamp,
                }}
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

export async function getAndFormatConversation(state: any): Promise<any[]> {
  const formattedConversation: any[] = [];
  const activityMessages: Record<string, any> = {};
  
  // Fetch the raw conversation data
  const rawConversation = await state.agixt.getConversation('', state.overrides.conversation);
  
  // First pass: add all messages to the conversation
  rawConversation.forEach((message: any) => {
    // Special handling for activity messages
    if (
      message.message.startsWith('[ACTIVITY]') ||
      message.message.startsWith('[SUBACTIVITY]')
    ) {
      formattedConversation.push({ ...message, children: [] });
      activityMessages[message.id] = formattedConversation[formattedConversation.length - 1];
    } else if (message.role === 'user' || message.role === 'assistant') {
      formattedConversation.push({ ...message, children: [] });
    }
  });
  
  // Second pass: organize child activities under their parents
  rawConversation.forEach((currentMessage: any) => {
    try {
      // Check if the message is a child activity
      if (currentMessage.message.startsWith('[SUBACTIVITY')) {
        // Try to extract parent ID
        const messageType = currentMessage.message.split(' ')[0];
        if (messageType.includes('[') && messageType.split('[').length > 2) {
          const parent = messageType.split('[')[2].split(']')[0];
          
          // Add to parent if it exists
          if (activityMessages[parent]) {
            activityMessages[parent].children.push({ ...currentMessage, children: [] });
          } else {
            // Try to find parent in children
            let foundParent = false;
            for (const activity of formattedConversation) {
              const targetInChildren = activity.children.find((child: any) => child.id === parent);
              if (targetInChildren) {
                targetInChildren.children.push({ ...currentMessage, children: [] });
                foundParent = true;
                break;
              }
            }
            
            // If no parent found, add to the last activity
            if (!foundParent && formattedConversation.length > 0) {
              const lastActivity = formattedConversation[formattedConversation.length - 1];
              lastActivity.children.push({ ...currentMessage, children: [] });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
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
  const state = useContext(InteractiveConfigContext);
  const { data: conversations } = useConversations();
  const router = useRouter();

  // Find the current conversation
  const conversation = useSWR(
    state?.overrides?.conversation ? conversationSWRPath + state.overrides.conversation : null,
    async () => {
      return await getAndFormatConversation(state);
    },
    {
      fallbackData: [],
      refreshInterval: loading ? 1000 : 0,
    },
  );
  
  // Check if the conversation is empty
  const isEmptyConversation = conversation.data?.length === 0;
  
  const { data: activeCompany } = useCompany();
  
  useEffect(() => {
    if (state?.overrides && Array.isArray(state.overrides.conversation)) {
      state.mutate?.((oldState) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: oldState.overrides.conversation[0] },
      }));
    }
  }, [state?.overrides?.conversation, state]);
  
  async function chat(messageTextBody: string | object, messageAttachedFiles?: { [x: string]: string }): Promise<string> {
    const messages = [];

    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: messageTextBody },
        ...(messageAttachedFiles ? Object.entries(messageAttachedFiles).map(([fileName, fileContent]: [string, string]) => ({
          type: `${fileContent.split(':')[1].split('/')[0]}_url`,
          file_name: fileName,
          [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
            url: fileContent,
          },
        })) : []),
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
      mutate(conversationSWRPath + state.overrides.conversation);
    }
    try {
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages: messages,
          model: getCookie('agixt-agent'),
          user: state?.overrides?.conversation || '-',
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
        if (state?.mutate) {
          state.mutate((oldState: any) => ({
            ...oldState,
            overrides: {
              ...oldState.overrides,
              conversation: conversationId,
            },
          }));
        }

        // Push route after state is updated
        router.push(`/chat/${conversationId}`);

        // Refresh data after updating conversation
        setLoading(false);

        // Trigger proper mutations
        mutate(conversationSWRPath + conversationId);
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

  useEffect(() => {
    if (state?.overrides?.conversation) {
      mutate(conversationSWRPath + state.overrides.conversation);
    }
  }, [state?.overrides?.conversation, state]);

  useEffect(() => {
    if (!loading && state?.overrides?.conversation) {
      const timer = setTimeout(() => {
        mutate(conversationSWRPath + state.overrides.conversation);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, state?.overrides?.conversation, state]);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  return (
    <>
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
        isEmptyConversation={isEmptyConversation}
      />
    </>
  );
}