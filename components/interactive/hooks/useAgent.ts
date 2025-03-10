import axios from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import { useContext } from 'react';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import { useCompanies } from '../../idiot/auth/hooks/useUser';
import log from '../../idiot/next-log/log';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

export const AgentSettingSchema = z.object({
  name: z.string(),
  value: z.string()
});

export const AgentSchema = z.object({
  companyId: z.string().uuid(),
  default: z.boolean(),
  id: z.string().uuid(),
  name: z.string().min(1),
  status: z.union([z.boolean(), z.literal(null)]),
  settings: z.array(AgentSettingSchema),
  companyName: z.string().optional()
});

export type AgentSetting = z.infer<typeof AgentSettingSchema>;
export type Agent = z.infer<typeof AgentSchema>;

// Base agent interface from API/company
interface BaseAgent {
  name: string;
  status: boolean | null;
  companyId: string;
  default: boolean;
  id: string;
  settings?: AgentSetting[] | AgentSetting;
}

// Company interface
interface Company {
  id: string;
  name: string;
  primary: boolean;
  agents: BaseAgent[];
}

function normalizeSettings(settings: AgentSetting[] | AgentSetting | undefined): AgentSetting[] {
  if (!settings) return [];
  return Array.isArray(settings) ? settings : [settings];
}

function convertToAgent(baseAgent: BaseAgent, companyName?: string): Agent {
  return {
    ...baseAgent,
    settings: normalizeSettings(baseAgent.settings),
    companyName,
  };
}

export function useAgents(): SWRResponse<Agent[]> {
  const companiesHook = useCompanies();
  const { data: companies = [] } = companiesHook;

  return useSWR<Agent[]>(
    ['/agents', companies],
    (): Agent[] =>
      companies.flatMap((company: Company) =>
        (company.agents || []).map((agent: BaseAgent) => 
          convertToAgent(agent, company.name)
        )
      ),
    { fallbackData: [] }
  );
}

export function useAgent(
  withSettings = false,
  name?: string,
): SWRResponse<{
  agent: Agent | null;
  commands: string[];
  extensions: any[];
}> {
  const getDefaultAgent = (companies: Company[]): Agent | null => {
    const primaryCompany = companies?.find((c) => c.primary);
    if (primaryCompany?.agents?.length) {
      const primaryAgent = primaryCompany.agents.find((a) => a.default);
      const baseAgent = primaryAgent || primaryCompany.agents[0];
      if (baseAgent?.name) {
        setCookie('agixt-agent', baseAgent.name, {
          domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        });
      }
      return baseAgent ? convertToAgent(baseAgent, primaryCompany.name) : null;
    }
    return null;
  };

  const companiesHook = useCompanies();
  const { data: companies = [] } = companiesHook;
  const state = useContext(InteractiveConfigContext);
  let searchName = name || (getCookie('agixt-agent') as string | undefined);
  let foundEarly: Agent | null = null;

  if (!searchName && companies.length) {
    foundEarly = getDefaultAgent(companies);
    searchName = foundEarly?.name;
  }

  log([`REST useAgent() SEARCH NAME: ${searchName}`], {
    client: 3,
  });

  return useSWR<{
    agent: Agent | null;
    commands: string[];
    extensions: any[];
  }>(
    searchName ? [`/agent?name=${searchName}`, companies, withSettings] : null,
    async () => {
      try {
        if (withSettings && searchName) {
          const agentConfig = await state.agixt.getAgentConfig(searchName);
          const commands = await state.agixt.getCommands(searchName);
          const extensions = await state.agixt.getAgentExtensions(searchName);
          
          // Convert API response to Agent type
          const baseAgent: BaseAgent = {
            companyId: agentConfig.companyId || 'default',
            default: agentConfig.default || false,
            id: agentConfig.id || 'default',
            name: agentConfig.name,
            status: agentConfig.status || null,
            settings: agentConfig.settings || []
          };

          return {
            agent: AgentSchema.parse(convertToAgent(baseAgent)),
            commands,
            extensions
          };
        } else {
          const toReturn = { agent: foundEarly, commands: [], extensions: [] };
          if (companies.length && !toReturn.agent && searchName) {
            for (const company of companies) {
              log(['REST useAgent() Checking Company', company], {
                client: 3,
              });
              const baseAgent = company.agents.find((a) => a.name === searchName);
              if (baseAgent) {
                toReturn.agent = convertToAgent(baseAgent, company.name);
              }
            }
          }
          if (!toReturn.agent) {
            log(['REST useAgent() Agent Not Found, Using Default', toReturn], {
              client: 3,
            });
            toReturn.agent = getDefaultAgent(companies);
          }
          if (toReturn.agent) {
            log(['REST useAgent() Agent Found, Getting Commands', toReturn], {
              client: 3,
            });
            toReturn.extensions = (
              await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/api/agent/${toReturn.agent.name}/extensions`, {
                headers: {
                  Authorization: getCookie('jwt'),
                },
              })
            ).data.extensions;
            toReturn.commands = await state.agixt.getCommands(toReturn.agent.name);
          } else {
            log(['REST useAgent() Did Not Get Agent', toReturn], {
              client: 3,
            });
          }
          return toReturn;
        }
      } catch (error) {
        log(['REST useAgent() Error', error], {
          client: 1,
        });
        return { agent: null, commands: [], extensions: [] };
      }
    },
    { fallbackData: { agent: null, commands: [], extensions: [] } }
  );
}
