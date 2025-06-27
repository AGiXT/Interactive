import { chainMutations, createGraphQLClient } from '@/components/interactive/lib';
import '@/components/interactive/zod2gql';
import axios from 'axios';
import { getCookie, setCookie } from 'cookies-next';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';

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
});

export type Company = z.infer<typeof CompanySchema>;

// Extended Company type that includes dynamically loaded extensions
export type CompanyWithExtensions = Company & {
  extensions?: any[];
};

export function useCompanies(): SWRResponse<Company[]> {
  const userHook = useUser();
  const { data: user } = userHook;

  const swrHook = useSWR<Company[]>(['/companies', user], () => user?.companies || [], { fallbackData: [] });

  const originalMutate = swrHook.mutate;
  swrHook.mutate = chainMutations(userHook, originalMutate);

  return swrHook;
}

export function useCompany(id?: string): SWRResponse<CompanyWithExtensions | null> {
  const companiesHook = useCompanies();
  const { data: companies } = companiesHook;
  const swrHook = useSWR<CompanyWithExtensions | null>(
    [`/company?id=${id}`, companies, getCookie('jwt')],
    async (): Promise<CompanyWithExtensions | null> => {
      if (!getCookie('jwt')) return null;
      try {
        if (id) {
          return companies?.find((c) => c.id === id) || null;
        } else {
          const agentName = getCookie('agixt-agent');
          const targetCompany =
            companies?.find((c) => (agentName ? c.agents.some((a) => a.name === agentName) : c.primary)) || null;
          if (!targetCompany) return null;
          setCookie('agixt-company', targetCompany.id);
          const extendedCompany = targetCompany as CompanyWithExtensions;
          extendedCompany.extensions = (
            await axios.get(
              `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies/${targetCompany.id}/extensions`,

              {
                headers: {
                  Authorization: getCookie('jwt'),
                },
              },
            )
          ).data.extensions;
          return extendedCompany;
        }
      } catch (error) {
        console.error('Error fetching company:', error);
        return null;
      }
    },
    { fallbackData: null },
  );

  const originalMutate = swrHook.mutate;
  swrHook.mutate = chainMutations(companiesHook, originalMutate);

  return swrHook;
}

export const RoleSchema = z.enum(['user', 'system', 'assistant', 'function']);

export const UserSchema = z.object({
  companies: z.array(CompanySchema),
  email: z.string().email(),
  firstName: z.string().min(1),
  id: z.string().uuid(),
  lastName: z.string(),
});

export type User = z.infer<typeof UserSchema>;

export function useUser(): SWRResponse<User | null> {
  const client = createGraphQLClient();

  return useSWR<User | null>(
    ['/user', getCookie('jwt')],
    async (): Promise<User | null> => {
      if (!getCookie('jwt')) return null;
      try {
        const query = UserSchema.toGQL('query', 'GetUser');
        const response = await client.request<{ user: User }>(query);
        return UserSchema.parse(response.user);
      } catch (error) {
        console.error('Error fetching user:', error);
        return {
          companies: [],
          email: '',
          firstName: '',
          id: '',
          lastName: '',
        };
      }
    },
    {
      fallbackData: {
        companies: [],
        email: '',
        firstName: '',
        id: '',
        lastName: '',
      },
    },
  );
}
