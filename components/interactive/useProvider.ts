import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import { createGraphQLClient } from '@/components/interactive/lib';

export const ProviderSettingSchema = z.object({
  name: z.string().min(1),
  value: z.unknown(),
});

export const ProviderSchema = z.object({
  name: z.string().min(1),
  friendlyName: z.string().min(1),
  description: z.string(),
  services: z.unknown(),
  settings: z.array(ProviderSettingSchema),
});

export type Provider = z.infer<typeof ProviderSchema>;

export function useProvider(providerName?: string): SWRResponse<Provider | null> {
  const client = createGraphQLClient();

  return useSWR<Provider | null>(
    providerName ? [`/provider`, providerName] : null,
    async (): Promise<Provider | null> => {
      try {
        const query = ProviderSchema.toGQL('query', 'GetProvider', { providerName });
        const response = await client.request<Provider>(query, { providerName });
        const validated = ProviderSchema.parse(response);
        return validated.provider;
      } catch (error) {
        console.error('Error fetching provider:', error);
        return null;
      }
    },
    { fallbackData: null },
  );
}

export function useProviders(): SWRResponse<Provider[]> {
  const client = createGraphQLClient();

  return useSWR<Provider[]>(
    '/providers',
    async (): Promise<Provider[]> => {
      try {
        const query = ProviderSchema.toGQL('query', 'GetProviders');
        const response = await client.request<Provider[]>(query);
        const validated = z.array(ProviderSchema).parse(response.providers);
        return validated;
      } catch (error) {
        console.error('Error fetching providers:', error);
        return [];
      }
    },
    { fallbackData: [] },
  );
}
