'use client';

import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { items, Item, SubItem } from '@/app/NavMenuItems';
import { NavUser } from '@/components/layout/NavUser';
import { useUser } from '@/components/interactive/useUser';
import { ViewVerticalIcon } from '@radix-ui/react-icons';
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
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import dayjs from 'dayjs';
import { useContext } from 'react';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Conversation, useConversations } from '@/components/interactive/useConversation';
import { InteractiveConfigContext } from '@/components/interactive/InteractiveConfigContext';
import { useCompany } from '@/components/interactive/useUser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setCookie } from 'cookies-next';
import { Check, ChevronsUpDown, Plus, BookOpen } from 'lucide-react';
import { FaRobot } from 'react-icons/fa';
import { Agent, useAgent, useAgents } from '@/components/interactive/useAgent';
import { useMemo } from 'react';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function AgentSelector() {
  const { isMobile } = useSidebar('left');
  const { data: activeAgent, mutate: mutateActiveAgent, error: agentError } = useAgent();
  const { data: activeCompany, mutate: mutateActiveCompany, error: companyError } = useCompany();
  const { data: agentsData } = useAgents();
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Handle data fetch errors more gracefully
  useEffect(() => {
    if (agentError || companyError) {
      console.error({ agentError, companyError });
      
      // Retry fetching if we have errors and haven't exceeded max retries
      if (retryCount < 3) {
        const timer = setTimeout(() => {
          setRetryCount(prev => prev + 1);
          mutateActiveAgent();
          mutateActiveCompany();
        }, 1000); // Wait 1 second before retrying
        
        return () => clearTimeout(timer);
      }
    }
  }, [agentError, companyError, mutateActiveAgent, mutateActiveCompany, retryCount]);

  // Ensure agent and company data stay in sync
  useEffect(() => {
    const agentName = getCookie('agixt-agent');
    
    // Check if activeAgent exists but doesn't match the cookie
    if (activeAgent?.agent && agentName && activeAgent.agent.name !== agentName) {
      mutateActiveAgent();
    }
    
    // Check if we have an activeAgent but no company or mismatched company
    if (activeAgent?.agent && (!activeCompany || !activeCompany.agents.some(a => a.id === activeAgent.agent?.id))) {
      mutateActiveCompany();
    }
  }, [activeAgent, activeCompany, mutateActiveAgent, mutateActiveCompany]);

  const switchAgents = async (agent: Agent) => {
    try {
      setIsSwitching(true);
      
      // Set the cookie first
      setCookie('agixt-agent', agent.name, {
        domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
      });
      
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
  const isLoading = !activeAgent || !activeCompany || isSwitching;
  const hasError = (agentError || companyError) && retryCount >= 3;

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
                {isLoading ? (
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
                    <span className='font-semibold truncate'>{activeAgent?.agent?.name}</span>
                    <span className='text-xs truncate'>{activeCompany?.name}</span>
                  </>
                )}
              </div>
              {isSwitching ? (
                <div className='ml-auto h-4 w-4 animate-spin rounded-full border-b-2 border-t-2 border-primary'></div>
              ) : (
                <ChevronsUpDown className='ml-auto' />
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
            {agentsData && agentsData.length > 0 ? (
              agentsData.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => !isSwitching && switchAgents(agent)}
                  className='flex items-center justify-between p-2 cursor-pointer'
                  disabled={isSwitching}
                >
                  <div className='flex flex-col'>
                    <span>{agent.name}</span>
                    <span className='text-xs text-muted-foreground'>{agent.companyName}</span>
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
                <Plus className='size-4' />
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

    state?.mutate?.((oldState) => ({
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
              <SidebarMenuItem>
                <SidebarMenuButton className='text-sidebar-foreground/70' side='left'>
                  <DotsHorizontalIcon className='text-sidebar-foreground/70' />
                  <span>More</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
  conversationData: any[];
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

function groupConversations(conversations: Conversation[]) {
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
    (groups: { [key: string]: Conversation[] }, conversation: Conversation) => {
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

  return Object.fromEntries(Object.entries(groups).filter(([_, conversations]) => conversations.length > 0));
}

export function NavMain() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();
  const { data: company, error: companyError, isLoading: isCompanyLoading, mutate: mutateCompany } = useCompany();
  const { toggleSidebar, open } = useSidebar('left');
  const [isJwtLoaded, setIsJwtLoaded] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Handle loading timeout
  useEffect(() => {
    // Set a timeout to force loading to end after 5 seconds
    const timer = setTimeout(() => {
      if (isCompanyLoading && !company) {
        setLoadingTimeout(true);
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [isCompanyLoading, company]);

  // Add retry logic for failed loading
  useEffect(() => {
    if (companyError && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        mutateCompany();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [companyError, mutateCompany, retryCount]);

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

  // Show loading state until all data is ready (with timeout)
  const isLoading = (!isJwtLoaded || isCompanyLoading) && !loadingTimeout;
  
  // If timeout occurred or we've retried and still have an error, show a partial UI
  if (loadingTimeout || (companyError && retryCount >= 3)) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Pages</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              side='left'
              className='text-destructive'
              onClick={() => {
                setLoadingTimeout(false);
                setRetryCount(0);
                mutateCompany();
              }}
            >
              <span>Error loading pages</span>
              <span className='text-xs text-muted-foreground'>Click to retry</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Always show Documentation as fallback */}
          <Collapsible asChild defaultOpen className='group/collapsible'>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  side='left'
                  tooltip="Documentation"
                  onClick={() => {
                    if (!open) toggleSidebar();
                    router.push('/docs');
                  }}
                >
                  <BookOpen />
                  <span>Documentation</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

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
  const [hasStarted, setHasStarted] = useState(false);
  const pathname = usePathname();
  const { data: user } = useUser();
  const { data: activeCompany } = useCompany();
  const isAuthenticated = !!user?.email;
  const isChildRole = activeCompany?.roleId === 4;

  useEffect(() => {
    if (getCookie('agixt-has-started') === 'true') {
      setHasStarted(true);
    }
  }, [getCookie('agixt-has-started')]);

  if (pathname === '/' || (pathname.startsWith('/user') && pathname !== '/user/manage')) return null;

  return (
    <Sidebar collapsible='icon' {...props} className='hide-scrollbar'>
      <SidebarHeader>
        {isAuthenticated && !isChildRole ? (
          <AgentSelector />
        ) : isAuthenticated && isChildRole ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton side='left' size='lg' className='gap-2'>
                <ChevronLeft className='h-4 w-4' />
                Child Mode
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href='/' passHref>
                <SidebarMenuButton side='left' size='lg' className='gap-2'>
                  <ChevronLeft className='h-4 w-4' />
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
        {isAuthenticated && !isChildRole && <NavUser />}
      </SidebarFooter>
      <SidebarRail side='left' />
    </Sidebar>
  );
}
