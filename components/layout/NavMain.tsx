'use client';

import { useMemo } from 'react';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import {
  BookOpen,
  Bot,
  GraduationCap,
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
import { useCompany } from '@/components/interactive/useUser';
import { getCookie } from 'cookies-next';
import { useEffect, useState } from 'react';

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
  icon?: any;
  isActive?: boolean;
  queryParams?: object;
  items?: SubItem[];
  roleThreshold?: number;
};

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
          mode: 'user',
        },
      },
      {
        title: 'Abilities',
        icon: Workflow,
        url: '/settings/abilities',
        queryParams: {
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
          mode: 'company',
        },
      },
      {
        title: 'Team Abilities',
        icon: Workflow,
        url: '/settings/abilities',
        queryParams: {
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
    roleThreshold: 2,
  },
  {
    title: 'Documentation',
    icon: BookOpen,
    items: [
      {
        title: 'Getting Started',
        icon: Rocket,
        url: '/docs',
        items: [
          { title: 'Introduction', url: '/docs/0-Introduction' },
          { title: 'Quick Start', url: '/docs/1-Getting started/0-Quick Start' },
          { title: 'Environment', url: '/docs/1-Getting started/1-Environment Variables' },
          { title: 'Examples', url: '/docs/1-Getting started/3-Examples' },
          { title: 'Things to Consider', url: '/docs/1-Getting started/4-Things to Consider' },
          { title: 'Preinstalled ISOs', url: '/docs/1-Getting started/5-Preinstalled ISOs' },
          { title: 'Support', url: '/docs/1-Getting started/Support' },
        ],
      },
      {
        title: 'Core Concepts',
        icon: BookOpen,
        url: '/docs',
        items: [
          { title: 'Core Concepts', url: '/docs/2-Concepts/0-Core Concepts' },
          { title: 'Processes and Frameworks', url: '/docs/2-Concepts/01-Processes and Frameworks' },
          { title: 'Providers', url: '/docs/2-Concepts/02-Providers' },
          { title: 'Agents', url: '/docs/2-Concepts/03-Agents' },
          { title: 'Chat Completions', url: '/docs/2-Concepts/04-Chat Completions' },
          { title: 'Extension Commands', url: '/docs/2-Concepts/05-Extension Commands' },
          { title: 'Prompts', url: '/docs/2-Concepts/06-Prompts' },
          { title: 'Chains', url: '/docs/2-Concepts/07-Chains' },
          { title: 'Conversations', url: '/docs/2-Concepts/07-Conversations' },
          { title: 'Agent Training', url: '/docs/2-Concepts/09-Agent Training' },
          { title: 'Agent Interactions', url: '/docs/2-Concepts/10-Agent Interactions' },
          { title: 'Extensions', url: '/docs/2-Concepts/11-Extensions' },
        ],
      },
      {
        title: 'Providers',
        icon: Bot,
        url: '/docs',
        items: [
          { title: 'ezLocalai', url: '/docs/3-Providers/0-ezLocalai' },
          { title: 'Anthropic Claude', url: '/docs/3-Providers/1-Anthropic Claude' },
          { title: 'Azure OpenAI', url: '/docs/3-Providers/2-Azure OpenAI' },
          { title: 'xAI', url: '/docs/3-Providers/3-xAI' },
          { title: 'Google', url: '/docs/3-Providers/4-Google' },
          { title: 'Hugging Face', url: '/docs/3-Providers/5-Hugging Face' },
          { title: 'OpenAI', url: '/docs/3-Providers/6-OpenAI' },
          { title: 'GPT4Free', url: '/docs/3-Providers/7-GPT4Free' },
        ],
      },
      {
        title: 'Authentication',
        icon: VenetianMask,
        url: '/docs',
        items: [
          { title: 'Amazon', url: '/docs/4-Authentication/amazon' },
          { title: 'GitHub', url: '/docs/4-Authentication/github' },
          { title: 'Google', url: '/docs/4-Authentication/google' },
          { title: 'Microsoft', url: '/docs/4-Authentication/microsoft' },
        ],
      },
      {
        title: 'Reference',
        icon: BookOpen,
        url: '/docs',
        items: [
          { title: 'Cryptocurrency', url: '/docs/5-Reference/2-Cryptocurrency' },
          { title: 'API Reference', url: '/docs/5-Reference/0-API Reference' },
          { title: 'Privacy Policy', url: '/docs/5-Reference/1-Privacy Policy' },
          { title: 'Social Media', url: '/docs/5-Reference/3-Social Media' },
        ],
      },
    ],
  },
];

export function NavMain() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();
  const { data: company, error: companyError, isLoading: isCompanyLoading } = useCompany();
  const { toggleSidebar, open } = useSidebar('left');
  const [isJwtLoaded, setIsJwtLoaded] = useState(false);

  // Check JWT existence once component mounts
  useEffect(() => {
    setIsJwtLoaded(true);
  }, []);

  const itemsWithActiveState = useMemo(() => {
    const filteredItems = items.filter((item) => {
      const hasJwt = !!getCookie('jwt');
      const hasCompany = !!company && !companyError;
      const meetsRoleThreshold = !item.roleThreshold || (hasCompany && company.roleId <= item.roleThreshold);
      if (!hasJwt || !hasCompany) {
        return item.title === 'Documentation';
      }
      return meetsRoleThreshold;
    });

    // Auto-expand Documentation if it's the only item
    if (filteredItems.length === 1 && filteredItems[0].title === 'Documentation') {
      return filteredItems.map((item) => ({
        ...item,
        isActive: true, // Force Documentation to be active/expanded when it's alone
      }));
    }

    return filteredItems.map((item) => ({
      ...item,
      isActive: isActive(item, pathname, queryParams),
    }));
  }, [company, companyError, pathname, queryParams]);

  // Show loading state until all data is ready
  const isLoading = !isJwtLoaded || isCompanyLoading;

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Pages</SidebarGroupLabel>
        <SidebarMenu>
          <div className='flex items-center justify-center p-4'>
            <div className='h-5 w-5 animate-spin rounded-full border-b-2 border-t-2 border-primary'></div>
          </div>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pages</SidebarGroupLabel>
      <SidebarMenu>
        {itemsWithActiveState.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive || (itemsWithActiveState.length === 1 && item.title === 'Documentation')}
            className='group/collapsible'
          >
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
                                  className={cn('hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}
                                >
                                  {subItem.icon && <subItem.icon className='h-4 w-4' />}
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
                                          className={cn(
                                            'w-full',
                                            decodeURIComponent(pathname).replace(/\.md$/, '') === nestedItem.url &&
                                              'bg-muted',
                                          )}
                                        >
                                          <span className='flex items-center gap-2'>{nestedItem.title}</span>
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
        ))}
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
