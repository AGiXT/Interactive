'use client';

import { LuRefreshCw as AutorenewOutlined, LuInfo as Info, LuPencil as Pencil } from 'react-icons/lu';
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import formatDate from '@/components/conversation/Message/formatDate';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { FaRunning } from 'react-icons/fa';
import { Ban as Error, CircleCheck, TriangleAlert } from 'lucide-react';
import { TfiThought } from 'react-icons/tfi';
import { GiMirrorMirror } from 'react-icons/gi';
import { ClientIcon } from '@/components/ui/client-icon';

export const severities = {
  error: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <Error className='text-destructive' />
        </TooltipTrigger>
        <TooltipContent>Error</TooltipContent>
      </Tooltip>
    ),
    text: 'text-destructive',
    border: 'border-destructive',
  },

  info: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <Info className='text-info' />
        </TooltipTrigger>
        <TooltipContent>Information</TooltipContent>
      </Tooltip>
    ),
    text: 'text-info',
    border: 'border-info',
  },
  success: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <CircleCheck className='text-success' />
        </TooltipTrigger>
        <TooltipContent>Successful Activity</TooltipContent>
      </Tooltip>
    ),
    text: 'text-success',
    border: 'border-success',
  },
  warn: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <TriangleAlert className='text-warning' />
        </TooltipTrigger>
        <TooltipContent>Warning</TooltipContent>
      </Tooltip>
    ),
    text: 'text-warning',
    border: 'border-warning',
  },
  thought: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <TfiThought />
        </TooltipTrigger>
        <TooltipContent>Planned/Thought About an Activity</TooltipContent>
      </Tooltip>
    ),
    text: 'text-info',
    border: 'border-info',
  },
  reflection: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <GiMirrorMirror />
        </TooltipTrigger>
        <TooltipContent>Reflected on an Activity</TooltipContent>
      </Tooltip>
    ),
    text: 'text-info',
    border: 'border-info',
  },
  execution: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <FaRunning />
        </TooltipTrigger>
        <TooltipContent>Executed/Ran a Command</TooltipContent>
      </Tooltip>
    ),
    text: 'text-info',
    border: 'border-info',
  },
  diagram: {
    icon: (
      <Tooltip>
        <TooltipTrigger>
          <Pencil />
        </TooltipTrigger>
        <TooltipContent>Drew a Diagram</TooltipContent>
      </Tooltip>
    ),
    text: 'text-info',
    border: 'border-info',
  },
};

export function getTimeDifference(timestamp1: string | Date, timestamp2: string | Date) {
  // Convert timestamps to Date objects
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);

  // Calculate the difference in milliseconds
  const diffInMs = Math.abs(date1.getTime() - date2.getTime());

  // Convert milliseconds to seconds
  const diffInSeconds = Math.floor(diffInMs / 1000);
  if (diffInSeconds === 0) return '<1s';

  // Calculate minutes and seconds
  const minutes = Math.floor(diffInSeconds / 60);
  const seconds = diffInSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;

  return `${minutes}m ${seconds}s`;
}

export type ActivityProps = {
  activityType: 'error' | 'info' | 'success' | 'warn' | 'thought' | 'reflection' | 'execution' | 'diagram';
  message: string;
  alternateBackground?: string;
  timestamp: string;
  nextTimestamp?: string;
  children?: any[];
};

// Extend dayjs with plugins
dayjs.extend(timezone);
dayjs.extend(utc);

