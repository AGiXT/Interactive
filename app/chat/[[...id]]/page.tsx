'use client';

import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useEffect } from 'react';
import { SidebarPage } from '@/components/layout/SidebarPage';
import React, { ReactNode, useMemo } from 'react';
import { Chat } from '@/components/conversation/conversation';
import { Overrides } from '@/components/interactive/InteractiveConfigContext';

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

export function ConvSwitch({ id }: { id: string }) {
  const state = useInteractiveConfig();
  useEffect(() => {
    state?.mutate((oldState) => ({
      ...oldState,
      overrides: { ...oldState.overrides, conversation: id || '-' },
    }));
  }, [id]);
  return null;
}

export default function Home({ params }: { params: { id: string } }) {
  return (
    <SidebarPage title='Chat'>
      <ConvSwitch id={params.id} />
      "use client";

      import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
      import { useEffect, useState } from 'react';
      import { SidebarPage } from '@/components/layout/SidebarPage';
      import React, { ReactNode, useMemo } from 'react';
      import { Chat } from '@/components/conversation/conversation';
      import { useRouter } from 'next/navigation';
      import { Badge, Check, Download, Pencil, Plus, Trash2 } from 'lucide-react';
      import { LuPaperclip as Paperclip } from 'react-icons/lu';
      import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuItem,
        DropdownMenuLabel,
        DropdownMenuSeparator,
        DropdownMenuTrigger,
      } from '@/components/ui/dropdown-menu';
      import { Button } from '@/components/ui/button';
      import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogFooter,
        DialogDescription,
        DialogTrigger,
        DialogClose,
      } from '@/components/ui/dialog';
      import { Input } from '@/components/ui/input';
      import { Label } from '@/components/ui/label';

      import { InteractiveConfigContext, Overrides } from '@/components/interactive/InteractiveConfigContext';

      export type FormProps = {
        fieldOverrides?: { [key: string]: ReactNode };
        formContext?: object;
        additionalFields?: { [key: string]: ReactNode };
        additionalOutputButtons: { [key: string]: ReactNode };
        onSubmit?: (data: object) =>void;
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
      }: AGiXTInteractiveProps): React.JSX.Element =>{
        const uiConfigWithEnv = useMemo(
          () =>({
            showRLHF: process.env.NEXT_PUBLIC_AGIXT_RLHF === 'true',
            footerMessage: process.env.NEXT_PUBLIC_AGIXT_FOOTER_MESSAGE || '',
            showOverrideSwitchesCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_OVERRIDE_SWITCHES || '',
            alternateBackground: 'primary' as 'primary' | 'secondary',
            showSelectorsCSV: process.env.NEXT_PUBLIC_AGIXT_SHOW_SELECTION,
            enableVoiceInput: process.env.NEXT_PUBLIC_AGIXT_VOICE_INPUT_ENABLED === 'true',
            enableFileUpload: process.env.NEXT_PUBLIC_AGIXT_FILE_UPLOAD_ENABLED === 'true',
            enableMessageDeletion: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING === 'true',
            enableMessageEditing: process.env.NEXT_PUBLIC_AGIXT_ALLOW_MESSAGE_EDITING === 'true',
            ...uiConfig,
          }),
          [uiConfig],
        );
        return<Chat {...uiConfigWithEnv} {...overrides} />;
      };

      export function ConvSwitch({ id }: { id: string }) {
        const state = useInteractiveConfig();
        useEffect(() =>{
          state?.mutate((oldState) =>({
            ...oldState,
            overrides: { ...oldState.overrides, conversation: id || '-' },
          }));
        }, [id]);
        return null;
      }

      export default function Home({ params }: { params: { id: string } }) {
        const state = React.useContext(InteractiveConfigContext);
        const router = useRouter();
        const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
        const [newConversationName, setNewConversationName] = React.useState('');

        const handleRenameConversation = async () =>{
          if (newConversationName.trim() === '') {
            // Show error message or handle empty name case
            return;
          }
          try {
            await state.agixt.renameConversation(params.id, newConversationName);
            await mutate('/conversations');
            setRenameDialogOpen(false);
          } catch (error) {
            console.error('Error renaming conversation:', error);
          }
        };

        return (<SidebarPage title=''><div className='md:flex items-center justify-between'><div className='flex items-center'><ConvSwitch id={params.id} /><h1 className='text-2xl font-bold'>{params.id !== '-' && state.agixt
                    ? state.agixt.getConversation(params.id).then((res) =>res.conversation_history.name)
                    : 'Chat'}</h1><Button variant='ghost' size='icon' onClick={() =>setRenameDialogOpen(true)}><Pencil className='w-4 h-4' /></Button><Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}><DialogContent className='sm:max-w-[425px]'><DialogHeader><DialogTitle>Rename Conversation</DialogTitle><DialogDescription>Rename this conversation to something more descriptive.</DialogDescription></DialogHeader><div className='grid gap-4 py-4'><div className='grid grid-cols-4 items-center gap-4'><Label htmlFor='name' className='text-right'>New Name</Label><Input id='name' value={newConversationName} onChange={(e) =>setNewConversationName(e.target.value)} className='col-span-3' /></div></div><DialogFooter><Button type='submit' onClick={handleRenameConversation}>Rename</Button></DialogFooter></DialogContent></Dialog><Button variant='ghost' size='icon'><Download className='w-4 h-4' /></Button><Button variant='ghost' size='icon'><Trash2 className='w-4 h-4' /></Button></div><div className='md:flex-grow'><AGiXTInteractive
                  uiConfig={{
                    enableVoiceInput: true,
                    footerMessage: '',
                    alternateBackground: 'primary',
                  }}
                  overrides={{
                    conversation: params.id,
                  }}
                /></div></div></SidebarPage>);
      }
  );
}
