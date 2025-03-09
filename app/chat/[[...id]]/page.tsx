'use client';

import { getCookie } from 'cookies-next';
import { NewChatInterface } from '@/components/interactive/Chat/NewChatInterface';
import ConvSwitch from './ConvSwitch';
import Chat from '@/components/interactive/Chat/Chat';
import { useRouter } from 'next/navigation';

export default function Home({ params }: { params: { id: string } }) {
  const router = useRouter();

  const handleNewChat = async (message: string | object, uploadedFiles?: Record<string, string>): Promise<void> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getCookie('jwt') || '',
        },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: message.toString() },
              ...(uploadedFiles ? Object.entries(uploadedFiles).map(([fileName, fileContent]) => ({
                type: `${fileContent.split(':')[1].split('/')[0]}_url`,
                file_name: fileName,
                [`${fileContent.split(':')[1].split('/')[0]}_url`]: {
                  url: fileContent,
                },
              })) : []),
            ],
          }],
          model: getCookie('agixt-agent'),
          user: params.id || '-',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/chat/${data.id}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <>
      <ConvSwitch id={params.id ? params.id : '-'} />
      {params.id ? (
        <Chat />
      ) : (
        <NewChatInterface onNewChat={handleNewChat} />
      )}
    </>
  );
}
