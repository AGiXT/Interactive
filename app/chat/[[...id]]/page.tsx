import { cookies } from 'next/headers';
import AGiXTInteractive from '@/components/interactive/InteractiveAGiXT';
import ConvSwitch from './ConvSwitch';
import NewChatPage from './new-chat-page';

export default function Home({ params }: { params: { id: string } }) {
  // If no ID is provided, show the new chat interface
  if (!params.id || params.id.length === 0) {
    return <NewChatPage />;
  }

  // Otherwise show the existing chat interface
  return (
    <>
      <ConvSwitch id={params.id} />
      <AGiXTInteractive
        stateful={false}
        uiConfig={{
          showAppBar: false,
          showChatThemeToggles: false,
          enableVoiceInput: true,
          footerMessage: '',
          alternateBackground: 'primary',
        }}
        serverConfig={{
          agixtServer: process.env.NEXT_PUBLIC_AGIXT_SERVER as string,
          apiKey: cookies().get('jwt')?.value ?? '',
        }}
        agent={process.env.NEXT_PUBLIC_AGIXT_AGENT || 'XT'}
        overrides={{
          conversation: params.id,
        }}
      />
    </>
  );
}
