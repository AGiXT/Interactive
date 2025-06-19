'use client';

import React, { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatBarProps {
  onSend: (message: string, files: Record<string, string>) => Promise<string>;
  disabled?: boolean;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  loading?: boolean;
  setLoading?: (loading: boolean) => void;
  showOverrideSwitchesCSV?: string;
  showResetConversation?: boolean;
  isEmptyConversation?: boolean;
}

export function ChatBar({ onSend, disabled = false, enableFileUpload = false, loading = false }: ChatBarProps) {
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!message.trim() && Object.keys(attachedFiles).length === 0) return;

    try {
      await onSend(message, attachedFiles);
      setMessage('');
      setAttachedFiles({});

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setAttachedFiles((prev) => ({
          ...prev,
          [file.name]: result,
        }));
      };
      reader.readAsDataURL(file);
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileName: string) => {
    setAttachedFiles((prev) => {
      const updated = { ...prev };
      delete updated[fileName];
      return updated;
    });
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  return (
    <div className='fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-10'>
      <div className='max-w-4xl mx-auto'>
        {/* File attachments */}
        {Object.keys(attachedFiles).length > 0 && (
          <div className='flex flex-wrap gap-2 mb-3'>
            {Object.keys(attachedFiles).map((fileName) => (
              <div key={fileName} className='flex items-center gap-1 bg-muted px-2 py-1 rounded text-sm'>
                <span className='truncate max-w-32'>{fileName}</span>
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => removeFile(fileName)}
                  className='h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground'
                >
                  <X className='w-3 h-3' />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className='flex items-end gap-2'>
          <div className='flex-1 relative'>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyPress}
              placeholder='Type your message...'
              disabled={disabled || loading}
              className='min-h-[44px] max-h-[200px] resize-none pr-12'
              rows={1}
            />

            {/* File Upload Button */}
            {enableFileUpload && (
              <div className='absolute right-2 top-2'>
                <input type='file' ref={fileInputRef} onChange={handleFileUpload} multiple className='hidden' />
                <Button
                  size='sm'
                  variant='ghost'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || loading}
                  className='h-8 w-8 p-0'
                >
                  <Paperclip className='w-4 h-4' />
                </Button>
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={disabled || loading || (!message.trim() && Object.keys(attachedFiles).length === 0)}
            size='icon'
            className='h-11 w-11'
          >
            <Send className='w-4 h-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}
