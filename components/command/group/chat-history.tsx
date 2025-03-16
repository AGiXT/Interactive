'use client';

import dayjs from 'dayjs';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCommandMenu } from '../command-menu-context';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';

interface Conversation {
  id: string;
  name: string;
  updatedAt: string;
  summary?: unknown;
}

export function ChatHistoryGroup() {
  const router = useRouter();
  const state = useContext(InteractiveConfigContext);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setOpen, currentSubPage } = useCommandMenu();

  useEffect(() => {
    const fetchConversations = async () => {
      if (!state?.agixt) return;

      try {
        setIsLoading(true);
        const conversationData = await state.agixt.getConversations(true);
        const formattedConversations = conversationData.map(conv => ({
          id: conv.id || conv.conversation_name,
          name: conv.conversation_name,
          updatedAt: new Date().toISOString(), // The SDK doesn't provide updatedAt, so we use current time
          summary: conv.conversation_name
        }));
        setConversations(formattedConversations);
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [state?.agixt]);

  const onSelect = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
      setOpen(false);
    },
    [router, setOpen],
  );

  if (currentSubPage !== 'chat-history') return null;

  if (!conversations.length || isLoading) return null;

  // Filter out conversations with name '-' and take only the first 5
  const recentConversations = conversations.filter((conversation) => conversation.name !== '-').slice(0, 5);

  return (
    <CommandGroup heading='Recent Chats'>
      {recentConversations.map((conversation) => (
        <CommandItem
          key={conversation.id}
          onSelect={() => onSelect(conversation.id)}
          keywords={['chat', 'history', 'recent', 'conversation', JSON.stringify(conversation.summary)]}
        >
          <div className='flex justify-between w-full'>
            <span>{conversation.name}</span>
            <span className='text-xs text-muted-foreground'>{dayjs(conversation.updatedAt).format('MMM DD')}</span>
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
