import axios from 'axios';
import { getCookie } from 'cookies-next';
import { useContext, useEffect, useState } from 'react';
import { z } from 'zod';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';

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

export function useCompanies() {
  const { data: user } = useUser();
  return { data: user?.companies || [] };
}

export function useCompany(id?: string) {
  const { data: companies } = useCompanies();
  const state = useContext(InteractiveConfigContext);
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!getCookie('jwt')) return;
      
      try {
        if (id) {
          const foundCompany = companies?.find((c) => c.id === id);
          setCompany(foundCompany || null);
        } else {
          const agentName = getCookie('agixt-agent');
          let targetCompany = companies?.find((c) => 
            agentName ? c.agents.some((a) => a.name === agentName) : c.primary
          ) || null;
          
          if (!targetCompany) {
            setCompany(null);
            return;
          }

          try {
            const extensionsResponse = await axios.get(
              `${process.env.NEXT_PUBLIC_AGIXT_SERVER}/v1/companies/${targetCompany.id}/extensions`,
              {
                headers: {
                  Authorization: getCookie('jwt'),
                },
              }
            );
            targetCompany = { ...targetCompany, extensions: extensionsResponse.data.extensions };
          } catch (extensionsError) {
            console.error("Error fetching extensions:", extensionsError);
          }
          setCompany(targetCompany);
        }
      } catch (error) {
        console.error('Error fetching company:', error);
        setError(error as Error);
        setCompany(null);
      }
    };

    fetchCompany();
  }, [id, companies, state?.agixt]);

  return { data: company, error };
}

export const RoleSchema = z.enum(['user', 'system', 'assistant', 'function']);

export const UserSchema = z.object({
  companies: z.array(CompanySchema),
  email: z.string().email(),
  firstName: z.string().min(1),
  id: z.string().uuid(),
  lastName: z.string().min(1),
});

export type User = z.infer<typeof UserSchema>;

export function useUser() {
  const state = useContext(InteractiveConfigContext);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!getCookie('jwt') || !state?.agixt) return;

      try {
        const userData = await state.agixt.getUser();
        setUser(UserSchema.parse(userData));
      } catch (error) {
        console.error('Error fetching user:', error);
        setError(error as Error);
        setUser(null);
      }
    };

    fetchUser();
  }, [state?.agixt]);

  return { 
    data: user, 
    error,
    isLoading: !user && !error
  };
}
