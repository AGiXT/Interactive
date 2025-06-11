'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipBasic, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/layout/toast';
import { cn } from '@/lib/utils';
import clipboardCopy from 'clipboard-copy';
import { getCookie } from 'cookies-next';
import { Loader2, Volume2 } from 'lucide-react';
import React, { useContext, useRef, useState } from 'react';
import { LuCopy, LuDownload, LuPen as LuEdit, LuGitFork, LuThumbsDown, LuThumbsUp, LuTrash2 } from 'react-icons/lu';
import { mutate } from 'swr';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { useAudioContext } from '@/components/conversation/Message/AudioContext';
import MessageDialog from '@/components/conversation/Message/Dialog';
import { ChatItem } from '@/components/conversation/Message/Message';

const ForwardedLuEdit = React.forwardRef<HTMLSpanElement, React.ComponentProps<typeof LuEdit>>((props, ref) => (
  <span ref={ref}>
    <LuEdit {...props} />
  </span>
));
ForwardedLuEdit.displayName = 'ForwardedLuEdit';

const ForwardedLuTrash2 = React.forwardRef<HTMLSpanElement, React.ComponentProps<typeof LuTrash2>>((props, ref) => (
  <span ref={ref}>
    <LuTrash2 {...props} />
  </span>
));
ForwardedLuTrash2.displayName = 'ForwardedLuTrash2';

export type MessageProps = {
  chatItem: { role: string; message: string; timestamp: string; rlhf?: { positive: boolean; feedback: string } };
  lastUserMessage: string;
  alternateBackground?: string;
  setLoading: (loading: boolean) => void;
};

