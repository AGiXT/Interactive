'use client';

import { useEffect, useMemo, useState, useContext } from 'react';
import { getCookie, setCookie } from 'cookies-next';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronsUpDown, Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FaRobot } from 'react-icons/fa';
import { ViewVerticalIcon, DotsHorizontalIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import dayjs from 'dayjs';
import { useMediaQuery } from 'react-responsive';

import { items, Item, SubItem } from '@/app/NavMenuItems';
import { NavUser } from '@/components/layout/NavUser';
import { useUser, useCompany } from '@/components/interactive/useUser';
import { Agent, useAgent, useAgents } from '@/components/interactive/useAgent';
import { ConversationEdge, useConversations } from '@/components/interactive/useConversation';
import { InteractiveConfigContext, InteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import { getTimeDifference } from '@/components/conversation/activity';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function AgentSelector() {
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const { data: activeAgent, mutate: mutateActiveAgent, error: agentError } = useAgent();
  const { data: activeCompany, mutate: mutateActiveCompany, error: companyError } = useCompany();
  const { data: agentsData } = useAgents();
  const router = useRouter();
  
  // Log errors for debugging purposes
  if (process.env.NODE_ENV === 'development' && (agentError || companyError)) {
    console.error({ agentError, companyError });
  }

  const switchAgents = (agent: Agent) => {
    setCookie('agixt-agent', agent.name, {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    });
    mutateActiveCompany();
    mutateActiveAgent();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              side='left'
              size='lg'
              tooltip='Switch Active Agent'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex items-center justify-center rounded-lg aspect-square size-8 bg-sidebar-primary text-sidebar-primary-foreground'>
                <FaRobot className='size-4' />
              </div>
              <div className='grid flex-1 text-sm leading-tight text-left'>
                <span className='font-semibold truncate'>{activeAgent?.agent?.name}</span>
                <span className='text-xs truncate'>{activeCompany?.name}</span>
              </div>
              <ChevronsUpDown className='ml-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg px-2"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">Agents</DropdownMenuLabel>
            {agentsData &&
              agentsData.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => switchAgents(agent)}
                  className="flex items-center justify-between p-2 cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span>{agent.name}</span>
                    <span className="text-xs text-muted-foreground">{agent.companyId}</span>
                  </div>
                  {activeAgent?.agent?.id === agent.id && <Check className="w-4 h-4 ml-2" />}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2 cursor-pointer"
              onClick={() => {
                router.push('/settings');
              }}
            >
              <div className="flex items-center justify-center border rounded-md size-6 bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Add Agent</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function ChatHistory() {
  const state = useContext(InteractiveConfigContext);
  const pathname = usePathname();
  const router = useRouter();
  const { data: conversationData, isLoading } = useConversations();

  const isActive = (conversationId: string) => pathname.includes('chat') && pathname.includes(conversationId);

  const handleOpenConversation = ({ conversationId }: { conversationId: string | number }) => {
    router.push(`/chat/${conversationId}`);
    
    // RESTORED: Update the conversation state in the context
    state?.mutate?.((oldState: InteractiveConfig) => ({
      ...oldState,
      overrides: { ...oldState.overrides, conversation: conversationId },
    }));
  };

  if (!conversationData || !conversationData.length || isLoading) return null;
  const groupedConversations = groupConversations(conversationData.filter((conversation) => conversation.name !== '-'));

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      {Object.entries(groupedConversations).map(([label, conversations]) => (
        <div key={label}>
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
          <SidebarMenu className="ml-1">
            {conversations.map((conversation) => (
              <SidebarMenuItem key={conversation.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      side="left"
                      tooltip={conversation.name}
                      onClick={() => handleOpenConversation({ conversationId: conversation.id })}
                      className={cn(
                        'flex items-center justify-between w-full transition-colors',
                        isActive(conversation.id) && 'bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                      )}
                    >
                      <span className="truncate">{conversation.name}</span>
                      {conversation.hasNotifications && (
                        <Badge
                          variant="default"
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
                  <TooltipContent side="right">
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
      
      {/* RESTORED: "View More Conversations" button */}
      <SidebarMenu>
        <SidebarMenuItem>
          {conversationData && conversationData?.length > 10 && (
            <ChatSearch {...{ conversationData, handleOpenConversation }}>
              <SidebarMenuItem>
                <SidebarMenuButton className='text-sidebar-foreground/70' side='left' tooltip="View More Conversations">
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
  conversationData: ConversationEdge[];
  handleOpenConversation: ({ conversationId }: { conversationId: string | number }) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="p-0 overflow-hidden shadow-lg">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          <CommandInput placeholder="Search Conversations..." />
          <CommandList>
            {conversationData.map((conversation) => (
              <CommandItem key={conversation.id} asChild>
                {/* FIXED: Changed onSelect to onClick to maintain original behavior */}
                <DialogClose className="w-full" onClick={() => handleOpenConversation({ conversationId: conversation.id })}>
                  <span className="px-2">{conversation.name}</span>
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

  return Object.fromEntries(Object.entries(groups).filter(([, conversationArray]) => conversationArray.length > 0));
}

// Fixed version of the NavMain component

export function NavMain() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();
  const { data: company, error: companyError, isLoading: isCompanyLoading } = useCompany();
  const { toggleSidebar, open } = useSidebar('left');
  const [isJwtLoaded, setIsJwtLoaded] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });

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
          <div className="flex items-center justify-center p-4">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          </div>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  // Handle navigation and only close sidebar on mobile if navigating to a final destination
  const handleNavigation = (url, shouldCloseSidebar = false) => {
    if (url) router.push(url);
    // Only close the sidebar if explicitly requested (for leaf items)
    if (isMobile && shouldCloseSidebar) toggleSidebar();
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Pages</SidebarGroupLabel>
      <SidebarMenu>
        {itemsWithActiveState.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive || (itemsWithActiveState.length === 1 && item.title === 'Documentation')}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  side="left"
                  tooltip={item.title}
                  onClick={() => {
                    if (!open) toggleSidebar();
                    // Only navigate if there's a URL and no sub-items
                    if (item.url && !item.items?.length) {
                      handleNavigation(item.url, true);
                    }
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
                <SidebarMenuSub className="pr-0 mr-0">
                  {item.items?.map((subItem) =>
                    subItem.max_role && (!company?.name || company?.roleId > subItem.max_role) ? null : (
                      <SidebarMenuSubItem key={subItem.title}>
                        {subItem.items ? (
                          <Collapsible asChild>
                            <div className="w-full">
                              <CollapsibleTrigger asChild>
                                <SidebarMenuButton
                                  side="left"
                                  tooltip={subItem.title}
                                  className={cn('hover:bg-sidebar-accent hover:text-sidebar-accent-foreground')}
                                >
                                  {subItem.icon && <subItem.icon className="h-4 w-4" />}
                                  <span>{subItem.title}</span>
                                  <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                </SidebarMenuButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {subItem.items.map((nestedItem) => (
                                    <SidebarMenuSubItem key={nestedItem.url}>
                                      <SidebarMenuSubButton 
                                        asChild
                                        onClick={() => {
                                          // This is a leaf node, so close sidebar on mobile
                                          handleNavigation(
                                            nestedItem.queryParams
                                              ? Object.entries(nestedItem.queryParams).reduce(
                                                  (url, [key, value]) => url + `${key}=${value}&`,
                                                  nestedItem.url + '?',
                                                )
                                              : nestedItem.url,
                                            true
                                          );
                                        }}
                                      >
                                        <Link
                                          href={
                                            nestedItem.queryParams
                                              ? Object.entries(nestedItem.queryParams).reduce(
                                                  (url, [key, value]) => url + `${key}=${value}&`,
                                                  nestedItem.url + '?',
                                                )
                                              : nestedItem.url
                                          }
                                          className={cn(
                                            'w-full',
                                            decodeURIComponent(pathname).replace(/\.md$/, '') === nestedItem.url &&
                                              'bg-muted',
                                          )}
                                        >
                                          <span className="flex items-center gap-2">{nestedItem.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ) : (
                          <SidebarMenuSubButton 
                            asChild
                            onClick={() => {
                              // This is a leaf node, so close sidebar on mobile
                              handleNavigation(
                                subItem.queryParams
                                  ? Object.entries(subItem.queryParams).reduce(
                                      (url, [key, value]) => url + `${key}=${value}&`,
                                      subItem.url + '?',
                                    )
                                  : subItem.url,
                                true
                              );
                            }}
                          >
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
                              <span className="flex items-center gap-2">
                                {subItem.icon && <subItem.icon className="w-4 h-4" />}
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
  // Handle items with sub-items
  if (item.items) {
    return item.items.some((subItem) => isSubItemActive(subItem, pathname, queryParams));
  }

  // Root level items
  if (item.url === pathname) {
    // Check if queryParams match
    if (item.queryParams) {
      return Object.entries(item.queryParams).every(
        ([key, value]) => queryParams.get(key) === value
      );
    }
    // If no query params are defined, URL should have no query params
    return queryParams.size === 0;
  }
  
  return false;
}

function isSubItemActive(subItem: SubItem, pathname: string, queryParams: URLSearchParams) {
  // Check if URL matches
  if (subItem.url !== pathname) {
    return false;
  }

  // If subitem has query params, they must all match
  if (subItem.queryParams) {
    return Object.entries(subItem.queryParams).every(
      ([key, value]) => queryParams.get(key) === value
    );
  }

  // If no query params defined on subitem, URL must have no query params
  return queryParams.size === 0;
}

export function ToggleSidebar({ side }: { side: 'left' | 'right' }) {
  const { toggleSidebar } = useSidebar(side);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          onClick={toggleSidebar}
          variant="default"
          size="icon"
          className={cn(
            // Base styling
            "flex items-center justify-center",
            // Mobile styling with fixed positioning
            isMobile 
              ? "fixed z-50 rounded-full shadow-lg size-12 bg-primary text-primary-foreground" 
              : "relative h-8 w-8",
            // Position the button differently based on which sidebar it's for
            isMobile && side === 'left' ? "top-4 left-4" : "",
            isMobile && side === 'right' ? "top-4 right-4" : ""
          )}
          data-testid={`toggle-${side}-sidebar`}
        >
          <ViewVerticalIcon className="size-5" />
          <span className="sr-only">{side === 'left' ? 'Toggle Main Menu' : 'Toggle Details'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side === 'left' ? 'right' : 'left'}>
        {side === 'left' ? 'Toggle Main Menu' : 'Toggle Details'}
      </TooltipContent>
    </Tooltip>
  );
}

// Use this unified toggle for both sidebars instead of two separate components
export function SidebarMain({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: user } = useUser();
  const isAuthenticated = !!user?.email;
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const isOnChatPage = pathname.includes('/chat');

  // Don't render the sidebar on home page or user pages (except manage)
  if (pathname === '/' || (pathname.startsWith('/user') && pathname !== '/user/manage')) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar 
        collapsible={isMobile ? 'offcanvas' : 'icon'} 
        {...props} 
        className="hide-scrollbar"
      >
        <SidebarHeader>
          {isAuthenticated ? (
            <AgentSelector />
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href='/' passHref>
                  <SidebarMenuButton side='left' size='lg' className='gap-2' tooltip='Return to Home'>
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
        <SidebarFooter className="flex flex-col gap-4 pb-6">
          {/* Only show the toggle button in the sidebar on desktop */}
          {!isMobile && (
            <div>
              <ToggleSidebar side='left' />
            </div>
          )}
          {isAuthenticated && <NavUser />}
        </SidebarFooter>
        <SidebarRail side='left' />
      </Sidebar>
      
      {/* Add fixed position buttons for mobile */}
      {isMobile && <ToggleSidebar side='left' />}
      
      {/* Add right sidebar toggle for mobile ONLY on chat pages */}
      {isMobile && isOnChatPage && <ToggleSidebar side='right' />}
    </TooltipProvider>
  );
}