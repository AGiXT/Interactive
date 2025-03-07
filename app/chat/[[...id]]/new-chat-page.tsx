'use client';

import React from 'react';
import { NewChatInterface } from '@/components/interactive/Chat/NewChatInterface';
import { InteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { useRouter } from 'next/navigation';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import log from '@/components/jrg/next-log/log';
import { toast } from '@/hooks/useToast';
import { mutate } from 'swr';

interface MessageContent {
  type: string;
  text: string;
}

interface FileContent {
  type: string;
  file_name: string;
  [key: string]: string | { url: string };
}

type MessagePart = MessageContent | FileContent;

export default function NewChatPage() {
  const [messages, setMessages] = React.useState<Array<{
    role: 'user' | 'assistant';
    content: string;
  }>>([]);
  const [loading, setLoading] = React.useState(false);
  const state = React.useContext<InteractiveConfig>(InteractiveConfigContext);
  const router = useRouter();

  const handleSendMessage = async (message: string | object, uploadedFiles?: Record<string, string>): Promise<void> => {
    try {
      const messageContent: MessagePart[] = [
        { type: 'text', text: typeof message === 'string' ? message : JSON.stringify(message) }
      ];

      if (uploadedFiles) {
        Object.entries(uploadedFiles).forEach(([fileName, fileContent]) => {
          const fileType = fileContent.split(':')[1].split('/')[0];
          messageContent.push({
            type: `${fileType}_url`,
            file_name: fileName,
            [`${fileType}_url`]: {
              url: fileContent
            }
          });
        });
      }

      const messages = [{
        role: 'user',
        content: messageContent
      }];

      setLoading(true);
      const toOpenAI = {
        messages,
        model: getCookie('agixt-agent'),
        user: state?.overrides?.conversation ?? '-',
      };

      log(['Sending message: ', toOpenAI], { client: 1 });
      
      const completionResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        toOpenAI,
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (completionResponse?.status === 200) {
        const chatCompletion = completionResponse.data;
        const newConversationId = chatCompletion.id;

        // Update state with new conversation ID
        if (state?.mutate) {
          await state.mutate((oldState: InteractiveConfig) => ({
            ...oldState,
            overrides: {
              ...oldState.overrides,
              conversation: newConversationId,
            },
          }));
        }

        // Handle conversation renaming if needed
        if (state?.overrides?.conversation === '-' && state?.agixt) {
          await state.agixt.renameConversation(state.agent, newConversationId);
          await mutate('/conversation');
        }

        // Navigate to the chat page with the new conversation ID
        window.location.href = `/chat/${newConversationId}`;
      } else {
        throw new Error('Failed to get response from agent');
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen">
      <NewChatInterface
        messages={messages}
        onSendMessage={handleSendMessage}
        loading={loading}
        className="flex-1"
      />
    </main>
  );
}