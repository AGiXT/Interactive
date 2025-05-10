'use client';

import React from 'react';
import { VoiceRecorder } from '@/components/conversation/input/VoiceRecorder';
import { cn } from '@/lib/utils';

export interface ChildChatBarProps {
  onSend: (message: string | object, uploadedFiles?: { [x: string]: string }) => Promise<void>;
  disabled: boolean;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

export function ChildChatBar({
  onSend,
  disabled,
  loading,
  setLoading,
}: ChildChatBarProps): React.JSX.Element {
  return (
    <div className={cn(
      'relative border-t z-10 bg-background py-4 px-4',
      'flex flex-col items-center justify-center'
    )}>
      <div className="flex items-center justify-center w-24 h-24 rounded-full bg-primary shadow-lg hover:scale-105 transition-transform">
        <VoiceRecorder 
          onSend={onSend} 
          disabled={disabled}
          className="w-20 h-20" // Custom size prop for the large button
        />
      </div>
      <div className="mt-2 text-sm font-medium text-center text-muted-foreground">
        {loading ? 'Listening...' : 'Tap to speak'}
      </div>
    </div>
  );
}
