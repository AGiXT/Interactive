'use client';

import usePathname from '@/components/idiot/auth/hooks/usePathname';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { useContext, useEffect, useState } from 'react';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

export function ChainSelector({
  value,
  onChange,
}: {
  category?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const state = useContext(InteractiveConfigContext);
  const [chainData, setChainData] = useState<Array<{ id: string; chainName: string }>>([]);
  const [error, setError] = useState<Error | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchChains = async () => {
      try {
        const chains = await state.agixt.getChains();
        setChainData(chains.map(chainName => ({ id: chainName, chainName })));
      } catch (err) {
        setError(err as Error);
      }
    };
    fetchChains();
  }, [state.agixt]);

  if (error) return <div>Failed to load chains: {error.message}</div>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={!chainData || chainData.length === 0}
              value={value || searchParams.get('chain') || undefined}
              onValueChange={
                onChange
                  ? (value) => onChange(value)
                  : (value) => {
                      const current = new URLSearchParams(Array.from(searchParams.entries()));
                      current.set('chain', value);
                      const search = current.toString();
                      const query = search ? `?${search}` : '';
                      router.push(`${pathname}${query}`);
                    }
              }
            >
              <SelectTrigger className='w-full text-xs'>
                <SelectValue placeholder='Select a Chain' />
              </SelectTrigger>
              <SelectContent>
                {!pathname.includes('settings/chains') && <SelectItem value='/'>- Use Agent Default -</SelectItem>}

                {chainData?.map((chain) => (
                  <SelectItem key={chain.id} value={chain.chainName}>
                    {chain.chainName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select a Chain</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
