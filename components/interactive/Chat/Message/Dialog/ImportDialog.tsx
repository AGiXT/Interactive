'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/useToast';
import { getCookie } from 'cookies-next';
import { mutate } from 'swr';
import axios from 'axios';
import { useContext, useState } from 'react';
import { InteractiveConfig, InteractiveConfigContext } from '../../../InteractiveConfigContext';
import { useRouter } from 'next/navigation';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const state = useContext(InteractiveConfigContext);
  const router = useRouter();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: 'Error',
        description: 'Please select a file to import',
        duration: 5000,
      });
      return;
    }

    setIsLoading(true);

    try {
      const fileContent = await file.text();
      const conversationData = JSON.parse(fileContent);

      // Create new conversation with imported messages
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/chat/completions`,
        {
          messages: conversationData.messages.map((msg: any) => ({
            role: msg.role,
            content: [{ type: 'text', text: msg.content }],
          })),
          model: getCookie('agixt-agent'),
          import: true, // Signal this is an import
        },
        {
          headers: {
            Authorization: getCookie('jwt'),
          },
        }
      );

      if (response.status === 200) {
        const chatCompletion = response.data;
        
        // Update state with new conversation
        if (state.mutate) {
          state.mutate((oldState: InteractiveConfig) => ({
            ...oldState,
            overrides: {
              ...oldState.overrides,
              conversation: chatCompletion.id,
            },
          }));
        }

        // Redirect to new conversation
        router.push(`/chat/${chatCompletion.id}`);

        // Refresh conversations list
        mutate('/conversation');

        toast({
          title: 'Success',
          description: 'Conversation imported successfully',
          duration: 5000,
        });

        onClose();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Error',
        description: 'Failed to import conversation. Please check the file format.',
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Conversation</DialogTitle>
          <DialogDescription>
            Import a previously exported conversation file (.json)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="w-full cursor-pointer rounded-lg border border-gray-300 p-2"
          />
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}