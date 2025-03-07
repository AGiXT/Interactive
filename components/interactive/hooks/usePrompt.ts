import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../jrg/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

export const PromptArgumentSchema = z.object({
  name: z.string(),
});

export const PromptSchema = z.object({
  name: z.string(),
  category: z.string(),
  content: z.string(),
  description: z.string().optional(),
  arguments: z.array(PromptArgumentSchema),
});

export type Prompt = z.infer<typeof PromptSchema>;
export type PromptArgument = z.infer<typeof PromptArgumentSchema>;

export function usePrompts(): SWRResponse<Prompt[]> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Prompt[]>(
    '/prompts',
    async (): Promise<Prompt[]> => {
      try {
        const categories = await sdk.getPromptCategories();
        const prompts: Prompt[] = [];
        
        for (const category of categories) {
          const categoryPrompts = await sdk.getPrompts(category);
          for (const promptName of categoryPrompts) {
            const prompt = await sdk.getPrompt(promptName, category);
            const args = await sdk.getPromptArgs(promptName, category);
            prompts.push({
              name: promptName,
              category: category,
              content: prompt,
              arguments: Object.keys(args || {}).map(name => ({ name })),
            });
          }
        }
        
        return prompts;
      } catch (error) {
        log(['SDK usePrompts() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] }
  );
}

export function usePrompt(name: string): SWRResponse<Prompt | null> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Prompt | null>(
    name ? ['/prompt', name] : null,
    async (): Promise<Prompt | null> => {
      try {
        const categories = await sdk.getPromptCategories();
        
        for (const category of categories) {
          const categoryPrompts = await sdk.getPrompts(category);
          if (categoryPrompts.includes(name)) {
            const prompt = await sdk.getPrompt(name, category);
            const args = await sdk.getPromptArgs(name, category);
            return {
              name: name,
              category: category,
              content: prompt,
              arguments: Object.keys(args || {}).map(name => ({ name })),
            };
          }
        }
        
        return null;
      } catch (error) {
        log(['SDK usePrompt() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null }
  );
}