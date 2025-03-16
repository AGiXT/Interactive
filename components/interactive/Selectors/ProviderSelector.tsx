'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React, { useContext, useEffect, useState } from 'react';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

interface Provider {
  name: string;
  settings?: Array<{
    name: string;
    value: unknown;
  }>;
}

export default function ProviderSelector({
  service,
  value,
  onChange,
}: {
  service?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const state = useContext(InteractiveConfigContext);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      if (!state?.agixt) return;

      try {
        setLoading(true);
        let providerList: string[];
        
        if (service) {
          providerList = await state.agixt.getProvidersByService(service);
        } else {
          const allProviders = await state.agixt.getAllProviders();
          providerList = allProviders.map(p => p.name);
        }

        // Get settings for each provider
        const providersWithSettings = await Promise.all(
          providerList.map(async (name) => {
            try {
              const settings = await state.agixt.getProviderSettings(name);
              return { name, settings };
            } catch (err) {
              console.error(`Error fetching settings for provider ${name}:`, err);
              return { name };
            }
          })
        );

        setProviders(providersWithSettings);
      } catch (err) {
        console.error('Error fetching providers:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, [state?.agixt, service]);

  if (error) return <div>Failed to load providers: {error.message}</div>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={loading || providers.length === 0}
              value={value || undefined}
              onValueChange={onChange ? (value) => onChange(value) : undefined}
            >
              <SelectTrigger className='w-full text-xs'>
                <SelectValue placeholder='Select a Provider' />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.name} value={provider.name}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select a Provider</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}