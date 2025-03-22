'use client';

import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { NavMain } from '@/components/layout/NavMain';
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
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getTimeDifference } from '@/components/conversation/activity';
import { cn } from '@/lib/utils';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import dayjs from 'dayjs';
import { usePathname, useRouter } from 'next/navigation';
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
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { FaRobot } from 'react-icons/fa';
import { Agent, useAgent, useAgents } from '@/components/interactive/useAgent';

export function AgentSelector() {
  const { isMobile } = useSidebar('left');
  const { data: activeAgent, mutate: mutateActiveAgent, error: agentError } = useAgent();
  const { data: activeCompany, mutate: mutateActiveCompany, error: companyError } = useCompany();
  const { data: agentsData } = useAgents();
  const router = useRouter();
  console.error({ agentError, companyError });

  const switchAgents = (agent: Agent) => {
    // setActiveAgent(agent);
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
            className='w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg px-2'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>Agents</DropdownMenuLabel>
            {agentsData &&
              agentsData.map((agent) => (
                <DropdownMenuItem
                  key={agent.id}
                  onClick={() => switchAgents(agent)}
                  className='flex items-center justify-between p-2 cursor-pointer'
                >
                  <div className='flex flex-col'>
                    <span>{agent.name}</span>
                    <span className='text-xs text-muted-foreground'>{agent.companyName}</span>
                  </div>
                  {activeAgent?.agent?.id === agent.id && <Check className='w-4 h-4 ml-2' />}
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='gap-2 p-2 cursor-pointer'
              onClick={() => {
                router.push('/settings');
              }}
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
  const isAuthenticated = !!user?.email;

  useEffect(() => {
    if (getCookie('agixt-has-started') === 'true') {
      setHasStarted(true);
    }
  }, [getCookie('agixt-has-started')]);

  if (pathname === '/' || (pathname.startsWith('/user') && pathname !== '/user/manage')) return null;

  return (
    <Sidebar collapsible='icon' {...props} className='hide-scrollbar'>
      <SidebarHeader>
        {isAuthenticated ? (
          <AgentSelector />
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
        {isAuthenticated && <NavUser />}
      </SidebarFooter>
      <SidebarRail side='left' />
    </Sidebar>
  );
}
