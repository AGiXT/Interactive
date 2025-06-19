'use client';

import { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getCookie, setCookie } from 'cookies-next';
import Link from 'next/link';
import dayjs from 'dayjs';
import { ViewVerticalIcon, DotsHorizontalIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { ChevronLeft, Check, ChevronsUpDown, Plus, BookOpen, MessageCircle, LucideIcon } from 'lucide-react';
import { FaRobot } from 'react-icons/fa';
import { ClientIcon } from '@/components/ui/client-icon';

import { items, getFilteredItems, Item, SubItem } from '@/app/NavMenuItems';
import { NavUser } from '@/components/layout/NavUser';
import { useUser, useCompany, Company } from '@/components/interactive/useUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTimeDifference } from '@/components/conversation/activity';
import { cn } from '@/lib/utils';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { ConversationEdge, useConversations } from '@/components/interactive/useConversation';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Agent, useAgent, useAgents } from '@/components/interactive/useAgent';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const AGIXT_AGENT_COOKIE = 'agixt-agent';

// Helper function to safely render icons
const renderIcon = (IconComponent: LucideIcon | undefined, className?: string) => {
  if (!IconComponent) return null;

  // Always use ClientIcon for consistent server/client rendering
  return <ClientIcon icon={IconComponent} className={className} />;
};

