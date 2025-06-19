import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { getCookie } from 'cookies-next';

export interface WebSocketMessage {
  id: string;
  role: string;
  message: string;
  timestamp: string;
  updated_at?: string;
  updated_by?: string;
  feedback_received?: boolean;
  children?: WebSocketMessage[];
}

export interface WebSocketEvent {
  type: 'connected' | 'initial_message' | 'message_added' | 'message_updated' | 'message_deleted' | 'heartbeat' | 'error';
  data?: WebSocketMessage;
  conversation_id?: string;
  conversation_name?: string;
  message?: string;
  timestamp?: string;
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
}: UseConversationWebSocketOptions): {
  messages: WebSocketMessage[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  isLoading: boolean;
  connect: () => void;
  disconnect: () => void;
  clearMessages: () => void;
} {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  
  // Use refs to prevent circular dependencies
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;
  
  // Store conversation ID to prevent unnecessary reconnections
  const currentConversationId = useRef<string | undefined>(conversationId);
  
  // Memoize the format function to prevent recreations
  const formatConversationData = useMemo(() => {
    return (rawMessages: WebSocketMessage[]): WebSocketMessage[] => {
      if (!rawMessages.length) return [];

      const activityMessages: { [key: string]: WebSocketMessage } = {};
      const formattedConversation: WebSocketMessage[] = [];

      // First pass: identify and store all main activities
      rawMessages.forEach((message) => {
        const messageType = message.message.split(' ')[0];
        if (!messageType.startsWith('[SUBACTIVITY]')) {
          const formattedMessage = { ...message, children: [] };
          formattedConversation.push(formattedMessage);
          activityMessages[message.id] = formattedMessage;
        }
      });

      // Second pass: handle subactivities
      rawMessages.forEach((currentMessage) => {
        const messageType = currentMessage.message.split(' ')[0];
        if (messageType.startsWith('[SUBACTIVITY]')) {
          try {
            // Try to extract parent ID
            const parent = messageType.split('[')[2]?.split(']')[0];
            if (parent && activityMessages[parent]) {
              activityMessages[parent].children = activityMessages[parent].children || [];
              activityMessages[parent].children.push({ ...currentMessage, children: [] });
            } else {
              // Add to the last activity as a fallback
              if (formattedConversation.length > 0) {
                const lastActivity = formattedConversation[formattedConversation.length - 1];
                lastActivity.children = lastActivity.children || [];
                lastActivity.children.push({ ...currentMessage, children: [] });
              }
            }
          } catch (error) {
            // If parsing fails, add to the last activity as a fallback
            if (formattedConversation.length > 0) {
              const lastActivity = formattedConversation[formattedConversation.length - 1];
              lastActivity.children = lastActivity.children || [];
              lastActivity.children.push({ ...currentMessage, children: [] });
            } else {
              // If no activities exist yet, convert this subactivity to an activity
              formattedConversation.push({ ...currentMessage, children: [] });
            }
          }
        }
      });

      return formattedConversation;
    };
  }, []); // Empty dependency array - this function doesn't depend on props/state

  // Memoize disconnect function to prevent recreations
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('🔌 Disconnecting WebSocket');
      wsRef.current.close(1000, 'Client disconnect');
    }
    wsRef.current = null;
    setConnectionStatus('disconnected');
    setIsLoading(false);
    reconnectAttempts.current = 0;
  }, []);

  // Memoize clear messages function
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Create a stable reference to the connect function
  const connect = useCallback(() => {
    if (!enabled || !conversationId || conversationId === '-') {
      return;
    }

    // Don't reconnect if we're already connecting/connected to the same conversation
    if (wsRef.current && 
        (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN) &&
        currentConversationId.current === conversationId) {
      console.log('📡 Already connected/connecting to the same conversation');
      return;
    }

    // Disconnect any existing connection first
    disconnect();
    
    const token = getCookie('jwt');
    if (!token) {
      console.warn('No authentication token available for WebSocket connection');
      return;
    }

    try {
      setConnectionStatus('connecting');
      setIsLoading(true);
      currentConversationId.current = conversationId;

      // Determine WebSocket URL protocol based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const serverUrl = process.env.NEXT_PUBLIC_AGIXT_SERVER || 'http://localhost:7437';
      const wsUrl = serverUrl.replace(/^https?:/, protocol);
      
      const url = `${wsUrl}/v1/conversation/${conversationId}/stream?authorization=${encodeURIComponent(token)}`;
      
      console.log('🔌 Connecting to WebSocket:', url);
      
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnectionStatus('connected');
        setIsLoading(false);
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const wsEvent: WebSocketEvent = JSON.parse(event.data);
          console.log('📨 WebSocket message:', wsEvent);

          switch (wsEvent.type) {
            case 'connected':
              console.log('🎯 Connected to conversation:', wsEvent.conversation_name);
              break;

            case 'initial_message':
              if (wsEvent.data) {
                setMessages(prev => {
                  const updated = [...prev, wsEvent.data!];
                  return formatConversationData(updated);
                });
                onMessage?.(wsEvent.data);
              }
              break;

            case 'message_added':
              if (wsEvent.data) {
                console.log('➕ New message added:', wsEvent.data.message);
                setMessages(prev => {
                  // Check if message already exists to avoid duplicates
                  const exists = prev.some(msg => msg.id === wsEvent.data!.id);
                  if (exists) return prev;
                  
                  const updated = [...prev, wsEvent.data!];
                  return formatConversationData(updated);
                });
                onMessage?.(wsEvent.data);
              }
              break;

            case 'message_updated':
              if (wsEvent.data) {
                console.log('✏️ Message updated:', wsEvent.data.message);
                setMessages(prev => {
                  const updated = prev.map(msg => 
                    msg.id === wsEvent.data!.id ? wsEvent.data! : msg
                  );
                  return formatConversationData(updated);
                });
                onMessage?.(wsEvent.data);
              }
              break;

            case 'heartbeat':
              console.log('💓 WebSocket heartbeat:', wsEvent.timestamp);
              break;

            case 'error':
              console.error('❌ WebSocket error:', wsEvent.message);
              setConnectionStatus('error');
              onError?.(wsEvent.message || 'Unknown WebSocket error');
              break;

            default:
              console.log('❓ Unknown WebSocket message type:', wsEvent.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setIsLoading(false);
        wsRef.current = null;
        onDisconnect?.();

        // Only attempt to reconnect if it wasn't a clean close and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        setIsLoading(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      setIsLoading(false);
    }
  }, [enabled, conversationId, disconnect, formatConversationData, onConnect, onMessage, onError, onDisconnect]);

  // Effect to handle conversation changes
  useEffect(() => {
    if (enabled && conversationId && conversationId !== '-') {
      // Only connect if we're not already connected to this conversation
      if (currentConversationId.current !== conversationId) {
        console.log('🔄 Conversation changed, establishing new connection:', conversationId);
        clearMessages();
        
        // Add a small delay to ensure cleanup is complete
        const timer = setTimeout(() => {
          connect();
        }, 100);
        
        return () => {
          clearTimeout(timer);
        };
      }
    } else {
      // If disabled or no conversation, disconnect
      disconnect();
      clearMessages();
    }
  }, [enabled, conversationId, connect, disconnect, clearMessages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    messages,
    connectionStatus,
    isLoading,
    connect,
    disconnect,
    clearMessages,
  };
}
