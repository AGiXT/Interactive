import { TbMessageCirclePlus } from 'react-icons/tb';
import { ArrowRight, HistoryIcon, Palette } from 'lucide-react';
import { useCallback } from 'react';
import { CommandItemComponent } from '@/components/command-menu/index';
import { SubPage, useCommandMenu } from '@/components/command-menu/command-menu-context';
import { CommandGroup, CommandSeparator } from '@/components/ui/command';
import { useRouter } from 'next/navigation';
export type QuickAction = {
  label: string;
  icon: React.ElementType;
  shortcut: string[];
  subPage?: string;
};

export function QuickActionsGroup() {
  const { openSubPage, currentSubPage, setOpen } = useCommandMenu();
  const router = useRouter();

  const onSelect = useCallback(
    (item: { subPage?: string }) => {
      if (item.subPage) {
        openSubPage(item.subPage as SubPage);
      }
    },
    [openSubPage],
  );

  if (currentSubPage !== null) return null;

  const handleNewChat = () => {
    router.push('/chat');
    setOpen(false);
  };

  return (
    <>
      <CommandGroup heading='Quick Actions'>
        <CommandItemComponent
          item={{ label: 'New Chat', icon: TbMessageCirclePlus, description: 'Create a new chat' }}
          onSelect={handleNewChat}
        />
        {quickActions.map((item) => (
          <CommandItemComponent key={item.label} item={item} onSelect={() => onSelect(item)} />
        ))}
      </CommandGroup>
      <CommandSeparator />
    </>
  );
}

export const quickActions = [
  {
    label: 'Chat History',
    icon: HistoryIcon,
    description: 'View your chat history',
    keywords: ['chat', 'history', 'conversation', 'messages'],
    subPage: 'chat-history',
  },
  {
    label: 'Go to Page',
    icon: ArrowRight,
    description: 'Visit a page',
    keywords: ['page', 'visit', 'navigate', 'link'],
    subPage: 'navigation',
  },
  {
    label: 'Theme',
    icon: Palette,
    description: 'Change the theme',
    keywords: ['theme', 'colour', 'blind', 'mode', 'color', 'dark', 'light', 'system', 'colourblind', 'colourblind-dark'],
    subPage: 'theme',
  },
];
