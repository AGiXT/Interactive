'use client';

import React from 'react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import {
  LightbulbIcon,
  Paperclip,
  Search,
  Send,
} from 'lucide-react';
import { Textarea } from '../../../components/ui/textarea';
import { useUser } from '../../../components/idiot/auth/hooks/useUser';
import { VoiceRecorder } from './VoiceRecorder';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
}

interface NewChatInterfaceProps {
  onNewChat: (message: string | object, uploadedFiles?: Record<string, string>) => Promise<void>;
  loading?: boolean;
  className?: string;
}

function useTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function NewChatInterface({
  onNewChat,
  loading = false,
  className = '',
}: NewChatInterfaceProps) {
  const [input, setInput] = React.useState('');
  const [mounted, setMounted] = React.useState(false);
  const greeting = useTimeBasedGreeting();
  const { data: user } = useUser();

  const handleVoiceInput = async (message: string | object, uploadedFiles?: Record<string, string>) => {
    await onNewChat(message, uploadedFiles);
  };

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      const messageText = input.trim();
      setInput('');
      try {
        await onNewChat(messageText);
      } catch (error) {
        console.error('Failed to send message:', error);
        setInput(messageText); // Restore input on error
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <div className={cn(
      'relative flex h-full flex-col items-center transition-opacity duration-500',
      mounted ? 'opacity-100' : 'opacity-0',
      className
    )}>
      {/* Input area in the middle with greeting above */}
      <div className={cn(
        "w-full max-w-[900px] px-4",
        "mt-[45vh]"
      )}>
        {/* Greeting with more space and larger text */}
        <div className={cn(
          "text-center mb-12 transition-all duration-500 delay-300 user-greeting",
          mounted ? "transform translate-y-0 opacity-100" : "transform -translate-y-4 opacity-0"
        )}>
          <h2 className="text-3xl font-semibold tracking-tight">
            {greeting}, {user?.firstName || 'there'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="relative mb-4">
          <div className={cn(
            "flex items-start space-x-2 transition-all duration-500 delay-500",
            mounted ? "transform translate-y-0 opacity-100" : "transform translate-y-4 opacity-0"
          )}>
            <div className="relative flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={loading ? "Sending message..." : "Type your message..."}
                className="min-h-[140px] w-full resize-none rounded-xl pl-5 pr-14 py-5 border-2 focus-visible:ring-1 text-base"
                disabled={loading}
              />

              {/* Left side buttons */}
              <div className="absolute bottom-3.5 left-3.5 flex items-center gap-2">
                <Button variant="ghost" size="icon" type="button" className="h-9 w-9" disabled={loading}>
                  <Paperclip className="h-[18px] w-[18px]" />
                </Button>
                <VoiceRecorder 
                  onSend={handleVoiceInput}
                  disabled={loading}
                />
              </div>

              {/* Right side buttons */}
              <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2.5">
                <div className="flex gap-2.5">
                  <Button
                    variant="ghost"
                    className="h-9 w-9 overflow-hidden whitespace-nowrap transition-all duration-200 hover:w-[105px] relative"
                    disabled={loading}
                  >
                    <Search className="h-[18px] w-[18px] absolute left-2.5" />
                    <span className="absolute left-9">Web Search</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 w-9 overflow-hidden whitespace-nowrap transition-all duration-200 hover:w-[120px] relative"
                    disabled={loading}
                  >
                    <LightbulbIcon className="h-[18px] w-[18px] absolute left-2.5" />
                    <span className="absolute left-9">Deep-Thinking</span>
                  </Button>
                </div>
                <div className="h-9 w-[1px] bg-border mx-1" />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="h-9 w-9" 
                  disabled={loading || !input.trim()}
                >
                  <Send className="h-[18px] w-[18px]" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}