'use client';

import React from 'react';
import { NewChatInterface } from '@/components/interactive/Chat/NewChatInterface';
import { InteractiveConfig, InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import log from '@/components/jrg/next-log/log';
import { toast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';

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
      setLoading(true);

      // Format message content
      const messageContent: MessagePart[] = [
        { type: 'text', text: typeof message === 'string' ? message : JSON.stringify(message) }
      ];

      // Add file attachments if any
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

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages: [{
            role: 'user',
            content: messageContent
          }],
          model: getCookie('agixt-agent'),
          user: '-', // Always start with new conversation
        },
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        },
      );

      if (response?.status === 200 && response.data) {
        const { id: newConversationId } = response.data;

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

        // Navigate to regular chat interface with the new conversation
        router.push(`/chat/${newConversationId}`);
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