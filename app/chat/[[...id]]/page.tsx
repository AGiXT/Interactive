'use client';

import { useInteractiveConfig } from '@/components/idiot/interactive/InteractiveConfigContext';
import { useEffect } from 'react';
import AGiXTInteractive from '@/components/idiot/interactive/InteractiveAGiXT';
import { SidebarPage } from '@/components/layout/SidebarPage';

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
