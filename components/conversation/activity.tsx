'use client';

import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { Ban as Error, CircleCheck, TriangleAlert, ChevronRight, Copy, Check } from 'lucide-react';
import { LuRefreshCw as AutorenewOutlined, LuInfo as Info, LuPencil as Pencil } from 'react-icons/lu';
import { FaRunning } from 'react-icons/fa';
import { TfiThought } from 'react-icons/tfi';
import { GiMirrorMirror } from 'react-icons/gi';
import MarkdownBlock from '@/components/conversation/Message/MarkdownBlock';
import formatDate from '@/components/conversation/Message/formatDate';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Type definitions
interface ActivityChild {
  id?: string;
  message: string;
  timestamp: string;
  nextTimestamp?: string;
  children?: ActivityChild[];
}

type ActivityType = 'error' | 'info' | 'success' | 'warn' | 'thought' | 'reflection' | 'execution' | 'diagram';

// Constants
const BORDER_INFO = 'border-info';

// Modern Activity Component for Subactivities
function ModernSubactivity({
  activityChildren,
  isRunning,
  parentTitle,
  totalSubactivities,
  completedSubactivities,
}: {
  activityChildren: ActivityChild[];
  isRunning: boolean;
  parentTitle: string;
  totalSubactivities: number;
  completedSubactivities: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Function to clean the message content
  const getCleanContent = (message: string): string => {
    // Remove the [SUBACTIVITY] prefix and any bracketed metadata
    const messageBody = message.substring(message.indexOf(' '));
    // Remove any remaining [TYPE] brackets at the start
    return messageBody.replace(/^\[[^\]]+]\s*/, '').trim();
  };

  return (
    <div className='w-full bg-gradient-to-br from-background/60 to-muted/30 border border-border/30 rounded-2xl p-4 backdrop-blur-md shadow-sm my-2'>
      {/* Header */}
      <div className='flex items-center gap-3 mb-4 opacity-100 animate-fade-in'>
        <div className='flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20'>
          {isRunning ? (
            <div className='w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin' />
          ) : (
            <CircleCheck className='w-4 h-4 text-primary' />
          )}
        </div>
        <div className='flex flex-col flex-1'>
          <div className='text-sm font-medium text-foreground/90'>{parentTitle}</div>
          <div className='text-xs text-muted-foreground/80 flex items-center gap-1.5'>
            <span className='bg-primary/10 text-primary/90 px-2 py-0.5 rounded-full text-xs font-medium'>
              {completedSubactivities}/{totalSubactivities}
            </span>
            <span className='text-muted-foreground/50'>•</span>
            <span>{activityChildren.length} steps</span>
          </div>
        </div>
      </div>

      {/* Status Items - Only show when expanded */}
      {isExpanded && (
        <div className='space-y-3'>
          {activityChildren.map((child, index) => {
            const messageBody = child.message.substring(child.message.indexOf(' '));
            // Better completion detection: check if it has nextTimestamp OR if we're not on the last running item
            const isCompleted = Boolean(child.nextTimestamp) || !isRunning || index < activityChildren.length - 1;
            const isCurrentlyRunning = !isCompleted && isRunning;
            
            const getAnimationDelay = (idx: number) => {
              const delays = [
                'animation-delay-100',
                'animation-delay-200',
                'animation-delay-300',
                'animation-delay-400',
                'animation-delay-500',
              ];
              return delays[Math.min(idx, delays.length - 1)];
            };

            return (
              <div
                key={`${child.timestamp}-${child.message.slice(0, 20)}`}
                className={cn(
                  'group flex items-start gap-3 opacity-0 animate-slide-in-from-left rounded-xl p-3 transition-all duration-200 hover:bg-gradient-to-r hover:from-muted/10 hover:to-muted/5',
                  getAnimationDelay(index),
                  isCurrentlyRunning
                    ? 'bg-gradient-to-r from-primary/5 to-primary/10 border-l-2 border-primary/30'
                    : 'bg-gradient-to-r from-muted/20 to-muted/10 border-l-2 border-muted-foreground/20',
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm transition-all duration-200',
                    isCompleted
                      ? 'bg-gradient-to-br from-primary/20 to-primary/30 border border-primary/40 shadow-primary/20'
                      : isCurrentlyRunning
                        ? 'bg-gradient-to-br from-primary/20 to-primary/30 border border-primary/40 shadow-primary/20'
                        : 'bg-gradient-to-br from-muted/30 to-muted/40 border border-muted-foreground/30',
                  )}
                >
                  {isCompleted ? (
                    <span className='text-primary font-semibold text-xs'>✓</span>
                  ) : isCurrentlyRunning ? (
                    <div className='w-2.5 h-2.5 border-2 border-primary/50 border-t-primary rounded-full animate-spin' />
                  ) : (
                    <div className='w-2 h-2 rounded-full bg-muted-foreground/50' />
                  )}
                </div>
                <div className='text-xs leading-relaxed text-foreground/85 flex-1'>
                  <MarkdownBlock content={messageBody.trim()} />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => copyToClipboard(getCleanContent(child.message), index)}
                      className='opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 w-6 p-0 hover:bg-muted/50 rounded-md'
                    >
                      {copiedIndex === index ? (
                        <Check className='w-3 h-3 text-green-600' />
                      ) : (
                        <Copy className='w-3 h-3 text-muted-foreground' />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side='top' className='text-xs'>
                    {copiedIndex === index ? 'Copied!' : 'Copy content'}
                  </TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}

      {/* Current Task (for running activities) */}
      {isRunning && !isExpanded && (
        <div className='mt-4 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl border border-primary/20 shadow-sm'>
          <div className='text-xs text-primary/80 mb-1 font-medium'>Current focus:</div>
          <div className='text-xs text-foreground/80 italic flex items-center gap-1'>
            <span>Processing next step</span>
            <div className='flex space-x-0.5'>
              <div className='w-1 h-1 bg-primary/60 rounded-full animate-bounce' />
              <div className='w-1 h-1 bg-primary/60 rounded-full animate-bounce' style={{ animationDelay: '0.1s' }} />
              <div className='w-1 h-1 bg-primary/60 rounded-full animate-bounce' style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <Button
        variant='ghost'
        size='sm'
        onClick={() => setIsExpanded(!isExpanded)}
        className='mt-3 text-muted-foreground/70 text-xs flex items-center gap-1.5 h-8 px-3 hover:text-foreground hover:bg-muted/50 transition-all duration-200 rounded-xl border border-transparent hover:border-border/50'
      >
        <ChevronRight className={cn('w-3 h-3 transition-transform duration-200', isExpanded && 'rotate-90')} />
        <span className='font-medium'>
          {isExpanded ? 'Hide subactivities' : `Show ${activityChildren.length} subactivities`}
        </span>
      </Button>
    </div>
  );
}

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
    border: BORDER_INFO,
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
    border: BORDER_INFO,
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
    border: BORDER_INFO,
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
    border: BORDER_INFO,
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
    border: BORDER_INFO,
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
  activityType: ActivityType;
  message: string;
  timestamp: string;
  nextTimestamp?: string;
  children?: ActivityChild[];
};

// Extend dayjs with plugins
dayjs.extend(timezone);
dayjs.extend(utc);

export function Activity({ message, activityType, timestamp, nextTimestamp, children }: ActivityProps): ReactNode {
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
                    <AutorenewOutlined className='animate-spin text-primary' />
                  ) : (
                    severities[activityType as keyof typeof severities].icon
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
                <AutorenewOutlined className='animate-spin text-primary' />
              ) : (
                severities[activityType as keyof typeof severities].icon
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

  console.log('🔍 Activity with children rendering modern style:', {
    activityMessage: message.substring(0, 50) + '...',
    childrenCount: children.length,
    childrenData: children.map((child) => ({
      id: child.id,
      message: child.message.substring(0, 50) + '...',
      timestamp: child.timestamp,
    })),
  });

  // Calculate completion status
  const completedSubactivities = nextTimestamp
    ? children.length
    : Math.max(0, children.filter((child) => child.nextTimestamp).length);

  return (
    <ModernSubactivity
      activityChildren={children}
      isRunning={!nextTimestamp}
      parentTitle={title}
      totalSubactivities={children.length}
      completedSubactivities={completedSubactivities}
    />
  );
}
