import useSWR, { SWRResponse } from 'swr';
import { RoleSchema, UserSchema } from '@/components/idiot/auth/hooks/useUser';
import { z } from 'zod';
import log from '../../idiot/next-log/log';
import { useContext } from 'react';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

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
  createdAt: z.string(), // TODO Figure out why this errors: .datetime(),
  hasNotifications: z.boolean(),
  id: z.string().uuid(),
  name: z.string().min(1),
  summary: z.unknown(),
  updatedAt: z.string(), // TODO Figure out why this errors: .datetime()
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
  const { agixt } = useContext(InteractiveConfigContext);

  return useSWR<ConversationEdge[]>(
    '/conversations',
    async (): Promise<ConversationEdge[]> => {
      try {
        log(['REST useConversations() Fetching conversations'], {
          client: 3,
        });
        // Get conversations with full objects
        const conversations = await agixt.getConversations(true);
        log(['REST useConversations() Response', conversations], {
          client: 3,
        });

        // Transform the conversations to match the expected schema
        const edges = conversations.map(conv => ({
          attachmentCount: conv.attachment_count || 0,
          createdAt: conv.created_at || new Date().toISOString(),
          hasNotifications: conv.has_notifications || false,
          id: conv.id,
          name: conv.name,
          summary: conv.summary || null,
          updatedAt: conv.updated_at || conv.created_at || new Date().toISOString()
        }));

        // Filter out test prompts and validate
        return z
          .array(ConversationEdgeSchema)
          .parse(edges.filter((conv) => !conv.name.startsWith('PROMPT_TEST')));
      } catch (error) {
        log(['REST useConversations() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] },
  );
}
