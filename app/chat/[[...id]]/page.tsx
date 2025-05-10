'use client';

import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useEffect, useMemo, useState } from 'react';
import { SidebarPage } from '@/components/layout/SidebarPage';
import React, { ReactNode } from 'react';
import { Chat } from '@/components/conversation/conversation';
import { Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { Button } from '@/components/ui/button';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { getCookie } from 'cookies-next';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/layout/toast';
import { mutate } from 'swr';

export type FormProps = {
  fieldOverrides?: { [key: string]: ReactNode };
  formContext?: object;
  additionalFields?: { [key: string]: ReactNode };
  additionalOutputButtons: { [key: string]: ReactNode };
  onSubmit?: (data: object) => void;
};
export type UIProps = {
  showSelectorsCSV?: string;
  enableFileUpload?: boolean;
  enableVoiceInput?: boolean;
  alternateBackground?: 'primary' | 'secondary';
  footerMessage?: string;
  showOverrideSwitchesCSV?: string;
};

export type AGiXTInteractiveProps = {
  overrides?: Overrides;
  uiConfig?: UIProps;
};

const AGiXTInteractive = ({
  overrides = {
    mode: 'prompt',
  },
  uiConfig = {},
}: AGiXTInteractiveProps): React.JSX.Element => {
  const uiConfigWithEnv = useMemo(
    () => ({
      showRLHF: process.env.NEXT_PUBLIC_AGIXT_RLHF === 'true',
      footerMessage: process.env.NEXT_PUBLIC_AGIXT_FOOTER_MESSAGE || '',
      showOverrideSwitchesCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_OVERRIDE_SWITCHES || '',
      alternateBackground: 'primary' as 'primary' | 'secondary',
      showSelectorsCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_SELECTION,
      enableVoiceInput: process.env.NEXT_PUBLIC_AGIXT_VOICE_INPUT_ENABLED === 'true',
      enableFileUpload: process.env.NEXT_PUBLIC_AGIXT_FILE_UPLOAD_ENABLED === 'true',
      enableMessageDeletion: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_DELETION === 'true',
      enableMessageEditing: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING === 'true',
      ...uiConfig,
    }),
    [uiConfig],
  );
  return <Chat {...uiConfigWithEnv} {...overrides} />;
};

export function ConvSwitch({ id }: { id?: string }) {
  const state = useInteractiveConfig();
  useEffect(() => {
    if (id && state?.mutate) {
      state.mutate((oldState: any) => ({
        ...oldState,
        overrides: { ...oldState.overrides, conversation: id },
      }));
    }
  }, [id, state]);
  return null;
}

export default function Home({ params }: { params: { id?: string[] } }) {
  const state = useInteractiveConfig();
  const { data: conversations } = useConversations();
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const router = useRouter();
  
  // Extract the conversation ID from params
  const conversationId = params.id && params.id.length > 0 ? params.id[0] : undefined;
  
  // Debug information
  console.log('Home - params:', params);
  console.log('Home - conversationId:', conversationId);
  console.log('Home - conversations:', conversations);
  
  useEffect(() => {
    if (conversations && conversationId) {
      console.log('Home - looking for conversation with id:', conversationId);
      const conv = conversations.find((conv) => conv.id === conversationId);
      console.log('Home - found conversation:', conv);
      setCurrentConversation(conv);
    }
  }, [conversations, conversationId]);
  
  return (
    <SidebarPage 
      title={currentConversation?.name || 'Chat'} 
      headerActions={
        <div className='flex items-center gap-2'>
          {currentConversation?.id && (
            <>
              <Button 
                variant='outline' 
                size='sm' 
                onClick={() => {
                  // Rename dialog logic would go here
                  if (currentConversation?.id) {
                    const newName = prompt('Enter a new name for this conversation:');
                    if (newName && newName.trim()) {
                      state?.agixt?.renameConversation(getCookie('agixt-agent') as string || '', currentConversation.id, newName)
                        .then(() => {
                          mutate('/conversations');
                          toast({
                            title: 'Success',
                            description: 'Conversation renamed successfully',
                            duration: 3000,
                          });
                        });
                    }
                  }
                }}
              >
                <Pencil className='h-4 w-4 mr-2' />
                Rename
              </Button>

              <Button 
                variant='outline' 
                size='sm'
                onClick={() => {
                  // Export logic would go here
                  if (currentConversation?.id) {
                    state?.agixt?.getConversation('', currentConversation.id)
                      .then(conversationContent => {
                        const exportData = {
                          name: currentConversation?.name || 'Conversation',
                          id: currentConversation.id,
                          created_at: currentConversation?.createdAt || new Date().toISOString(),
                          messages: conversationContent.map((msg: any) => ({
                            role: msg.role,
                            content: msg.message,
                            timestamp: msg.timestamp,
                          })),
                        };
                        
                        const element = document.createElement('a');
                        const file = new Blob([JSON.stringify(exportData, null, 2)], {
                          type: 'application/json',
                        });
                        element.href = URL.createObjectURL(file);
                        element.download = `${currentConversation?.name || 'Conversation'}_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        URL.revokeObjectURL(element.href);
                        
                        toast({
                          title: 'Success',
                          description: 'Conversation exported successfully',
                          duration: 3000,
                        });
                      });
                  }
                }}
              >
                <Download className='h-4 w-4 mr-2' />
                Export
              </Button>

              <Button 
                variant='outline' 
                size='sm'
                onClick={() => {
                  // Delete logic would go here
                  if (currentConversation?.id && confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
                    state?.agixt?.deleteConversation(currentConversation.id)
                      .then(() => {
                        mutate('/conversations');
                        router.push('/chat');
                        toast({
                          title: 'Success',
                          description: 'Conversation deleted successfully',
                          duration: 3000,
                        });
                      });
                  }
                }}
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Delete
              </Button>
            </>
          )}
        </div>
      }
    >
      <ConvSwitch id={conversationId} />
      <AGiXTInteractive
        uiConfig={{
          enableVoiceInput: true,
          footerMessage: '',
          alternateBackground: 'primary',
        }}
        overrides={{
          conversation: conversationId,
        }}
      />
    </SidebarPage>
  );
}
