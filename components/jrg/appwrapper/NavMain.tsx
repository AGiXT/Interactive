'use client';

import { ChevronRightIcon } from '@radix-ui/react-icons';
import {
  BookOpen,
  Bot,
  GraduationCap,
  HelpCircle,
  Link as LuLink,
  Puzzle,
  Rocket,
  Settings,
  SquareLibrary,
  User,
  Users,
  VenetianMask,
  Workflow,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TbMessageCirclePlus } from 'react-icons/tb';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useCompany } from '../auth/hooks/useUser';

type NestedItem = {
  title: string;
  url: string;
};

type SubItem = {
  max_role?: number;
  title: string;
  icon?: any;
  url: string;
  queryParams?: object;
  items?: NestedItem[];
};

type Item = {
  title: string;
  url?: string;
  visible?: boolean;
  icon?: any;
  isActive?: boolean;
  queryParams?: object;
  items?: SubItem[];
};

// Base documentation items without URL modification
const docItems = [
  {
    title: 'Introduction',
    icon: BookOpen,
    items: [
      { title: 'Introduction', slug: '0-Introduction' }
    ],
  },
  {
    title: 'Getting Started',
    icon: Rocket,
    items: [
      { title: 'Quick Start', slug: '1-Getting started/0-Quick Start' },
      { title: 'Environment Variables', slug: '1-Getting started/1-Environment Variables' },
      { title: 'Examples', slug: '1-Getting started/3-Examples' },
      { title: 'Things to Consider', slug: '1-Getting started/4-Things to Consider' },
      { title: 'Preinstalled ISOs', slug: '1-Getting started/5-Preinstalled ISOs' },
      { title: 'Support', slug: '1-Getting started/Support' },
    ],
  },
  {
    title: 'Core Concepts',
    icon: BookOpen,
    items: [
      { title: 'Core Concepts', slug: '2-Concepts/0-Core Concepts' },
      { title: 'Processes and Frameworks', slug: '2-Concepts/01-Processes and Frameworks' },
      { title: 'Providers', slug: '2-Concepts/02-Providers' },
      { title: 'Agents', slug: '2-Concepts/03-Agents' },
      { title: 'Chat Completions', slug: '2-Concepts/04-Chat Completions' },
      { title: 'Extension Commands', slug: '2-Concepts/05-Extension Commands' },
      { title: 'Prompts', slug: '2-Concepts/06-Prompts' },
      { title: 'Chains', slug: '2-Concepts/07-Chains' },
      { title: 'Conversations', slug: '2-Concepts/07-Conversations' },
      { title: 'Agent Training', slug: '2-Concepts/09-Agent Training' },
      { title: 'Agent Interactions', slug: '2-Concepts/10-Agent Interactions' },
      { title: 'Extensions', slug: '2-Concepts/11-Extensions' },
    ],
  },
  {
    title: 'Providers',
    icon: Bot,
    items: [
      { title: 'ezLocalai', slug: '3-Providers/0-ezLocalai' },
      { title: 'Anthropic Claude', slug: '3-Providers/1-Anthropic Claude' },
      { title: 'Azure OpenAI', slug: '3-Providers/2-Azure OpenAI' },
      { title: 'xAI', slug: '3-Providers/3-xAI' },
      { title: 'Google', slug: '3-Providers/4-Google' },
      { title: 'Hugging Face', slug: '3-Providers/5-Hugging Face' },
      { title: 'OpenAI', slug: '3-Providers/6-OpenAI' },
      { title: 'GPT4Free', slug: '3-Providers/7-GPT4Free' },
    ],
  },
  {
    title: 'Authentication',
    icon: VenetianMask,
    items: [
      { title: 'Amazon', slug: '4-Authentication/amazon' },
      { title: 'GitHub', slug: '4-Authentication/github' },
      { title: 'Google', slug: '4-Authentication/google' },
      { title: 'Microsoft', slug: '4-Authentication/microsoft' },
    ],
  },
  {
    title: 'Reference',
    icon: BookOpen,
    items: [
      { title: 'API Reference', slug: '5-Reference/0-API Reference' },
      { title: 'Privacy Policy', slug: '5-Reference/1-Privacy Policy' },
    ],
  },
];

// Convert doc items to nav items with proper URLs
const docNavItems = docItems.map(section => ({
  ...section,
  url: '/docs',
  items: section.items.map(item => ({
    title: item.title,
    url: `/docs/${item.slug}`,
  })),
}));

