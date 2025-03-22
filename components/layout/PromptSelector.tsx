'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { usePrompts } from '@/components/interactive/usePrompt';
import { usePathname as useNextPathname } from 'next/navigation';

export function usePathname() {
  const pathname = useNextPathname();
  const [currentPathname, setCurrentPathname] = useState(pathname);

  useEffect(() => {
    setCurrentPathname(pathname);
  }, [pathname]);

  return currentPathname;
}

export default function PromptSelector({
  category = 'Default',
  value,
  onChange,
}: {
  category?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
}): React.JSX.Element {
  const { data: promptData, error } = usePrompts();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {}, [value]);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={promptData?.length === 0}
              value={value || searchParams.get('prompt') || undefined}
              onValueChange={
                onChange
                  ? (value) => {
                      onChange(value);
                    }
                  : (value) => router.push(`/settings/prompts?category=${category}&prompt=${value}`)
              }
            >
              <SelectTrigger className='w-full text-xs'>
                <SelectValue placeholder='Select a Prompt' />
              </SelectTrigger>
              <SelectContent>
                {!pathname.includes('settings/prompts') && <SelectItem value='/'>- Use Agent Default -</SelectItem>}
                {promptData?.map((prompt, index) => (
                  <SelectItem key={prompt.name} value={prompt.name}>
                    {prompt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Select a Prompt</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
