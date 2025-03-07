import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../jrg/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

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

export const ChainsSchema = ChainSchema.pick({ id: true, chainName: true });

export type Chain = z.infer<typeof ChainSchema>;
export type ChainStepPrompt = z.infer<typeof ChainStepPromptSchema>;
export type ChainStep = z.infer<typeof ChainStepSchema>;

export function useChain(chainName?: string): SWRResponse<Chain | null> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Chain | null>(
    chainName ? [`/chain`, chainName] : null,
    async (): Promise<Chain | null> => {
      try {
        const chain = await sdk.getChain(chainName!);
        // Transform the SDK response to match the expected schema
        const transformed: Chain = {
          id: chainName!, // Using chainName as ID since SDK doesn't provide IDs
          chainName: chainName!,
          steps: chain.steps.map((step: any) => ({
            agentName: step.agentName,
            prompt: {
              chainName: step.prompt.chainName,
              commandName: step.prompt.commandName,
              promptCategory: step.prompt.promptCategory,
              promptName: step.prompt.promptName,
            },
            promptType: step.promptType,
            step: step.step,
          })),
        };
        return transformed;
      } catch (error) {
        log(['SDK useChain() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null }
  );
}

export function useChains(): SWRResponse<Chain[]> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Chain[]>(
    '/chains',
    async (): Promise<Chain[]> => {
      try {
        const chains = await sdk.getChains();
        // Transform the chains to match the expected schema
        return chains.map((chainName: string) => ({
          id: chainName, // Using chainName as ID since SDK doesn't provide IDs
          chainName: chainName,
          steps: [], // Steps will be loaded separately when needed
        }));
      } catch (error) {
        log(['SDK useChains() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] }
  );
}