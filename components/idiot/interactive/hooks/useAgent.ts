import axios from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import { useCompanies } from '@/components/idiot/useUser';
import { InteractiveConfigContext } from '@/components/idiot/interactive/InteractiveConfigContext';
import { chainMutations, createGraphQLClient } from '@/components/idiot/interactive/hooks/lib';

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
  const companiesHook = useCompanies();
  const { data: companies } = companiesHook;

  const swrHook = useSWR<Agent[]>(
    ['/agents', companies],
    (): Agent[] =>
      companies?.flatMap((company) =>
        company.agents.map((agent) => ({
          ...agent,
          companyName: company.name,
        })),
      ) || [],
    { fallbackData: [] },
  );

  const originalMutate = swrHook.mutate;
  swrHook.mutate = chainMutations(companiesHook, originalMutate);
  return swrHook;
}

export function useAgent(
  withSettings = false,
  name?: string,
): SWRResponse<{
  agent: Agent | null;
  commands: string[];
}> {
  const getDefaultAgent = () => {
    const primaryCompany = companies.find((c) => c.primary);
    if (primaryCompany?.agents?.length) {
      const primaryAgent = primaryCompany?.agents.find((a) => a.default);
      foundEarly = primaryAgent || primaryCompany?.agents[0];
      searchName = foundEarly?.name;
      setCookie('agixt-agent', searchName, {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      });
    }
    return foundEarly;
  };
  const companiesHook = useCompanies();
  const { data: companies } = companiesHook;
  const state = useContext(InteractiveConfigContext);
  let searchName = name || (getCookie('agixt-agent') as string | undefined);
  let foundEarly = null;

  if (!searchName && companies?.length) {
    foundEarly = getDefaultAgent();
  }
  const swrHook = useSWR<{ agent: Agent | null; commands: string[]; extensions: any[] }>(
    [`/agent?name=${searchName}`, companies, withSettings],
    async (): Promise<{ agent: Agent | null; commands: string[]; extensions: any[] }> => {
      try {
        if (withSettings) {
          const client = createGraphQLClient();
          const query = AgentSchema.toGQL('query', 'GetAgent', { name: searchName });
          const response = await client.request<{ agent: Agent }>(query, { name: searchName });
          return AgentSchema.parse(response.agent);
        } else {
          const toReturn = { agent: foundEarly, commands: [], extensions: [] };
          if (companies?.length && !toReturn.agent) {
            for (const company of companies) {
              const agent = company.agents.find((a) => a.name === searchName);
              if (agent) {
                toReturn.agent = agent;
              }
            }
          }
          if (!toReturn.agent) {
            toReturn.agent = getDefaultAgent();
          }
          if (toReturn.agent) {
            toReturn.extensions = (
              await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${toReturn.agent.name}/extensions`, {
                headers: {
                  Authorization: getCookie('jwt'),
                },
              })
            ).data.extensions;
            toReturn.commands = await state.agixt.getCommands(toReturn.agent.name);
          }

          return toReturn;
        }
      } catch (error) {
        console.error('Error fetching agent:', error);
        return { agent: null, commands: [], extensions: [] };
      }
    },
    { fallbackData: { agent: null, commands: [], extensions: [] } },
  );
  const originalMutate = swrHook.mutate;
  swrHook.mutate = chainMutations(companiesHook, originalMutate);
  return swrHook;
}
