import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../idiot/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

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
  const { agixt } = useContext(InteractiveConfigContext);

  return useSWR<Provider | null>(
    providerName ? [`/provider`, providerName] : null,
    async (): Promise<Provider | null> => {
      try {
        log(['REST useProvider() Fetching provider', providerName], {
          client: 3,
        });
        const settings = await agixt.getProviderSettings(providerName!);
        return ProviderSchema.parse(settings);
      } catch (error) {
        log(['REST useProvider() Error', error], {
          client: 1,
        });
        return null;
      }
    },
    { fallbackData: null },
  );
}

export function useProviders(): SWRResponse<Provider[]> {
  const { agixt } = useContext(InteractiveConfigContext);

  return useSWR<Provider[]>(
    '/providers',
    async (): Promise<Provider[]> => {
      try {
        log(['REST useProviders() Fetching providers'], {
          client: 3,
        });
        const providers = await agixt.getAllProviders();
        log(['REST useProviders() Response', providers], {
          client: 3,
        });
        const validated = z.array(ProviderSchema).parse(providers);
        log(['REST useProviders() Validated', validated], {
          client: 3,
        });
        return validated;
      } catch (error) {
        log(['REST useProviders() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] },
  );
}
