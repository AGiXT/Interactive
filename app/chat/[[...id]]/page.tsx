'use client';

import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { useEffect, useMemo, useState } from 'react';
import { SidebarPage } from '@/components/layout/SidebarPage';
import React, { ReactNode } from 'react';
import { Chat } from '@/components/conversation/conversation';
import { Overrides } from '@/components/interactive/InteractiveConfigContext';
import { useConversations } from '@/components/interactive/useConversation';
import { ChatTopBar } from '@/components/conversation/ChatTopBar';

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
  const state = useInteractiveConfig();
  const { data: conversations } = useConversations();
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  
  useEffect(() => {
    if (conversations && params.id) {
      const conv = conversations.find((conv) => conv.id === params.id);
      setCurrentConversation(conv);
    }
  }, [conversations, params.id]);
  
  return (
    <SidebarPage 
      title={currentConversation?.name || 'Chat'} 
      headerActions={<ChatTopBar currentConversation={currentConversation} />}
    >
      <ConvSwitch id={params.id} />
      <AGiXTInteractive
        uiConfig={{
          showChatThemeToggles: false,
          enableVoiceInput: true,
          footerMessage: '',
          alternateBackground: 'primary',
        }}
        overrides={{
          conversation: params.id,
        }}
      />
    </SidebarPage>
  );
}