export function AgentSelector() {
  const { isMobile } = useSidebar('left');
  const { data: user } = useUser();
  const { data: activeAgent, mutate: mutateActiveAgent, error: agentError } = useAgent();
  const { data: activeCompany, mutate: mutateActiveCompany, error: companyError } = useCompany();
  const { data: agentsData } = useAgents();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize agent selection when user data is loaded
  useEffect(() => {
    if (!user?.companies?.length) return;

    const agentName = getCookie(AGIXT_AGENT_COOKIE);
    const jwtToken = getCookie('jwt');

    if (!jwtToken) return;

    // Always ensure we have an agent selected
    if (!agentName) {
      const primaryCompany = user.companies.find((c) => c.primary);
      if (primaryCompany?.agents?.length) {
        const defaultAgent = primaryCompany.agents.find((a) => a.default) || primaryCompany.agents[0];
        if (defaultAgent) {
          setCookie(AGIXT_AGENT_COOKIE, defaultAgent.name, {
            domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
          });
          setCookie('agixt-company', primaryCompany.id, {
            domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
          });
        }
      }
    }

    // Always trigger refetch to ensure data is loaded
    if (!isInitialized) {
      mutateActiveAgent();
      mutateActiveCompany();
      setIsInitialized(true);
    }
  }, [user, mutateActiveAgent, mutateActiveCompany, isInitialized]);

  // Handle data fetch errors more gracefully
  useEffect(() => {
    if (agentError || companyError) {
      console.error({ agentError, companyError });

      // Retry fetching if we have errors and haven't exceeded max retries
      if (retryCount < 3) {
        const timer = setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          mutateActiveAgent();
          mutateActiveCompany();
        }, 1000); // Wait 1 second before retrying

        return () => clearTimeout(timer);
      }
    }
  }, [agentError, companyError, mutateActiveAgent, mutateActiveCompany, retryCount]);

  // Ensure agent and company data stay in sync
  useEffect(() => {
    const agentName = getCookie(AGIXT_AGENT_COOKIE);

    // Check if activeAgent exists but doesn't match the cookie
    if (activeAgent?.agent && agentName && activeAgent.agent.name !== agentName) {
      mutateActiveAgent();
    }

    // Check if we have an activeAgent but no company or mismatched company
    if (activeAgent?.agent && (!activeCompany || !activeCompany.agents.some((a) => a.id === activeAgent.agent?.id))) {
      mutateActiveCompany();
    }
  }, [activeAgent, activeCompany, mutateActiveAgent, mutateActiveCompany]);

  const switchAgents = async (agent: Agent) => {
    try {
      setIsSwitching(true);

      // Set the cookie first
      setCookie(AGIXT_AGENT_COOKIE, agent.name, {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      });

      // Set the company cookie based on the agent's company
      const agentCompany = user?.companies?.find((c) => c.agents.some((a) => a.id === agent.id));
      if (agentCompany) {
        setCookie('agixt-company', agentCompany.id, {
          domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
        });
      }

      // Update company state first (since agent depends on it)
      await mutateActiveCompany();

      // Then update agent state
      await mutateActiveAgent();

      // Reset retry counter on successful switch
      setRetryCount(0);
    } catch (error) {
      console.error('Error switching agents:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  // Determine if we're in a loading or error state
  const hasError = (agentError || companyError) && retryCount >= 3;
  const showLoadingState = !user?.companies?.length || !isInitialized;

  // Get fallback agent name from cookies or user data
  const getDisplayAgentName = () => {
    if (activeAgent?.agent?.name) {
      return activeAgent.agent.name;
    }

    // Try to get from cookie
    const cookieAgentName = getCookie(AGIXT_AGENT_COOKIE);
    if (cookieAgentName) {
      return cookieAgentName;
    }

    // Try to get default from user companies
    if (user?.companies?.length) {
      const primaryCompany = user.companies.find((c) => c.primary);
      if (primaryCompany?.agents?.length) {
        const defaultAgent = primaryCompany.agents.find((a) => a.default) || primaryCompany.agents[0];
        if (defaultAgent) {
          return defaultAgent.name;
        }
      }
    }

    return 'Loading...';
  };

  const getDisplayCompanyName = () => {
    if (activeCompany?.name) {
      return activeCompany.name;
    }

    // Try to get from user data
    if (user?.companies?.length) {
      const primaryCompany = user.companies.find((c) => c.primary);
      if (primaryCompany) {
        return primaryCompany.name;
      }
    }

    return 'Loading...';
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              side='left'
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              disabled={isSwitching}
            >
              <div className='flex items-center justify-center rounded-lg aspect-square size-8 bg-sidebar-primary text-sidebar-primary-foreground'>
                <FaRobot className='size-4' />
              </div>
              <div className='grid flex-1 text-sm leading-tight text-left'>
                {showLoadingState ? (
                  <>
                    <span className='font-semibold truncate'>Loading...</span>
                    <span className='text-xs truncate'>Please wait</span>
                  </>
                ) : hasError ? (
                  <>
                    <span className='font-semibold truncate text-destructive'>Error</span>
                    <span className='text-xs truncate'>Try again later</span>
                  </>
                ) : (
                  <>
                    <span className='font-semibold truncate'>{getDisplayAgentName()}</span>
                    <span className='text-xs truncate'>{getDisplayCompanyName()}</span>
                  </>
                )}
              </div>
              {isSwitching ? (
                <div className='ml-auto h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-primary' />
              ) : (
                <ClientIcon icon={ChevronsUpDown} className='ml-auto' />
              )}
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg px-2'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>Agents</DropdownMenuLabel>
            {showLoadingState ? (
              <div className='py-2 px-2 text-sm text-muted-foreground'>Loading agents...</div>
            ) : agentsData && agentsData.length > 0 ? (
              agentsData.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => !isSwitching && switchAgents(agent)}
                  className='flex items-center justify-between p-2 cursor-pointer'
                  disabled={isSwitching}
                >
                  <div className='flex flex-col'>
                    <span>{agent.name}</span>
                    <span className='text-xs text-muted-foreground'>Agent</span>
                  </div>
                  {activeAgent?.agent?.id === agent.id && <Check className='w-4 h-4 ml-2' />}
                </DropdownMenuItem>
              ))
            ) : (
              <div className='py-2 px-2 text-sm text-muted-foreground'>No agents available</div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='gap-2 p-2 cursor-pointer'
              onClick={() => {
                router.push('/settings');
              }}
              disabled={isSwitching}
            >
              <div className='flex items-center justify-center border rounded-md size-6 bg-background'>
                <ClientIcon icon={Plus} className='size-4' />
              </div>
              <div className='font-medium text-muted-foreground'>Add Agent</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function ChatHistory() {
  const state = useContext(InteractiveConfigContext);
  const { data: conversationData, isLoading } = useConversations();
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (conversationId: string) => pathname.includes('chat') && pathname.includes(conversationId);

  const handleOpenConversation = ({ conversationId }: { conversationId: string | number }) => {
    router.push(`/chat/${conversationId}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state?.mutate?.((oldState: any) => ({
      ...oldState,
      overrides: { ...oldState.overrides, conversation: conversationId },
    }));
  };

  if (!conversationData || !conversationData.length || isLoading) return null;
  const groupedConversations = groupConversations(conversationData.filter((conversation) => conversation.name !== '-'));

  return (
    <SidebarGroup className='group-data-[collapsible=icon]:hidden'>
      {Object.entries(groupedConversations).map(([label, conversations]) => (
        <div key={label}>
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarMenu className='ml-1'>
            {conversations.map((conversation) => (
              <SidebarMenuItem key={conversation.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      side='left'
                      onClick={() => handleOpenConversation({ conversationId: conversation.id })}
                      className={cn(
                        'flex items-center justify-between w-full transition-colors',
                        isActive(conversation.id) && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                      )}
                    >
                      <span className='truncate'>{conversation.name}</span>
                      {conversation.hasNotifications && (
                        <Badge
                          variant='default'
                          className={cn(
                            'ml-2',
                            isActive(conversation.id)
                              ? 'bg-sidebar-accent-foreground/10 text-sidebar-accent-foreground'
                              : 'bg-primary/10 text-primary',
                          )}
                        >
                          New
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent side='right'>
                    <div>{conversation.name}</div>
                    {label === 'Today' ? (
                      <div>
                        Updated: {getTimeDifference(dayjs().format('YYYY-MM-DDTHH:mm:ssZ'), conversation.updatedAt)} ago
                      </div>
                    ) : (
                      <div>Updated: {dayjs(conversation.updatedAt).format('MMM DD YYYY')}</div>
                    )}
                    {conversation.attachmentCount > 0 && <div>Attachments: {conversation.attachmentCount}</div>}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      ))}
      <SidebarMenu>
        <SidebarMenuItem>
          {conversationData && conversationData?.length > 10 && (
            <ChatSearch {...{ conversationData, handleOpenConversation }}>
              <div>
                <SidebarMenuButton className='text-sidebar-foreground/70' side='left'>
                  <DotsHorizontalIcon className='text-sidebar-foreground/70' />
                  <span>More</span>
                </SidebarMenuButton>
              </div>
            </ChatSearch>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}

function ChatSearch({
  conversationData,
  handleOpenConversation,
  children,
}: {
  conversationData: ConversationEdge[];
  handleOpenConversation: ({ conversationId }: { conversationId: string | number }) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='p-0 overflow-hidden shadow-lg'>
        <Command className='[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5'>
          <CommandInput placeholder='Search Conversations...' />
          <CommandList>
            {conversationData.map((conversation) => (
              <CommandItem asChild key={conversation.id}>
                <DialogClose className='w-full' onClick={() => handleOpenConversation({ conversationId: conversation.id })}>
                  <span className='px-2'>{conversation.name}</span>
                </DialogClose>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function groupConversations(conversations: ConversationEdge[]) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isToday = (date: string) => new Date(date).toDateString() === today.toDateString();
  const isYesterday = (date: string) => new Date(date).toDateString() === yesterday.toDateString();
  const isPastWeek = (date: string) => {
    const d = new Date(date);
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    return d > weekAgo && d < yesterday;
  };

  const groups = conversations.slice(0, 7).reduce(
    (groups: { [key: string]: ConversationEdge[] }, conversation: ConversationEdge) => {
      if (isToday(conversation.updatedAt)) {
        groups['Today'].push(conversation);
      } else if (isYesterday(conversation.updatedAt)) {
        groups['Yesterday'].push(conversation);
      } else if (isPastWeek(conversation.updatedAt)) {
        groups['Past Week'].push(conversation);
      } else {
        groups['Older'].push(conversation);
      }
      return groups;
    },
    { Today: [], Yesterday: [], 'Past Week': [], Older: [] },
  );

  return Object.fromEntries(Object.entries(groups).filter(([, conversations]) => conversations.length > 0));
}

// Helper function to determine if we should show base navigation items only
function shouldShowBaseNavigationOnly(
  hasJwt: boolean,
  isCompanyLoading: boolean,
  companyError: unknown,
  company: Company | null,
) {
  if (!hasJwt) return true;
  return isCompanyLoading || (companyError && !company);
}

// Helper function to get filtered navigation items for a company
function getFilteredNavigationItems(company: Company, pathname: string, queryParams: URLSearchParams) {
  const baseItems = getFilteredItems(company.roleId);

  const filteredItems =
    company.roleId === 4
      ? baseItems // Children get pre-filtered items, no additional filtering needed
      : baseItems.filter((item) => !item.roleThreshold || company.roleId <= item.roleThreshold);

  return filteredItems.map((item) => ({
    ...item,
    isActive: isActive(item, pathname, queryParams),
  }));
}

// Helper function to render nested submenu items
function renderNestedItems(nestedItems: Array<{ title: string; url: string }>, pathname: string) {
  return nestedItems.map((nestedItem) => (
    <SidebarMenuSubItem key={nestedItem.url}>
      <SidebarMenuSubButton asChild>
        <Link
          href={nestedItem.url}
          className={cn('w-full', decodeURIComponent(pathname).replace(/\.md$/, '') === nestedItem.url && 'bg-muted')}
        >
          <span className='flex items-center gap-2'>{nestedItem.title}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  ));
}

// Helper function to render submenu items
function renderSubItems(subItems: SubItem[], company: Company | null, pathname: string, queryParams: URLSearchParams) {
  return subItems.map((subItem: SubItem) => {
    if (subItem.max_role && (!company?.name || company?.roleId > subItem.max_role)) {
      return null;
    }

    return (
      <SidebarMenuSubItem key={subItem.title}>
        {subItem.items ? (
          <Collapsible asChild>
            <div>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  side='left'
                  className={cn('hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}
                >
                  {renderIcon(subItem.icon, 'h-4 w-4')}
                  <span>{subItem.title}</span>
                  <ChevronRightIcon className='ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90' />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>{renderNestedItems(subItem.items, pathname)}</SidebarMenuSub>
              </CollapsibleContent>
            </div>
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
                {renderIcon(subItem.icon, 'w-4 h-4')}
                {subItem.max_role && company?.name + ' '}
                {subItem.title}
              </span>
            </Link>
          </SidebarMenuSubButton>
        )}
      </SidebarMenuSubItem>
    );
  });
}

// Helper function to render navigation items
function renderNavigationItems(
  itemsWithActiveState: Item[],
  company: Company | null,
  pathname: string,
  queryParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  open: boolean,
  toggleSidebar: () => void,
) {
  return itemsWithActiveState.map((item) => (
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
            onClick={() => {
              if (!open) toggleSidebar();
              if (item.url) router.push(item.url);
            }}
            className={cn(item.isActive && !item.items?.length && 'bg-muted')}
          >
            {renderIcon(item.icon)}
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
            {item.items && renderSubItems(item.items, company, pathname, queryParams)}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  ));
}

export function NavMain() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();
  const { data: company, error: companyError, isLoading: isCompanyLoading, mutate: mutateCompany } = useCompany();
  const { toggleSidebar, open } = useSidebar('left');
  const [retryCount, setRetryCount] = useState(0);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Track client-side mounting to prevent hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Enhanced retry logic with quick retries for better UX
  useEffect(() => {
    if (companyError && retryCount < 5) {
      // Quick retry intervals: 500ms, 1s, 1.5s, 2s, 2s
      const retryDelay = Math.min(500 + retryCount * 500, 2000); // Max 2 seconds
      const timer = setTimeout(() => {
        setRetryCount((prev) => prev + 1);
        mutateCompany();
      }, retryDelay);

      return () => clearTimeout(timer);
    }
  }, [companyError, mutateCompany, retryCount]);

  // Track when we've initially loaded to prevent flickering
  useEffect(() => {
    if (!hasInitiallyLoaded && (company || companyError)) {
      setHasInitiallyLoaded(true);
    }
  }, [company, companyError, hasInitiallyLoaded]);

  // Reset retry count on successful load
  useEffect(() => {
    if (company && retryCount > 0) {
      setRetryCount(0);
    }
  }, [company, retryCount]);

  const getBaseNavigationItems = useCallback(() => {
    // Use a consistent order that works for both server and client
    const baseItems = [
      {
        title: 'Documentation',
        icon: BookOpen,
        items: items.find((item) => item.title === 'Documentation')?.items || [],
        isActive: pathname.includes('/docs'),
      },
      {
        title: 'New Chat',
        url: '/chat',
        icon: MessageCircle,
        isActive: pathname.includes('/chat'),
      },
    ];

    return baseItems;
  }, [pathname]);

  const itemsWithActiveState = useMemo(() => {
    // During SSR, always show Documentation first to prevent hydration mismatch
    if (!isClient) {
      return getBaseNavigationItems();
    }

    const hasJwt = !!getCookie('jwt');

    if (shouldShowBaseNavigationOnly(hasJwt, isCompanyLoading, companyError, company ?? null)) {
      const baseItems = getBaseNavigationItems();
      return hasJwt ? baseItems : baseItems.filter((item) => item.title === 'Documentation');
    }

    // If we have company data, show full navigation based on role
    if (company) {
      return getFilteredNavigationItems(company, pathname, queryParams);
    }

    // Fallback to base navigation
    return getBaseNavigationItems();
  }, [isClient, company, companyError, isCompanyLoading, pathname, queryParams, getBaseNavigationItems]);

  const showRetryButton = companyError && retryCount >= 5;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className='flex items-center justify-between'>
        <span>Pages</span>
        {isCompanyLoading && (
          <div className='h-3 w-3 animate-spin rounded-full border-b-2 border-t-2 border-primary opacity-60' />
        )}
      </SidebarGroupLabel>
      <SidebarMenu>
        {showRetryButton && (
          <SidebarMenuItem>
            <SidebarMenuButton
              side='left'
              className='text-destructive'
              onClick={() => {
                setRetryCount(0);
                mutateCompany();
              }}
            >
              <span>Error loading pages</span>
              <span className='text-xs text-muted-foreground'>Click to retry</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {renderNavigationItems(itemsWithActiveState, company ?? null, pathname, queryParams, router, open, toggleSidebar)}
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

export function ToggleSidebar({ side }: { side: 'left' | 'right' }) {
  const { toggleSidebar } = useSidebar(side);

  return (
    <SidebarMenuButton onClick={toggleSidebar}>
      <ViewVerticalIcon className='w-7 h-7' />
      <span>Toggle Sidebar</span>
    </SidebarMenuButton>
  );
}

export function SidebarMain({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: user } = useUser();
  const { data: company } = useCompany();
  const isAuthenticated = !!user?.email;
  const isChild = company?.roleId === 4;
  const hasStartedCookie = getCookie('agixt-has-started');

  useEffect(() => {
    // This effect is intentionally empty - the hasStartedCookie is used for conditional logic
  }, [hasStartedCookie]);

  if (pathname === '/' || (pathname.startsWith('/user') && pathname !== '/user/manage')) return null;

  return (
    <Sidebar collapsible='icon' {...props} className='hide-scrollbar'>
      <SidebarHeader>
        {isAuthenticated && !isChild ? (
          <AgentSelector />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href='/' passHref>
                <SidebarMenuButton side='left' size='lg' className='gap-2'>
                  <ClientIcon icon={ChevronLeft} className='h-4 w-4' />
                  Back to Home
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
        {isAuthenticated && <ChatHistory />}
      </SidebarContent>
      <SidebarFooter>
        {/* <NotificationsNavItem /> */}
        <ToggleSidebar side='left' />
        {isAuthenticated && !isChild && <NavUser />}
      </SidebarFooter>
      <SidebarRail side='left' />
    </Sidebar>
  );
}
