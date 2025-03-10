import axios from 'axios';
import { getCookie } from 'cookies-next';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../next-log/log';

export const CompanySchema = z.object({
  agents: z.array(
    z.object({
      companyId: z.string().uuid(),
      default: z.boolean(),
      id: z.string().uuid(),
      name: z.string().min(1),
      status: z.union([z.boolean(), z.literal(null)]),
    }),
  ),
  id: z.string().uuid(),
  companyId: z.union([z.string().uuid(), z.null()]),
  name: z.string().min(1),
  primary: z.boolean(),
  roleId: z.number().int().positive(),
  extensions: z.array(z.unknown()).optional()
});

export type Company = z.infer<typeof CompanySchema>;

export const RoleSchema = z.enum(['user', 'system', 'assistant', 'function']);

export const UserSchema = z.object({
  companies: z.array(CompanySchema),
  email: z.string().email(),
  firstName: z.string().min(1),
  id: z.string().uuid(),
  lastName: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;

const emptyUser: User = {
  companies: [],
  email: '',
  firstName: '',
  id: '',
  lastName: '',
};

async function fetchUser(): Promise<User | null> {
  if (!getCookie('jwt')) return null;
  
  try {
    log(['REST useUser() Fetching user'], {
      client: 3,
    });
    
    const response = await axios.get(`${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/user`, {
      headers: {
        Authorization: getCookie('jwt'),
      },
    });
    
    log(['REST useUser() Response', response.data], {
      client: 3,
    });
    
    return UserSchema.parse(response.data);
  } catch (error) {
    log(['REST useUser() Error', error], {
      client: 1,
    });
    return emptyUser;
  }
}

export function useUser(): SWRResponse<User | null> {
  return useSWR<User | null>(
    ['/user', getCookie('jwt')],
    fetchUser,
    {
      fallbackData: emptyUser,
    },
  );
}

export function useCompanies(): SWRResponse<Company[]> {
  const userHook = useUser();
  const { data: user } = userHook;

  const swrHook = useSWR<Company[]>(
    ['/companies', user],
    () => user?.companies || [],
    { fallbackData: [] }
  );

  return swrHook;
}

export function useCompany(id?: string): SWRResponse<Company | null> {
  const companiesHook = useCompanies();
  const { data: companies } = companiesHook;

  return useSWR<Company | null>(
    [`/company?id=${id}`, companies, getCookie('jwt')],
    async (): Promise<Company | null> => {
      if (!getCookie('jwt')) return null;
      try {
        if (id) {
          return companies?.find((c) => c.id === id) || null;
        } else {
          log(['REST useCompany() Companies', companies], {
            client: 1,
          });
          const agentName = getCookie('agixt-agent');
          log(['REST useCompany() AgentName', agentName], {
            client: 1,
          });
          
          const targetCompany =
            companies?.find((c) => (agentName ? c.agents.some((a) => a.name === agentName) : c.primary)) || null;
          
          log(['REST useCompany() Company', targetCompany], {
            client: 1,
          });
          
          if (!targetCompany) return null;

          // Fetch company extensions
          const extensionsResponse = await axios.get(
            `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies/${targetCompany.id}/extensions`,
            {
              headers: {
                Authorization: getCookie('jwt'),
              },
            },
          );

          return {
            ...targetCompany,
            extensions: extensionsResponse.data.extensions
          };
        }
      } catch (error) {
        log(['REST useCompany() Error', error], {
          client: 3,
        });
        return null;
      }
    },
    { fallbackData: null },
  );
}
