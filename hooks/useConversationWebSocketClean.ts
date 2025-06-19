import { useEffect, useState, useRef } from 'react';
import { getCookie } from 'cookies-next';

export interface WebSocketMessage {
  id: string;
  role: string;
  message: string;
  timestamp: string;
  children?: WebSocketMessage[];
}

export interface UseConversationWebSocketOptions {
  conversationId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

// Simple function to group activities and subactivities
function groupMessages(rawMessages: WebSocketMessage[]): WebSocketMessage[] {
  const result: WebSocketMessage[] = [];
  let currentActivity: WebSocketMessage | null = null;

  for (const msg of rawMessages) {
    const text = msg.message || '';

    if (text.startsWith('[ACTIVITY]')) {
      // This is a new activity
      currentActivity = { ...msg, children: [] };
      result.push(currentActivity);
    } else if (text.startsWith('[SUBACTIVITY]') && currentActivity) {
      // This is a subactivity - add to current activity
      if (!currentActivity.children) {
        currentActivity.children = [];
      }
      currentActivity.children.push({ ...msg, children: [] });
    } else {
      // Regular message
      result.push({ ...msg, children: [] });
      currentActivity = null; // Reset current activity for non-activity messages
    }
  }

  return result;
}

export function useConversationWebSocket({
  conversationId,
  onMessage,
  onError,
  onConnect,
  onDisconnect,
  enabled = true,
}: UseConversationWebSocketOptions) {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'disconnected',
  );

  const wsRef = useRef<WebSocket | null>(null);
  const currentConversationIdRef = useRef<string | undefined>();

  // Clean disconnect function
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  };

  // Main effect for managing WebSocket connection
  useEffect(() => {
    // Don't connect if disabled or no conversation ID
    if (!enabled || !conversationId || conversationId === '-') {
      disconnect();
      setMessages([]);
      return;
    }

    // Don't reconnect if already connected to same conversation
    if (
      currentConversationIdRef.current === conversationId &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // Clean up previous connection
    disconnect();
    setMessages([]);
    currentConversationIdRef.current = conversationId;

    const token = getCookie('jwt');
    if (!token) {
      onError?.('No authentication token');
      return;
    }

    console.log('🔄 Conversation changed, establishing new connection:', conversationId);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const serverUrl = process.env.NEXT_PUBLIC_AGIXT_SERVER || 'http://localhost:7437';
    const wsUrl = serverUrl.replace(/^https?:/, protocol);
    const url = `${wsUrl}/v1/conversation/${conversationId}/stream?authorization=${encodeURIComponent(token)}`;

    console.log('🔌 Connecting to WebSocket:', url);

    try {
      setConnectionStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnectionStatus('connected');
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const wsEvent = JSON.parse(event.data);
          console.log('📨 WebSocket message:', wsEvent);

          if ((wsEvent.type === 'initial_message' || wsEvent.type === 'message_added') && wsEvent.data) {
            const newMessage = wsEvent.data;

            setMessages((prevMessages) => {
              // Check if message already exists
              const exists = prevMessages.some((msg) => msg.id === newMessage.id);
              if (exists) {
                return prevMessages;
              }

              // Add new message and group activities
              const updatedMessages = [...prevMessages, newMessage];
              return groupMessages(updatedMessages);
            });

            onMessage?.(newMessage);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          onError?.('Failed to parse message');
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        onDisconnect?.();
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        onError?.('Connection error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
      onError?.('Failed to establish connection');
    }

    // Cleanup function
    return () => {
      disconnect();
    };
  }, [enabled, conversationId, onMessage, onError, onConnect, onDisconnect]);

  return {
    messages,
    connectionStatus,
    isLoading: connectionStatus === 'connecting',
    connect: () => {
      // Force reconnection by clearing current conversation ID
      currentConversationIdRef.current = undefined;
    },
    disconnect,
    clearMessages: () => setMessages([]),
  };
}
