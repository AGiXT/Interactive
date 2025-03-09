import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../idiot/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

export const CommandArgValueSchema = z.object({
  value: z.string(),
});

export const CommandArgSchema = z.object({
  name: z.string().min(1),
  value: CommandArgValueSchema,
});

export type CommandArgs = z.infer<typeof CommandArgSchema>;

export function useCommandArgs(commandName: string): SWRResponse<CommandArgs | null> {
  const { agixt } = useContext(InteractiveConfigContext);

  return useSWR<CommandArgs | null>(
    commandName ? [`/command_args`, commandName] : null,
    async (): Promise<CommandArgs | null> => {
      try {
        log(['REST useCommandArgs() Fetching command args', commandName], {
          client: 3,
        });
        const args = await agixt.getCommandArgs(commandName);
        log(['REST useCommandArgs() Response', args], {
          client: 3,
        });
        return CommandArgSchema.parse(args);
      } catch (error) {
        log(['REST useCommandArgs() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null },
  );
}
