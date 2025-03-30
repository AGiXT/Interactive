'use client';

import { DialogTitle } from '@radix-ui/react-dialog';
import { useMediaQuery } from 'react-responsive';
import { useEffect, useState } from 'react';

import { ChatHistoryGroup } from '@/components/command-menu/group/chat-history';
import { NavigationGroup } from '@/components/command-menu/group/navigation';
import { QuickActionsGroup } from '@/components/command-menu/group/quick-actions';
import { useCommandMenu } from '@/components/command-menu/command-menu-context';
import { ThemeGroup } from '@/components/command-menu/group/theme';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

export type CommandMenuItem = {
  icon: any;
  label: string;
  description: string;
  url?: string;
  disabled?: boolean;
  keywords?: string[];
};

export type CommandMenuGroup = {
  heading: string;
  items: CommandMenuItem[];
};

export function CommandMenu() {
  const { open, setOpen, setSubPages, search, setSearch } = useCommandMenu();
  const [mounted, setMounted] = useState(false);
  
  // Initialize with a default value, will be updated after mount
  const [isMobile, setIsMobile] = useState(false);
  
  // Use react-responsive to detect viewport size
  const mobileQuery = useMediaQuery({ maxWidth: 768 });
  
  // Update state after component mounts to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setIsMobile(mobileQuery);
  }, [mobileQuery]);
  
  // Update when media query changes
  useEffect(() => {
    if (mounted) {
      setIsMobile(mobileQuery);
    }
  }, [mobileQuery, mounted]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Backspace' && !search)) {
            e.preventDefault();
            setSubPages((pages) => pages.slice(0, -1));
          }
        }}
      >
        <DialogTitle className='sr-only'>Command Menu</DialogTitle>
        <CommandInput 
          value={search} 
          onValueChange={setSearch} 
          placeholder="Type a command or search..." 
          className={isMobile ? 'text-base p-4' : ''}
        />
        <CommandList className={isMobile ? 'max-h-[60vh]' : ''}>
          <CommandEmpty>No results found.</CommandEmpty>
          <QuickActionsGroup />
          <ChatHistoryGroup />
          <NavigationGroup />
          <CommandSeparator />
          <ThemeGroup />
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

interface CommandItemProps {
  item: {
    label: string;
    icon: React.ElementType;
    description?: string;
    disabled?: boolean;
    keywords?: string[];
  };
  onSelect: () => void;
}

export function CommandItemComponent({ item, onSelect }: CommandItemProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Use react-responsive to detect viewport size
  const mobileQuery = useMediaQuery({ maxWidth: 768 });
  
  // Update state after component mounts to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setIsMobile(mobileQuery);
  }, [mobileQuery]);
  
  // Update when media query changes
  useEffect(() => {
    if (mounted) {
      setIsMobile(mobileQuery);
    }
  }, [mobileQuery, mounted]);

  return (
    <CommandItem 
      disabled={item.disabled} 
      onSelect={onSelect} 
      keywords={item.keywords}
      className={isMobile ? 'py-3 px-4' : ''}
    >
      <item.icon className={isMobile ? 'w-5 h-5 mr-3' : 'w-4 h-4 mr-2'} />
      <div>
        <div className={isMobile ? 'text-base' : ''}>{item.label}</div>
      </div>
      {item.description && (
        <CommandShortcut className={`text-xs font-light text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
          {item.description}
        </CommandShortcut>
      )}
    </CommandItem>
  );
}