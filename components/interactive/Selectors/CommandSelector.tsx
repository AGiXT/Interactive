'use client';

import usePathname from '@/components/idiot/auth/hooks/usePathname';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import React from 'react';
import { useContext, useEffect, useState } from 'react';
import { InteractiveConfigContext } from '../InteractiveConfigContext';

export function CommandSelector({
  agentName,
  value,
  onChange,
  category = 'Default',
}: {
  agentName: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  category?: string;
}): React.JSX.Element {
  const state = useContext(InteractiveConfigContext);
  const [commands, setCommands] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchCommands = async () => {
      try {
        if (agentName) {
          const agentCommands = await state.agixt.getCommands(agentName);
          setCommands(typeof agentCommands === 'object' ? Object.keys(agentCommands) : []);
        } else {
          setCommands([]);
        }

      } catch (err) {
        setError(err as Error);
      }
    };
    fetchCommands();
  }, [state.agixt, agentName]);

  if (error) return <div>Failed to load commands: {error.message}</div>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={commands.length === 0}
              value={value || searchParams.get('command') || undefined}
              onValueChange={
                onChange
                  ? (value) => onChange(value)
                  : (value) => {
                      const current = new URLSearchParams(Array.from(searchParams.entries()));
                      current.set('command', value);
                      const search = current.toString();
                      const query = search ? `?${search}` : '';
                      router.push(`${pathname}${query}`);
                    }
              }
            >
              <SelectTrigger className='w-full text-xs'>
                <SelectValue placeholder='Select a Command' />
              </SelectTrigger>
              <SelectContent>
                {!pathname.includes('settings/commands') && <SelectItem value='/'>- Use Agent Default -</SelectItem>}
                {commands.map(command => (
                  command && (
                    <SelectItem key={command} value={command}>
                      {command}
                    </SelectItem>
                  )
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select a Command</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
