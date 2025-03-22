import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import { createGraphQLClient } from '@/components/interactive/lib';

export const ChainStepPromptSchema = z.object({
  chainName: z.string().nullable(),
  commandName: z.string().nullable(),
  promptCategory: z.string().nullable(),
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
  chainName: z.string(), //.min(1),
  steps: z.array(ChainStepSchema),
});
export const ChainsSchema = ChainSchema.pick({ id: true, chainName: true });

export type Chain = z.infer<typeof ChainSchema>;
export type ChainStepPrompt = z.infer<typeof ChainStepPromptSchema>;
export type ChainStep = z.infer<typeof ChainStepSchema>;

export function useChain(chainName?: string): SWRResponse<Chain | null> {
  const client = createGraphQLClient();

  return useSWR<Chain | null>(
    chainName ? [`/chain`, chainName] : null,
    async (): Promise<Chain | null> => {
      try {
        const query = ChainSchema.toGQL('query', 'GetChain', { chainName: chainName });
        const response = await client.request<{ chain: Chain }>(query, { chainName: chainName });
        const validated = ChainSchema.parse(response.chain);
        return validated;
      } catch (error) {
        console.error('Error fetching chain:', error);
        return null;
      }
    },
    { fallbackData: null },
  );
}

export function useChains(): SWRResponse<Chain[]> {
  const client = createGraphQLClient();

  return useSWR<Chain[]>(
    '/chains',
    async (): Promise<Chain[]> => {
      try {
        const query = ChainsSchema.toGQL('query', 'GetChains');
        const response = await client.request<{ chains: Chain[] }>(query);
        const validated = z.array(ChainsSchema).parse(response.chains);
        return validated;
      } catch (error) {
        console.error('Error fetching chains:', error);
        return [];
      }
    },
    { fallbackData: [] },
  );
}
