'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { z } from 'zod';
import { useUser, useCompany } from './useUser';
import { getCookie } from 'cookies-next';

// Zod schema for training data validation
const TrainingDataSchema = z.object({
  userPersona: z.string(),
  companyPersona: z.string(),
  userExternalSources: z.array(z.string()),
  companyExternalSources: z.array(z.string()),
});

type TrainingData = z.infer<typeof TrainingDataSchema>;

interface UseTrainingDataOptions {
  isCompanyMode: boolean;
  agentName?: string;
  companyId?: string;
}

const COLLECTION_NUMBER = '0';
const DEFAULT_AGENT = 'XT';

export function useTrainingData({ isCompanyMode, agentName, companyId }: UseTrainingDataOptions) {
  const { data: user } = useUser();
  const { data: company } = useCompany();
  
  // Use provided agentName or get from cookie/env
  const effectiveAgentName = agentName || getCookie('agixt-agent') || process.env.NEXT_PUBLIC_AGIXT_AGENT || DEFAULT_AGENT;
  
  // Determine if we should fetch (have required data)
  const shouldFetch = effectiveAgentName && (isCompanyMode ? companyId || company?.id : user);
  
  const swrKey = shouldFetch 
    ? ['/training-data', effectiveAgentName, isCompanyMode, companyId || company?.id]
    : null;

  const apiKey = getCookie('jwt') || '';
  const apiServer = process.env.NEXT_PUBLIC_AGIXT_SERVER as string;

  const { data, error, mutate, isLoading } = useSWR<TrainingData>(
    swrKey,
    async ([, agent, isCompany, companyIdParam]) => {
      // Fetch persona and external sources in parallel
      const personaUrl = isCompany
        ? `${apiServer}/api/agent/${agent}/persona/${companyIdParam}`
        : `${apiServer}/api/agent/${agent}/persona`;
      
      const sourcesUrl = isCompany
        ? `${apiServer}/api/agent/${agent}/memory/external_sources/${COLLECTION_NUMBER}/${companyIdParam}`
        : `${apiServer}/api/agent/${agent}/memory/external_sources/${COLLECTION_NUMBER}`;

      const [personaResult, sourcesResult] = await Promise.allSettled([
        fetch(personaUrl, { headers: { Authorization: apiKey } }),
        fetch(sourcesUrl, { headers: { Authorization: apiKey } })
      ]);

      // Process persona data
      let userPersona = '';
      let companyPersona = '';
      
      if (personaResult.status === 'fulfilled' && personaResult.value.ok) {
        const personaData = await personaResult.value.json();
        const persona = personaData.message === 'None' ? '' : personaData.message || '';
        if (isCompany) {
          companyPersona = persona;
        } else {
          userPersona = persona;
        }
      }

      // Process external sources data
      let userExternalSources: string[] = [];
      let companyExternalSources: string[] = [];
      
      if (sourcesResult.status === 'fulfilled' && sourcesResult.value.ok) {
        const sourcesData = await sourcesResult.value.json();
        const sources = Array.isArray(sourcesData['external_sources']) 
          ? sourcesData['external_sources'] 
          : [];
        
        if (isCompany) {
          companyExternalSources = sources;
        } else {
          userExternalSources = sources;
        }
      }

      // Return validated data
      return TrainingDataSchema.parse({
        userPersona,
        companyPersona,
        userExternalSources,
        companyExternalSources,
      });
    },
    {
      fallbackData: {
        userPersona: '',
        companyPersona: '',
        userExternalSources: [],
        companyExternalSources: [],
      },
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  // Helper function to update persona
  const updatePersona = async (persona: string): Promise<void> => {
    const url = isCompanyMode
      ? `${apiServer}/api/agent/${effectiveAgentName}/persona/${companyId || company?.id}`
      : `${apiServer}/api/agent/${effectiveAgentName}/persona`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        persona,
        company_id: isCompanyMode ? companyId || company?.id : null,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update persona');
    }

    // Optimistically update the cache
    if (data) {
      const updatedData = {
        ...data,
        [isCompanyMode ? 'companyPersona' : 'userPersona']: persona,
      };
      await mutate(updatedData, false);
    }
  };

  // Helper function to refresh sources
  const refreshSources = async (): Promise<void> => {
    await mutate();
  };

  return {
    data,
    error,
    isLoading,
    updatePersona,
    refreshSources,
    mutate,
  };
}