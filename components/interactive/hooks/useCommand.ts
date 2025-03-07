import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../jrg/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

export const CommandArgValueSchema = z.object({
  value: z.string(),
});

export const CommandArgSchema = z.object({
  name: z.string().min(1),
  value: CommandArgValueSchema,
});

export type CommandArgs = z.infer<typeof CommandArgSchema>;

export function useCommandArgs(commandName: string): SWRResponse<CommandArgs | null> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<CommandArgs | null>(
    ['/command-args', commandName],
    async (): Promise<CommandArgs | null> => {
      try {
        const args = await sdk.getCommandArgs(commandName);
        // Transform the SDK response to match the expected schema
        return {
          name: commandName,
          value: { value: JSON.stringify(args) },
        };
      } catch (error) {
        log(['SDK useCommandArgs() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null }
  );
}