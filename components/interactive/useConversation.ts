import useSWR, { SWRResponse } from 'swr';

// Import all types from the centralized schema file
import { RoleSchema, UserSchema } from '@/components/interactive/useUser';
import { z } from 'zod';
import { createGraphQLClient } from '@/components/interactive/lib';

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
  updatedAt: z.string(), // TODO Figure out why this errors: .datetime(),.datetime(),
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
  const client = createGraphQLClient();

  return useSWR<ConversationEdge[]>(
    '/conversations',
    async (): Promise<ConversationEdge[]> => {
      try {
        const query = z.object({ edges: ConversationEdgeSchema }).toGQL('query', 'GetConversations');
        const response = await client.request<{ conversations: { edges: ConversationEdge[] } }>(query);
        return z
          .array(ConversationEdgeSchema)
          .parse(response.conversations.edges.filter((conv) => !conv.name.startsWith('PROMPT_TEST')));
      } catch (error) {
        console.error('Error fetching conversations:', error);
        return [];
      }
    },
    { fallbackData: [] },
  );
}
