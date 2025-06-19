import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getCookie } from 'cookies-next';

export interface WebSocketMessage {
  id: string;
  role: string;
  message: string;
  timestamp: string;
  children?: WebSocketMessage[];
}

export interface WebSocketEvent {
  type: 'connected' | 'initial_message' | 'message_added' | 'message_updated' | 'heartbeat' | 'error';
  data?: WebSocketMessage;
  conversation_id?: string;
  conversation_name?: string;
  message?: string;
}

export interface UseConversationWebSocketOptions {
  conversationId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
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
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const currentConversationId = useRef<string | undefined>(conversationId);

  // Stable format function that doesn't change on every render
  const formatMessages = useMemo(() => {
    return (rawMessages: WebSocketMessage[]): WebSocketMessage[] => {
      const result: WebSocketMessage[] = [];
      const activities = new Map<string, WebSocketMessage>();

      // Process messages in order
      for (const msg of rawMessages) {
        const text = msg.message || '';

        if (text.startsWith('[ACTIVITY]')) {
          const activity = { ...msg, children: [] };
          result.push(activity);
          activities.set(msg.id, activity);
        } else if (text.startsWith('[SUBACTIVITY]')) {
          // Extract parent ID: [SUBACTIVITY][PARENT_ID][TYPE]
          // Look for pattern like [SUBACTIVITY][052982c9-e8c9-416a-a2f9-7501e9a4650f][THOUGHT]
          const parentMatch = text.match(/\[SUBACTIVITY\]\[([a-f0-9-]{36})\]/);
          const parentId = parentMatch?.[1];
          const parent = parentId ? activities.get(parentId) : null;

          if (parent) {
            if (!parent.children) parent.children = [];
            parent.children.push({ ...msg, children: [] });
          } else {
            // Find last activity as fallback
            for (let i = result.length - 1; i >= 0; i--) {
              if (result[i].message.startsWith('[ACTIVITY]')) {
                if (!result[i].children) result[i].children = [];
                result[i].children.push({ ...msg, children: [] });
                break;
              }
            }
          }
        } else {
          // Regular message
          result.push({ ...msg, children: [] });
        }
      }

      return result;
    };
  }, []); // Empty dependency array - this function is stable

  // Stable disconnect function
  const disconnect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close(1000, 'Client disconnect');
    }
    wsRef.current = null;
    setConnectionStatus('disconnected');
    setIsLoading(false);
  }, []);

  // Create stable connect function
  const connect = useCallback(() => {
    if (!enabled || !conversationId || conversationId === '-') {
      return;
    }

    // Don't reconnect if already connected to the same conversation
    if (wsRef.current && 
        (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN) &&
        currentConversationId.current === conversationId) {
      return;
    }

    disconnect();

    const token = getCookie('jwt');
    if (!token) return;

    try {
      setConnectionStatus('connecting');
      setIsLoading(true);
      currentConversationId.current = conversationId;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const serverUrl = process.env.NEXT_PUBLIC_AGIXT_SERVER || 'http://localhost:7437';
      const wsUrl = serverUrl.replace(/^https?:/, protocol);
      const url = `${wsUrl}/v1/conversation/${conversationId}/stream?authorization=${encodeURIComponent(token)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setIsLoading(false);
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data);

          if (wsEvent.type === 'initial_message' && wsEvent.data) {
            setMessages((prev) => {
              const updated = [...prev, wsEvent.data!];
              return formatMessages(updated);
            });
            onMessage?.(wsEvent.data);
          } else if (wsEvent.type === 'message_added' && wsEvent.data) {
            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === wsEvent.data!.id);
              if (exists) return prev;
              const updated = [...prev, wsEvent.data!];
              return formatMessages(updated);
            });
            onMessage?.(wsEvent.data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          onError?.('Failed to parse WebSocket message');
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        setIsLoading(false);
        wsRef.current = null;
        onDisconnect?.();
      };

      ws.onerror = () => {
        setConnectionStatus('error');
        setIsLoading(false);
        onError?.('WebSocket connection error');
      };
    } catch (error) {
      setConnectionStatus('error');
      setIsLoading(false);
      onError?.('Failed to establish WebSocket connection');
    }
  }, [enabled, conversationId, disconnect, formatMessages, onConnect, onMessage, onDisconnect, onError]);

  // Handle conversation changes - use ref to prevent infinite loops
  useEffect(() => {
    if (enabled && conversationId && conversationId !== '-') {
      if (currentConversationId.current !== conversationId) {
        console.log('🔄 Conversation changed, establishing new connection:', conversationId);
        setMessages([]);
        // Use timeout to prevent infinite loops
        const timer = setTimeout(() => {
          connect();
        }, 100);
        return () => clearTimeout(timer);
      }
    } else {
      disconnect();
      setMessages([]);
    }
  }, [enabled, conversationId]); // Removed connect and disconnect from deps to prevent loops

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    messages,
    connectionStatus,
    isLoading,
    connect,
    disconnect,
    clearMessages: () => setMessages([]),
  };
}
