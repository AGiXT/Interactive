'use client';
import React, { ReactNode, useMemo } from 'react';
import Chat from '@/components/conversation/conversation';
import { Overrides } from '@/components/idiot/interactive/InteractiveConfigContext';

export type FormProps = {
  fieldOverrides?: { [key: string]: ReactNode };
  formContext?: object;
  additionalFields?: { [key: string]: ReactNode };
  additionalOutputButtons: { [key: string]: ReactNode };
  onSubmit?: (data: object) => void;
};
export type UIProps = {
  showSelectorsCSV?: string;
  showChatThemeToggles?: boolean;
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

const InteractiveAGiXT = ({
  overrides = {
    mode: (process.env.NEXT_PUBLIC_AGIXT_MODE && ['chain', 'prompt'].includes(process.env.NEXT_PUBLIC_AGIXT_MODE)
      ? process.env.NEXT_PUBLIC_AGIXT_MODE
      : 'prompt') as 'chain' | 'prompt',
  },
  uiConfig = {},
}: AGiXTInteractiveProps): React.JSX.Element => {
  const uiConfigWithEnv = useMemo(
    () => ({
      showRLHF: process.env.NEXT_PUBLIC_AGIXT_RLHF === 'true',
      showChatThemeToggles: process.env.NEXT_PUBLIC_AGIXT_SHOW_CHAT_THEME_TOGGLES === 'true',
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
export default InteractiveAGiXT;
