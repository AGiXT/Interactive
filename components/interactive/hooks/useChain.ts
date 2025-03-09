import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../idiot/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

export const ChainStepPromptSchema = z.object({
  chainName: z.string().nullable(),
  commandName: z.string().nullable(),
  promptCategory: z.unknown(),
  promptName: z.string().nullable(),
});

export const ChainStepSchema = z.object({
  agentName: z.string().min(1),
  prompt: ChainStepPromptSchema,
  promptType: z.string().min(1),
  step: z.number().int().nonnegative(),
});

export const ChainSchema = z.object({
  id: z.string().uuid(),
  chainName: z.string(),
  steps: z.array(ChainStepSchema),
});

export type Chain = z.infer<typeof ChainSchema>;
export type ChainStepPrompt = z.infer<typeof ChainStepPromptSchema>;
export type ChainStep = z.infer<typeof ChainStepSchema>;

export function useChain(chainName?: string): SWRResponse<Chain | null> {
  const state = useContext(InteractiveConfigContext);

  return useSWR<Chain | null>(
    chainName ? [`/chain`, chainName] : null,
    async (): Promise<Chain | null> => {
      try {
        log(['REST useChain() Fetching chain', chainName], {
          client: 3,
        });
        const response = await state.agixt.getChain(chainName!);
        log(['REST useChain() Response', response], {
          client: 3,
        });
        const validated = ChainSchema.parse(response);
        log(['REST useChain() Validated', validated], {
          client: 3,
        });
        return validated;
      } catch (error) {
        log(['REST useChain() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null },
  );
}

export function useChains(): SWRResponse<Chain[]> {
  const state = useContext(InteractiveConfigContext);

  return useSWR<Chain[]>(
    '/chains',
    async (): Promise<Chain[]> => {
      try {
        log(['REST useChains() Fetching chains'], {
          client: 3,
        });
        const chains = await state.agixt.getChains();
        // Since getChains() only returns basic chain info, we need to fetch full details
        const fullChains = await Promise.all(
          chains.map(async (chainName) => {
            const chain = await state.agixt.getChain(chainName);
            return ChainSchema.parse({
              ...chain,
              steps: chain.steps || [] // Ensure steps array exists
            });
          })
        );
        log(['REST useChains() Response', fullChains], {
          client: 3,
        });
        return fullChains;
      } catch (error) {
        log(['REST useChains() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] },
  );
}
