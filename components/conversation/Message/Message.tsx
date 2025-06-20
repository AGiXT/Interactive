'use client';

import React, { useState, useMemo, useRef } from 'react';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import formatDate from '@/components/conversation/Message/formatDate';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageActions } from '@/components/conversation/Message/Actions';
import AudioPlayer from '@/components/conversation/Message/Audio';
import TimeAgo, { FormatStyleName } from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
import { useCompany } from '@/components/interactive/useUser';

TimeAgo.addDefaultLocale(en);

const timeAgo = new TimeAgo('en-US');

export const formatTimeAgo = (date: Date | string, style: FormatStyleName = 'twitter'): string => {
  if (!date) return '';
  try {
    const parsedDate = typeof date === 'string' ? new Date(date) : date;
    return timeAgo.format(parsedDate, style);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

export type ChatItem = {
  id: string;
  role: string;
  message: string;
  timestamp: string;
  children?: any[];
  rlhf?: {
    positive: boolean;
    feedback: string;
  };
};
export type MessageProps = {
  chatItem: ChatItem;
  lastUserMessage: string;
  alternateBackground?: string;
  setLoading: (loading: boolean) => void;
};

const checkUserMsgJustText = (chatItem: { role: string; message: string }) => {
  if (chatItem.role !== 'USER') return false;

  const message = chatItem.message;
  const hasMarkdownTable = /\n\|.*\|\n(\|-+\|.*\n)?/.test(message);
  return !(
    message.includes('```') ||
    message.includes('`') ||
    message.includes('![') ||
    (message.includes('[') && message.includes('](')) ||
    hasMarkdownTable
  );
};

export default function Message({ chatItem, lastUserMessage, setLoading }: MessageProps): React.JSX.Element {
  const [updatedMessage, setUpdatedMessage] = useState(chatItem.message);
  const { data: company } = useCompany();
  const isChild = company?.roleId === 4;

  const formattedMessage = useMemo(() => {
    let formatted = chatItem.message;
    try {
      const parsed = JSON.parse(chatItem.message);
      formatted = (parsed.text || chatItem.message).replace('\\n', '\n');
    } catch (e) {
      // If parsing fails, use original message
    }
    return formatted;
  }, [chatItem]);

  const audios = useMemo(() => {
    if (
      !chatItem?.message ||
      typeof chatItem.message !== 'string' ||
      !chatItem.message.includes('<audio controls><source src=')
    ) {
      return null;
    }

    const matches = [...chatItem.message.matchAll(/<audio controls><source src="([^"]+)" type="audio\/wav"><\/audio>/g)];
    const audioSources = matches.map((match) => match[1]);
    return {
      message: chatItem.message.replaceAll(/<audio controls><source src="[^"]+" type="audio\/wav"><\/audio>/g, ''),
      sources: audioSources,
    };
  }, [chatItem]);
  const isUserMsgJustText = checkUserMsgJustText(chatItem);

  return (
    <div
      className={cn(
        'm-3 overflow-hidden flex flex-col gap-2 min-w-0 max-w-full',
        isUserMsgJustText && 'max-w-[60%] self-end',
      )}
    >
      {audios && audios.sources.length > 0 ? (
        <>
          {audios.message?.trim() && (
            <MarkdownBlock
              content={audios.message}
              chatItem={{ ...chatItem, message: audios.message }}
              setLoading={setLoading}
            />
          )}
          {audios.sources.map((src) => (
            <AudioPlayer key={src} src={src} />
          ))}
        </>
      ) : (
        <div
          className={
            chatItem.role === 'USER'
              ? 'chat-log-message-user bg-primary rounded-3xl py-1 rounded-br-none px-5 text-primary-foreground overflow-hidden'
              : 'chat-log-message-ai p-0 pt-2 text-foreground overflow-hidden'
          }
        >
          <MarkdownBlock content={formattedMessage} chatItem={chatItem} setLoading={setLoading} />
        </div>
      )}

      <div className={cn('flex items-center flex-wrap', chatItem.role === 'USER' && 'flex-row-reverse')}>
        <TimeStamp chatItem={chatItem} />

        {!isChild && (
          <MessageActions
            chatItem={chatItem}
            audios={audios}
            formattedMessage={formattedMessage}
            lastUserMessage={lastUserMessage}
            updatedMessage={updatedMessage}
            setUpdatedMessage={setUpdatedMessage}
          />
        )}
      </div>
    </div>
  );
}

export function TimeStamp({ chatItem }: { chatItem: { role: string; timestamp: string } }) {
  const [open, setOpen] = useState(false);

  if (chatItem.timestamp === '') return null;
  const roleLabel = chatItem.role === 'USER' ? 'You' : chatItem.role;
  const timeAgo = formatTimeAgo(chatItem.timestamp);
  const date = formatDate(chatItem.timestamp, false);

  return (
    <p className='flex gap-1 text-sm text-muted-foreground whitespace-nowrap'>
      <span className='inline font-bold text-muted-foreground'>{roleLabel}</span>•
      <TooltipProvider>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <button
              type='button'
              onClick={() => setOpen(true)}
              className='text-left cursor-pointer'
              aria-label='Show full timestamp'
            >
              {timeAgo}
            </button>
          </TooltipTrigger>
          <TooltipContent>{date}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </p>
  );
}
