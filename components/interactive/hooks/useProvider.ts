import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../jrg/next-log/log';
import { useContext } from 'react';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

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
// ============================================================================
// Provider Related Hooks
// ============================================================================

/**
 * Hook to fetch and manage provider data
 * @param providerName - Optional provider name to fetch specific provider
 * @returns SWR response containing provider data
 */
export function useProvider(providerName?: string): SWRResponse<Provider | null> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Provider | null>(
    providerName ? [`/provider`, providerName] : null,
    async (): Promise<Provider | null> => {
      try {
        if (!providerName) return null;
        const settings = await sdk.getProviderSettings(providerName);
        return {
          id: providerName, // Using name as ID since SDK doesn't provide IDs
          name: providerName,
          settings: Object.entries(settings).map(([name, value]) => ({
            name,
            value: String(value),
          }))
        };
      } catch (error) {
        log(['GQL useProvider() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null },
  );
}

/**
 * Hook to fetch and manage all providers
 * @returns SWR response containing array of providers
 */
export function useProviders(): SWRResponse<Provider[]> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Provider[]>(
    '/providers',
    async (): Promise<Provider[]> => {
      try {
        const providers = await sdk.getProviders();
        const settings = await Promise.all(
          providers.map(async name => ({
            id: name,
            name,
            settings: Object.entries(await sdk.getProviderSettings(name)).map(([name, value]) => ({
              name,
              value: String(value),
            }))
          }))
        );
        log(['SDK useProviders() Response', settings], {
          client: 3,
        });
        return settings;
      } catch (error) {
        log(['GQL useProviders() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] },
  );
}