export function Activity({
  message,
  activityType,
  alternateBackground = 'primary',
  timestamp,
  nextTimestamp,
  children,
}: ActivityProps): ReactNode {
  // const [dots, setDots] = useState<string>('');
  const title = useMemo(() => message.split('\n')[0].replace(/:$/, ''), [message]).trim();
  const body = useMemo(() => message.split('\n').slice(1).join('\n'), [message]).trim();
  const [currentTime, setCurrentTime] = useState(new Date().toISOString());
  const rootStyles = 'p-2.5 overflow-hidden flex gap-2';

  // Update current time every second for live timer when activity is still running
  useEffect(() => {
    if (!nextTimestamp && activityType !== 'info') {
      const interval = setInterval(() => {
        setCurrentTime(new Date().toISOString());
      }, 1000); // Update every 1000ms (1 second)
      return () => clearInterval(interval);
    }
  }, [nextTimestamp, activityType]);

  const rootChildren = (
    <Tooltip>
      <TooltipTrigger asChild>
        {body ? (
          <Accordion type='single'>
            <AccordionItem value='an-item'>
              <AccordionTrigger
                className={`${rootStyles} agixt-activity agixt-activity-${activityType.toLocaleLowerCase()} text-foreground flex items-center cursor-pointer justify-start gap-2`}
              >
                <div className='flex items-center justify-between gap-2 m-w-40'>
                  {activityType !== 'info' && !nextTimestamp ? (
                    <ClientIcon icon={AutorenewOutlined} className='animate-spin text-primary' />
                  ) : (
                    severities[activityType].icon
                  )}
                  {activityType !== 'info' && (
                    <div className='whitespace-nowrap'>{getTimeDifference(timestamp, nextTimestamp || currentTime)}</div>
                  )}
                  <div className={`mx-1 w-1 h-4 border-l-2`} />
                </div>

                <MarkdownBlock content={title /*+ (!nextTimestamp ? dots : '')*/} />
              </AccordionTrigger>
              <AccordionContent>
                <MarkdownBlock content={body} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : (
          <div
            className={`${rootStyles} agixt-activity text-foreground flex items-center justify-start cursor-pointer gap-2`}
          >
            <div className='flex items-center justify-between gap-2 m-w-40'>
              {activityType !== 'info' && !nextTimestamp ? (
                <ClientIcon icon={AutorenewOutlined} className='animate-spin text-primary' />
              ) : (
                severities[activityType].icon
              )}
              {activityType !== 'info' && (
                <div className='whitespace-nowrap'>{getTimeDifference(timestamp, nextTimestamp || currentTime)}</div>
              )}
              <div className={`mx-1 w-1 h-4 border-l-2`} />
            </div>

            <MarkdownBlock content={title /* + (!nextTimestamp ? dots : '')*/} />
          </div>
        )}
      </TooltipTrigger>
      <TooltipContent side='bottom' align='start' className='ml-3 mb-7'>
        {formatDate(timestamp, false)}
      </TooltipContent>
    </Tooltip>
  );

  if (!children || children.length <= 0) return rootChildren;

  console.log('🔍 Activity with children rendering accordion:', {
    activityMessage: message.substring(0, 50) + '...',
    childrenCount: children.length,
    childrenData: children.map((child) => ({
      id: child.id,
      message: child.message.substring(0, 50) + '...',
      timestamp: child.timestamp,
    })),
  });

  return (
    <div className={`w-full border-t border-border ${alternateBackground === 'primary' ? 'bg-primary/10' : ''}`}>
      <Accordion type='single'>
        <AccordionItem value='item-1' className='border-b-0'>
          <AccordionTrigger
            className={cn(
              rootStyles,
              'w-full flex justify-start items-center px-0 py-2.5 border-b border-border hover:no-underline',
            )}
          >
            {rootChildren}
          </AccordionTrigger>
          <AccordionContent className='pl-4 border-b-0 bg-muted/30 border-l-2 border-l-primary/20 ml-2'>
            {children?.map((child, index) => {
              const messageType = child.message.split(' ')[0];
              const messageBody = child.message.substring(child.message.indexOf(' '));

              // Calculate proper nextTimestamp for child activities
              const getChildNextTimestamp = () => {
                // If there's a next child, use its timestamp
                if (index < children.length - 1) {
                  return children[index + 1].timestamp;
                }
                
                // If this is the last child, we need to provide a reasonable completion time
                // Don't let it fall back to currentTime as that creates inflated durations
                
                if (nextTimestamp) {
                  const timeDiff = new Date(nextTimestamp).getTime() - new Date(child.timestamp).getTime();
                  // If parent's nextTimestamp is reasonable (within 60 seconds), use it
                  if (timeDiff <= 60000 && timeDiff > 0) {
                    return nextTimestamp;
                  }
                }
                
                // For any other case, use a small offset from this child's timestamp
                // This ensures the subactivity shows a reasonable duration, not an inflated one
                const childTime = new Date(child.timestamp).getTime();
                const completionTime = new Date(childTime + 2000); // Add 2 seconds
                return completionTime.toISOString();
              };

              return (
                <Activity
                  key={child.timestamp + '-' + messageBody}
                  activityType={
                    messageType.startsWith('[SUBACTIVITY]') && !messageType.split('[')[3]
                      ? 'success'
                      : (messageType
                          .split('[')
                          [messageType.startsWith('[SUBACTIVITY]') ? 3 : 2].split(']')[0]
                          .toLowerCase() as
                          | 'error'
                          | 'info'
                          | 'success'
                          | 'warn'
                          | 'thought'
                          | 'reflection'
                          | 'execution'
                          | 'diagram')
                  }
                  message={messageBody}
                  nextTimestamp={getChildNextTimestamp()}
                  timestamp={child.timestamp}
                  alternateBackground={alternateBackground}
                  children={child.children}
                />
              );
            })}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
