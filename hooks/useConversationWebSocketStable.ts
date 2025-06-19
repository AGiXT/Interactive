import { useEffect, useState, useRef, useCallback } from 'react';
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
  console.log('🔧 Grouping messages:', rawMessages.length);
  const result: WebSocketMessage[] = [];
  let currentActivity: WebSocketMessage | null = null;

  for (const msg of rawMessages) {
    const text = msg.message || '';
    console.log('🔧 Processing message:', {
      id: msg.id,
      message: text.substring(0, 50) + '...',
      isActivity: text.startsWith('[ACTIVITY]'),
      isSubactivity: text.startsWith('[SUBACTIVITY]'),
      hasCurrentActivity: !!currentActivity
    });

    if (text.startsWith('[ACTIVITY]')) {
      // This is a new activity
      currentActivity = { ...msg, children: [] };
      result.push(currentActivity);
      console.log('🔧 Created new activity:', currentActivity.id);
    } else if (text.startsWith('[SUBACTIVITY]') && currentActivity) {
      // This is a subactivity - add to current activity
      if (!currentActivity.children) {
        currentActivity.children = [];
      }
      
      // Check if this subactivity already exists to avoid duplicates
      const existingSubactivity = currentActivity.children.find(child => child.id === msg.id);
      if (!existingSubactivity) {
        currentActivity.children.push({ ...msg, children: [] });
        console.log('🔧 Added subactivity to activity:', {
          activityId: currentActivity.id,
          subactivityId: msg.id,
          totalChildren: currentActivity.children.length
        });
      } else {
        console.log('🔧 Subactivity already exists, skipping:', msg.id);
      }
    } else {
      // Regular message
      result.push({ ...msg, children: [] });
      // Don't reset currentActivity here - let it persist until a new activity starts
      console.log('🔧 Added regular message:', msg.id);
    }
  }

  console.log(
    '🔧 Grouping result:',
    result.map((msg) => ({
      id: msg.id,
      message: msg.message.substring(0, 50) + '...',
      childrenCount: msg.children?.length || 0,
    })),
  );

  // Final validation - log the children count for activities
  result.forEach((msg, index) => {
    if (msg.message?.startsWith('[ACTIVITY]')) {
      console.log(`🔧 Final activity ${index}:`, {
        id: msg.id,
        childrenCount: msg.children?.length || 0,
        children: msg.children?.map((child) => child.id) || []
      });
    }
  });

  return result;
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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(
    'disconnected',
  );

  const wsRef = useRef<WebSocket | null>(null);
  const currentConversationIdRef = useRef<string | undefined>();
  
  // Store callbacks in refs to avoid dependency issues
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);

  // Update refs when callbacks change
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  // Clean disconnect function
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  // Main effect for managing WebSocket connection - only depends on enabled and conversationId
  useEffect(() => {
    console.log('🔍 WebSocket effect triggered:', { enabled, conversationId, currentId: currentConversationIdRef.current });
    
    // Don't connect if disabled or no conversation ID
    if (!enabled || !conversationId) {
      console.log('🚫 WebSocket disabled or no conversation ID:', { enabled, conversationId });
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
      onErrorRef.current?.('No authentication token');
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
        onConnectRef.current?.();
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

              // For subactivities, try to add them to existing activities instead of reprocessing everything
              const text = newMessage.message || '';
              if (text.startsWith('[SUBACTIVITY]')) {
                // Extract the activity ID from the subactivity message
                const match = text.match(/\[SUBACTIVITY\]\[([^\]]+)\]/);
                if (match) {
                  const activityId = match[1];
                  
                  // Find the existing activity and add this subactivity to it
                  const updatedMessages = prevMessages.map((msg) => {
                    if (msg.id === activityId) {
                      const children = msg.children || [];
                      // Check if this subactivity already exists
                      const childExists = children.some((child) => child.id === newMessage.id);
                      if (!childExists) {
                        return {
                          ...msg,
                          children: [...children, { ...newMessage, children: [] }],
                        };
                      }
                    }
                    return msg;
                  });
                  
                  // If we found and updated the activity, return the updated messages
                  const activityFound = updatedMessages.some((msg) => 
                    msg.id === activityId && msg.children?.some((child) => child.id === newMessage.id),
                  );
                  
                  if (activityFound) {
                    console.log('🔧 Direct subactivity addition:', {
                      activityId,
                      subactivityId: newMessage.id,
                      activityChildren: updatedMessages.find((m) => m.id === activityId)?.children?.length || 0,
                    });
                    return updatedMessages;
                  }
                }
              }

              // For regular messages and activities, use the grouping function
              // but preserve any existing children that were directly added
              const updatedMessages = [...prevMessages, newMessage];
              const groupedMessages = groupMessages(updatedMessages);
              
              // Restore any children that were directly added (to preserve subactivities)
              return groupedMessages.map((groupedMsg) => {
                const existingMsg = prevMessages.find((msg) => msg.id === groupedMsg.id);
                if (existingMsg && existingMsg.children && existingMsg.children.length > 0) {
                  console.log('🔧 Preserving existing children for:', {
                    id: groupedMsg.id,
                    existingChildren: existingMsg.children.length,
                    groupedChildren: groupedMsg.children?.length || 0
                  });
                  return {
                    ...groupedMsg,
                    children: existingMsg.children
                  };
                }
                return groupedMsg;
              });
            });

            onMessageRef.current?.(newMessage);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          onErrorRef.current?.('Failed to parse message');
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        setConnectionStatus('disconnected');
        wsRef.current = null;
        onDisconnectRef.current?.();
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        onErrorRef.current?.('Connection error');
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
      onErrorRef.current?.('Failed to establish connection');
    }

    // Cleanup function
    return () => {
      disconnect();
    };
  }, [enabled, conversationId, disconnect]); // Only these dependencies

  const connect = useCallback(() => {
    // Force reconnection by clearing current conversation ID
    currentConversationIdRef.current = undefined;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    connectionStatus,
    isLoading: connectionStatus === 'connecting',
    connect,
    disconnect,
    clearMessages,
  };
}