export function MessageActions({
  chatItem,
  audios,
  formattedMessage,
  lastUserMessage,
  updatedMessage,
  setUpdatedMessage,
}: {
  chatItem: ChatItem;
  audios: { message: string; sources: string[] } | null;
  formattedMessage: string;
  lastUserMessage: string;
  updatedMessage: string;
  setUpdatedMessage: (value: string) => void;
}) {
  const state = useContext(InteractiveConfigContext);
  const { data: convData } = useConversations();
  const { toast } = useToast();
  const { setCurrentlyPlaying, stopAllAudio } = useAudioContext();
  const [vote, setVote] = useState(chatItem.rlhf ? (chatItem.rlhf.positive ? 1 : -1) : 0);
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const enableMessageEditing = process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING === 'true';
  const enableMessageDeletion = process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_DELETION === 'true';
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ttsAudioId = `tts-${chatItem.id}`;

  const handleTTS = async () => {
    if (!state.overrides?.conversation) return;

    setIsLoadingAudio(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/conversation/${state.overrides.conversation}/tts/${chatItem.id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `${getCookie('jwt')}`,
          } as HeadersInit,
        },
      );
      if (!response.ok) throw new Error('Failed to fetch audio');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      // Stop all other audio before playing TTS
      stopAllAudio();

      // Play audio automatically when loaded and set as currently playing
      if (audioRef.current) {
        audioRef.current.play();
        setCurrentlyPlaying(ttsAudioId);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate speech',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // Handle TTS audio events
  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setCurrentlyPlaying(null);
    };

    const handlePause = () => {
      setCurrentlyPlaying(null);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioUrl, setCurrentlyPlaying]);

  return (
    <div className={cn('flex', chatItem.role === 'USER' && 'justify-end items-center')}>
      {(audios?.message?.trim() || !audios) && (
        <>
          {chatItem.role !== 'USER' && process.env.NEXT_PUBLIC_AGIXT_RLHF === 'true' && (
            <>
              <TooltipBasic title='Provide Positive Feedback'>
                <div className='inline-flex'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => {
                      setVote(1);
                      setOpen(true);
                    }}
                  >
                    <LuThumbsUp className={cn(vote === 1 && 'text-green-500')} />
                  </Button>
                </div>
              </TooltipBasic>
              <TooltipBasic title='Provide Negative Feedback'>
                <div className='inline-flex'>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => {
                      setVote(-1);
                      setOpen(true);
                    }}
                  >
                    <LuThumbsDown className={cn(vote === -1 && 'text-red-500')} />
                  </Button>
                </div>
              </TooltipBasic>
            </>
          )}
          {chatItem.role !== 'USER' && !audios && (
            <>
              {audioUrl ? (
                <audio ref={audioRef} controls className='h-8 w-32'>
                  <source src={audioUrl} type='audio/wav' />
                </audio>
              ) : (
                <TooltipBasic title='Speak Message'>
                  <div className='inline-flex'>
                    <Button variant='ghost' size='icon' onClick={handleTTS} disabled={isLoadingAudio}>
                      {isLoadingAudio ? <Loader2 className='h-4 w-4 animate-spin' /> : <Volume2 className='h-4 w-4' />}
                    </Button>
                  </div>
                </TooltipBasic>
              )}
            </>
          )}
          <TooltipBasic title='Fork Conversation'>
            <div className='inline-flex'>
              <Button
                variant='ghost'
                size='icon'
                onClick={async () => {
                  if (!state.overrides?.conversation) return;

                  try {
                    const response = await fetch(
                      `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/conversation/fork/${state.overrides.conversation}/${chatItem.id}`,
                      {
                        method: 'POST',
                        headers: {
                          Authorization: `${getCookie('jwt')}`,
                        } as HeadersInit,
                      },
                    );

                    if (!response.ok) throw new Error('Failed to fork conversation');

                    const data = await response.json();
                    toast({
                      title: 'Conversation Forked',
                      description: `New conversation created: ${data.message}`,
                    });
                    mutate('/conversations');
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: 'Failed to fork conversation',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <LuGitFork />
              </Button>
            </div>
          </TooltipBasic>
          <TooltipBasic title='Copy Message'>
            <div className='inline-flex'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => {
                  clipboardCopy(formattedMessage);
                  toast({
                    title: 'Message Copied',
                    description: 'Message has been copied to your clipboard.',
                  });
                }}
              >
                <LuCopy />
              </Button>
            </div>
          </TooltipBasic>
          <TooltipBasic title='Download Message'>
            <div className='inline-flex'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => {
                  const element = document.createElement('a');
                  const file = new Blob([formattedMessage], {
                    type: 'text/plain;charset=utf-8',
                  });
                  element.href = URL.createObjectURL(file);
                  element.download = `${chatItem.role}-${chatItem.timestamp}.md`;
                  document.body.appendChild(element);
                  element.click();
                }}
              >
                <LuDownload />
              </Button>
            </div>
          </TooltipBasic>
          {enableMessageEditing && (
            <TooltipBasic title='Edit Message'>
              <MessageDialog
                ButtonComponent={Button}
                ButtonProps={{
                  variant: 'ghost',
                  size: 'icon',
                  children: <ForwardedLuEdit />,
                }}
                title='Edit Message'
                onConfirm={async () => {
                  if (state.overrides?.conversation && convData) {
                    const conversation = convData.find((item) => item.id === state.overrides?.conversation);
                    if (conversation?.name) {
                      await state.agixt.updateConversationMessage(conversation.name, chatItem.id, updatedMessage);
                      mutate('/conversation/' + state.overrides.conversation);
                    }
                  }
                }}
                content={
                  <Textarea
                    value={updatedMessage}
                    onChange={(event) => {
                      setUpdatedMessage(event.target.value);
                    }}
                  />
                }
                className='w-[70%] max-w-none'
              />
            </TooltipBasic>
          )}
          {enableMessageDeletion && (
            <TooltipBasic title='Delete Message'>
              <MessageDialog
                ButtonComponent={Button}
                ButtonProps={{ variant: 'ghost', size: 'icon', children: <ForwardedLuTrash2 /> }}
                title='Delete Message'
                onConfirm={async () => {
                  if (state.overrides?.conversation && convData) {
                    const conversation = convData.find((item) => item.id === state.overrides?.conversation);
                    if (conversation?.name) {
                      await state.agixt.deleteConversationMessage(conversation.name, chatItem.id);
                      mutate('/conversation/' + state.overrides.conversation);
                    }
                  }
                }}
                content={`Are you sure you'd like to permanently delete this message from the conversation?`}
              />
            </TooltipBasic>
          )}
          {chatItem.rlhf && (
            <p className={cn('text-sm', chatItem.rlhf.positive ? 'text-green-500' : 'text-red-500')}>
              {chatItem.rlhf.feedback}
            </p>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Provide Feedback</DialogTitle>
                <DialogDescription>Please provide some feedback regarding the message.</DialogDescription>
              </DialogHeader>
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder='Your feedback here...' />
              <DialogFooter>
                <Button variant='outline' onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setOpen(false);
                    if (state.overrides?.conversation) {
                      if (vote === 1) {
                        state.agixt.addConversationFeedback(
                          true,
                          chatItem.role,
                          chatItem.id,
                          lastUserMessage,
                          feedback,
                          state.overrides.conversation,
                        );
                      } else {
                        state.agixt.addConversationFeedback(
                          false,
                          chatItem.role,
                          chatItem.id,
                          lastUserMessage,
                          feedback,
                          state.overrides.conversation,
                        );
                      }
                    }
                  }}
                >
                  Submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
