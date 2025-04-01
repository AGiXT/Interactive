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
  onMouseDown,
  onTouchStart,
  onBlur, // Added onBlur prop
}: {
  category?: string;
  value?: string | null;
  onChange?: (value: string | null) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onBlur?: () => void; // Added onBlur prop
}): React.JSX.Element {
  const { data: promptData, error } = usePrompts();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Debug the incoming value
  useEffect(() => {
    // console.log('PromptSelector received value:', value);
  }, [value]);

  // Convert null to undefined for the Select component
  const selectValue = value === null ? undefined : value;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className='w-full'>
            <Select
              disabled={promptData?.length === 0}
              value={selectValue}
              onValueChange={
                onChange
                  ? (selectedValue) => {
                      // Handle the '/' or empty value case
                      onChange(selectedValue === '/' ? null : selectedValue);
                    }
                  : (selectedValue) => router.push(`/settings/prompts?category=${category}&prompt=${selectedValue}`)
              }
            >
              <SelectTrigger
                className='w-full text-xs'
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onBlur={onBlur} // Attach onBlur here
              >
                <SelectValue placeholder='Select a Prompt' />
              </SelectTrigger>
              <SelectContent>
                {pathname.includes('settings/chains') && <SelectItem value='/'>- None -</SelectItem>}
                {!pathname.includes('settings/prompts') && !pathname.includes('settings/chains') && (
                  <SelectItem value='/'>- Use Agent Default -</SelectItem>
                )}
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
