import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import { createGraphQLClient } from '@/components/interactive/lib';

export const CommandArgValueSchema = z.object({
  value: z.string(),
});

export const CommandArgSchema = z.object({
  name: z.string().min(1),
  value: CommandArgValueSchema,
});

export type CommandArgs = z.infer<typeof CommandArgSchema>;

export function useCommandArgs(commandName: string): SWRResponse<CommandArgs | null> {
  const client = createGraphQLClient();

  return useSWR<CommandArgs | null>(
    commandName ? [`/command_args`, commandName] : null,
    async (): Promise<CommandArgs | null> => {
      try {
        const query = CommandArgSchema.toGQL('query', 'GetCommandArgs', { commandName });
        const response = await client.request<CommandArgs>(query, { commandName });
        return CommandArgSchema.parse(response);
      } catch (error) {
        console.error('Error fetching command args:', error);
        return null;
      }
    },
    { fallbackData: null },
  );
}
