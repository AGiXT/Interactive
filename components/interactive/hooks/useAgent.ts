import { getCookie, setCookie } from 'cookies-next';
import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import { useCompanies } from '../../jrg/auth/hooks/useUser';
import log from '../../jrg/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';

export const AgentSchema = z.object({
  companyId: z.string().uuid(),
  default: z.boolean(),
  id: z.string().uuid(),
  name: z.string().min(1),
  status: z.union([z.boolean(), z.literal(null)]),
  settings: z.array(z.object({ name: z.string(), value: z.string() })),
});

export type Agent = z.infer<typeof AgentSchema>;

export function useAgents(): SWRResponse<Agent[]> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });
  
  const companiesHook = useCompanies();
  const { data: companies } = companiesHook;

  const swrHook = useSWR<Agent[]>(
    ['/agents', companies],
    async (): Promise<Agent[]> => {
      const agents = await sdk.getAgents();
      return agents.map(agent => ({
        ...agent,
        companyId: companies?.[0]?.id || '',
        id: agent.name, // Using name as ID since SDK doesn't provide IDs
        name: agent.name,
        status: true, // Default to true since SDK doesn't provide status
        settings: Object.entries(agent.settings || {}).map(([name, value]) => ({
          name,
          value: String(value)
        }))
      }));
    },
    { fallbackData: [] }
  );

  return swrHook;
}