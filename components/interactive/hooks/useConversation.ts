import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { RoleSchema, UserSchema } from '@/components/jrg/auth/hooks/useUser';
import { z } from 'zod';
import log from '../../jrg/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

export const ConversationMetadataSchema = z.object({
  agentId: z.string().uuid(),
  attachmentCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  hasNotifications: z.boolean(),
  id: z.string().uuid(),
  name: z.string().min(1),
  summary: z.unknown(),
  updatedAt: z.string().datetime(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  message: z.string().min(1),
  role: RoleSchema,
  timestamp: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.string().uuid().optional(),
  feedbackReceived: z.boolean().optional(),
});

export const ConversationSchema = z.object({
  messages: z.array(MessageSchema),
});

export const ConversationEdgeSchema = z.object({
  attachmentCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  hasNotifications: z.boolean(),
  id: z.string().uuid(),
  name: z.string().min(1),
  summary: z.unknown(),
  updatedAt: z.string(),
});

export const AppStateSchema = z.object({
  state: z.object({
    conversations: z.object({
      edges: z.array(ConversationEdgeSchema),
    }),
    currentConversation: z.object({
      messages: z.array(MessageSchema),
      metadata: ConversationMetadataSchema,
    }),
    notifications: z.array(
      z.object({
        conversationId: z.string().uuid(),
        conversationName: z.string(),
        message: z.string(),
        messageId: z.string().uuid(),
        timestamp: z.string().datetime(),
        role: z.string(),
      }),
    ),
    user: UserSchema,
  }),
});

export type Conversation = z.infer<typeof AppStateSchema>;
export type ConversationEdge = z.infer<typeof ConversationEdgeSchema>;
export type ConversationMetadata = z.infer<typeof ConversationMetadataSchema>;
export type Message = z.infer<typeof MessageSchema>;

export function useConversations(): SWRResponse<ConversationEdge[]> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<ConversationEdge[]>(
    '/conversations',
    async (): Promise<ConversationEdge[]> => {
      try {
        const conversations = await sdk.getConversationsWithIds();
        return conversations.map((conv: any) => ({
          attachmentCount: 0, // SDK doesn't provide attachment info
          createdAt: new Date().toISOString(), // SDK doesn't provide creation date
          hasNotifications: false, // SDK doesn't provide notification info
          id: conv.id || conv.name, // Some SDK methods use name as identifier
          name: conv.name,
          summary: null,
          updatedAt: new Date().toISOString(), // SDK doesn't provide update date
        }));
      } catch (error) {
        log(['SDK useConversations() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] }
  );
}

export function useConversation(conversationName: string): SWRResponse<{
  messages: Message[];
  metadata: ConversationMetadata;
}> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<{ messages: Message[]; metadata: ConversationMetadata }>(
    conversationName ? ['/conversation', conversationName] : null,
    async () => {
      try {
        const conversation = await sdk.getConversation(conversationName);
        const messages = conversation.messages.map((msg: any) => ({
          id: msg.id || Math.random().toString(), // Generate ID if not provided
          message: msg.content || msg.message,
          role: msg.role,
          timestamp: msg.timestamp || new Date().toISOString(),
          feedbackReceived: !!msg.feedback,
        }));

        const metadata: ConversationMetadata = {
          agentId: conversation.agentName || '', // Using agentName as ID
          attachmentCount: 0,
          createdAt: new Date().toISOString(),
          hasNotifications: false,
          id: conversation.id || conversationName,
          name: conversationName,
          summary: null,
          updatedAt: new Date().toISOString(),
        };

        return {
          messages,
          metadata,
        };
      } catch (error) {
        log(['SDK useConversation() Error', error], {
          client: 1,
        });
        return {
          messages: [],
          metadata: {
            agentId: '',
            attachmentCount: 0,
            createdAt: new Date().toISOString(),
            hasNotifications: false,
            id: conversationName,
            name: conversationName,
            summary: null,
            updatedAt: new Date().toISOString(),
          },
        };
      }
    },
    {
      fallbackData: {
        messages: [],
        metadata: {
          agentId: '',
          attachmentCount: 0,
          createdAt: new Date().toISOString(),
          hasNotifications: false,
          id: conversationName,
          name: conversationName,
          summary: null,
          updatedAt: new Date().toISOString(),
        },
      },
    }
  );
}