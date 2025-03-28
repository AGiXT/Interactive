'use client';

import { useState } from 'react';
import { setCookie } from 'cookies-next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LuEye as Eye, LuMoon as Moon, LuSun as Sun } from 'react-icons/lu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const icons = {
  dark: <Moon className='h-[1.2rem] w-[1.2rem]' />,
  light: <Sun className='h-[1.2rem] w-[1.2rem]' />,
};

export function ThemeToggle({ initialTheme }: { initialTheme?: string }) {
  const { currentTheme, themes, setTheme } = useTheme([], initialTheme);

  const Icon = icons[currentTheme.includes('dark') ? 'dark' : 'light'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='icon' className='rounded-full'>
          {Icon}
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        {themes.map((theme) => (
          <DropdownMenuItem key={theme} onClick={() => setTheme(theme)} className='capitalize'>
            {theme}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function IconButton({ Icon, label, description, ...props }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className='inline-block'>
          <Button {...props} className={cn('icon-btn', props.className || '')}>
            <Icon className='icon' />
            <span className='label'>{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  );
}

const defaultThemes = ['light', 'dark'];

export const useTheme = (customThemes?: string[], initialTheme?: string) => {
  const [themes, setThemes] = useState(() => {
    return Array.from(new Set([...defaultThemes, ...(customThemes ?? [])]));
  });
  const [currentTheme, setCurrentTheme] = useState(() => initialTheme ?? 'light');

  const setTheme = (newTheme: string) => {
    const classList = document.body.classList;
    classList.remove(...themes);
    classList.add(newTheme);

    setCookie('theme', newTheme, {
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    });

    setCurrentTheme(newTheme);
  };

  return {
    themes,
    currentTheme,
    setThemes,
    setTheme,
  };
};