export const items: Item[] = [
  {
    title: 'New Chat',
    url: '/chat',
    icon: TbMessageCirclePlus,
    isActive: true,
  },
  {
    title: 'Agent Management',
    icon: Bot,
    items: [
      {
        title: 'Prompt Library',
        icon: SquareLibrary,
        url: '/settings/prompts',
      },
      {
        title: 'Chain Library',
        icon: LuLink,
        url: '/settings/chains',
      },
      {
        title: 'Training',
        icon: GraduationCap,
        url: '/settings/training',
        queryParams: {
          mode: 'user',
        },
      },
      {
        title: 'Extensions',
        icon: Puzzle,
        url: '/settings/extensions',
        queryParams: {
          tab: 'extensions',
          mode: 'user',
        },
      },
      {
        title: 'Abilities',
        icon: Workflow,
        url: '/settings/extensions',
        queryParams: {
          tab: 'abilities',
          mode: 'user',
        },
      },
      {
        title: 'Settings',
        icon: Settings,
        url: '/settings',
      },
    ],
  },
  {
    title: 'Team Management',
    icon: Users,
    items: [
      {
        title: 'Team',
        icon: User,
        url: '/team',
      },
      {
        title: 'Team Training',
        icon: GraduationCap,
        url: '/settings/training',
        queryParams: {
          mode: 'company',
        },
      },
      {
        title: 'Team Extensions',
        icon: Puzzle,
        url: '/settings/extensions',
        queryParams: {
          tab: 'extensions',
          mode: 'company',
        },
      },
      {
        title: 'Team Abilities',
        icon: Workflow,
        url: '/settings/extensions',
        queryParams: {
          tab: 'abilities',
          mode: 'company',
        },
      },
      {
        title: 'Team Settings',
        icon: Settings,
        url: '/settings',
        queryParams: {
          mode: 'company',
        },
      },
    ],
  },
  {
    title: 'Documentation',
    icon: BookOpen,
    items: docNavItems,
  },
];

export function NavMain() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();
  const { data: company } = useCompany();
  const { toggleSidebar, open } = useSidebar('left');

  const itemsWithActiveState = items.map((item) => ({
    ...item,
    isActive: isActive(item, pathname, queryParams),
  }));

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pages</SidebarGroupLabel>
      <SidebarMenu>
        {itemsWithActiveState.map(
          (item) =>
            item.visible !== false && (
              <Collapsible key={item.title} asChild defaultOpen={item.isActive} className='group/collapsible'>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      side='left'
                      tooltip={item.title}
                      onClick={() => {
                        if (!open) toggleSidebar();
                        if (item.url) router.push(item.url);
                      }}
                      className={cn(item.isActive && !item.items?.length && 'bg-muted')}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRightIcon
                        className={cn(
                          'ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90',
                          item.items?.length ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent hidden={!item.items?.length}>
                    <SidebarMenuSub className='pr-0 mr-0'>
                      {item.items?.map((subItem) =>
                        subItem.max_role && (!company?.name || company?.roleId > subItem.max_role) ? null : (
                          <SidebarMenuSubItem key={subItem.title}>
                            {subItem.items ? (
                              <Collapsible asChild>
                                <SidebarMenuItem>
                                  <CollapsibleTrigger asChild>
                                    <SidebarMenuButton
                                      side='left'
                                      tooltip={subItem.title}
                                      className={cn(pathname.startsWith(subItem.url) && 'bg-muted')}
                                    >
                                      {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                      <span>{subItem.title}</span>
                                      <ChevronRightIcon className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                                    </SidebarMenuButton>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <SidebarMenuSub>
                                      {subItem.items.map((nestedItem) => (
                                        <SidebarMenuSubItem key={nestedItem.url}>
                                          <SidebarMenuSubButton asChild>
                                            <Link
                                              href={nestedItem.url}
                                              className={cn('w-full', pathname === nestedItem.url && 'bg-muted')}
                                            >
                                              <span className='flex items-center gap-2'>
                                                {nestedItem.title}
                                              </span>
                                            </Link>
                                          </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                      ))}
                                    </SidebarMenuSub>
                                  </CollapsibleContent>
                                </SidebarMenuItem>
                              </Collapsible>
                            ) : (
                              <SidebarMenuSubButton asChild>
                                <Link
                                  href={
                                    subItem.queryParams
                                      ? Object.entries(subItem.queryParams).reduce(
                                          (url, [key, value]) => url + `${key}=${value}&`,
                                          subItem.url + '?',
                                        )
                                      : subItem.url
                                  }
                                  className={cn('w-full', isSubItemActive(subItem, pathname, queryParams) && 'bg-muted')}
                                >
                                  <span className='flex items-center gap-2'>
                                    {subItem.icon && <subItem.icon className='w-4 h-4' />}
                                    {subItem.max_role && company?.name + ' '}
                                    {subItem.title}
                                  </span>
                                </Link>
                              </SidebarMenuSubButton>
                            )}
                          </SidebarMenuSubItem>
                        ),
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            ),
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function isActive(item: Item, pathname: string, queryParams: URLSearchParams) {
  if (item.items) {
    return item.items.some((subItem) => {
      if (subItem.url === pathname) {
        if (subItem.queryParams) {
          return Object.entries(subItem.queryParams).every(([key, value]) => queryParams.get(key) === value);
        }
        // If no query params are defined on the item, require URL to have no query params
        return [...queryParams.keys()].length === 0;
      }
      return false;
    });
  }

  // Root level items
  if (item.url === pathname) {
    if (item.queryParams) {
      return Object.entries(item.queryParams).every(([key, value]) => queryParams.get(key) === value);
    }
    return [...queryParams.keys()].length === 0;
  }
  return false;
}

function isSubItemActive(subItem: SubItem, pathname: string, queryParams: URLSearchParams) {
  if (subItem.url !== pathname) {
    return false;
  }

  // If subitem has query params, they must all match
  if (subItem.queryParams) {
    return Object.entries(subItem.queryParams).every(([key, value]) => queryParams.get(key) === value);
  }

  // If no query params defined on subitem, URL must have no query params
  return queryParams.size === 0;
}
