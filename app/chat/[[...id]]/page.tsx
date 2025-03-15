import AGiXTInteractive from '@/components/interactive/InteractiveAGiXT';
import ConvSwitch from './ConvSwitch';

export default function Home({ params }: { params: { id: string } }) {
  return (
    <>
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
    </>
  );
}
