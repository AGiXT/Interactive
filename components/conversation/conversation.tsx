'use client';

import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import React, { useContext, useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { ChatSidebar } from './chat-sidebar';
import { useCompany } from '@/components/idiot/useUser';
import { toast } from '@/components/layout/toast';
import { UIProps } from '@/components/idiot/interactive/InteractiveAGiXT';
import { InteractiveConfigContext, Overrides } from '@/components/idiot/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/idiot/interactive/hooks/useConversation';
import { ChatBar } from '@/components/conversation/input/chat-input';
import { ChatLog } from '@/components/conversation/chat-log';

const conversationSWRPath = '/conversation/';
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
