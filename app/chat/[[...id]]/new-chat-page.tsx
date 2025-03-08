'use client';

import { useRouter } from 'next/navigation';
import { getCookie } from 'cookies-next';
import axios from 'axios';
import { NewChatInterface } from '@/components/interactive/Chat/NewChatInterface';
import { useState } from 'react';
import { toast } from '@/hooks/useToast';

export default function NewChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleNewChat = async (message: string | object, uploadedFiles: Record<string, string> = {}) => {
    setLoading(true);
    try {
      // Format the message for the API
      const messages = [{
        role: 'user',
        content: [
          { 
            type: 'text', 
            text: typeof message === 'string' ? message : '' 
          },
          ...Object.entries(uploadedFiles).map(([fileName, fileContent]) => ({
            type: `${fileContent.split(':')[1].split('/')[0]}_url`,
            file_name: fileName,
            [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
              url: fileContent,
            },
          })),
          ...(typeof message === 'object' ? [message] : [])
        ],
      }];

      // Send the message to create a new chat
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages,
          model: getCookie('agixt-agent'),
          user: '-', // New conversation
        },
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        }
      );

      if (response.status === 200) {
        // Navigate to the new chat conversation
        router.push(`/chat/${response.data.id}`);
      } else {
        throw new Error('Failed to create new chat');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create new chat conversation',
        duration: 5000,
      });
      console.error('New chat error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <NewChatInterface
        onNewChat={handleNewChat}
        loading={loading}
      />
    </div>
  );
}