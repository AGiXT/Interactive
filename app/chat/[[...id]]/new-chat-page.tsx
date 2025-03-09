'use client';

import AGiXTInteractive from '@/components/interactive/InteractiveAGiXT';
import { getCookie } from 'cookies-next';

export default function NewChatPage() {
  return (
    <div className="flex flex-col h-full">
      <AGiXTInteractive
        stateful={true}
        uiConfig={{
          showAppBar: false,
          showChatThemeToggles: false,
          enableVoiceInput: true,
          enableFileUpload: true,
          footerMessage: '',
          alternateBackground: 'primary',
        }}
        serverConfig={{
          agixtServer: process.env.NEXT_PUBLIC_AGIXT_SERVER as string,
          apiKey: getCookie('jwt') ?? '',
        }}
        agent={process.env.NEXT_PUBLIC_AGIXT_AGENT || 'XT'}
        overrides={{
          conversation: '-',
        }}
      />
    </div>
  );
}