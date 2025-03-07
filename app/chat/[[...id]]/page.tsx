'use client';

import { useParams } from 'next/navigation';
import Chat from '@/components/interactive/Chat/Chat';
import NewChatPage from './new-chat-page';

export default function ChatPage() {
  const params = useParams();
  const id = params?.id?.[0];

  // If no ID is provided, show the new chat interface
  if (!id) {
    return <NewChatPage />;
  }

  // Otherwise show the chat interface with the conversation ID
  return (
    <Chat
      showChatThemeToggles={true}
      alternateBackground="primary"
      enableFileUpload={true}
      enableVoiceInput={true}
      showOverrideSwitchesCSV=""
    />
  );
}
