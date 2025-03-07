import { useContext } from 'react';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import AGiXTSDK from '@/lib/sdk';
import useSWR, { SWRResponse } from 'swr';
import { z } from 'zod';
import log from '../../next-log/log';

export const InvitationSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  inviterId: z.string().uuid(),
  isAccepted: z.boolean(),
  roleId: z.string().uuid(),
});

export type Invitation = z.infer<typeof InvitationSchema>;
/**
 * Hook to fetch and manage invitations
 * @param companyId - Optional company ID to fetch invitations for
 * @returns SWR response containing array of invitations
 */
export function useInvitations(companyId?: string): SWRResponse<Invitation[]> {
  const config = useContext(InteractiveConfigContext);
  const sdk = new AGiXTSDK({ baseUri: config.baseUri });

  return useSWR<Invitation[]>(
    companyId ? [`/invitations`, companyId] : '/invitations',
    async (): Promise<Invitation[]> => {
      try {
        const invitations = await sdk.getInvitations(companyId);
        return invitations;
      } catch (error) {
        log(['SDK useInvitations() Error', error], {
          client: 1,
        });
        return [];
      }
    },
    { fallbackData: [] },
  );
}
