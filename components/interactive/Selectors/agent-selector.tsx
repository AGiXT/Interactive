'use client';

import { useCompany } from '@/components/idiot/auth/hooks/useUser';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { setCookie } from 'cookies-next';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FaRobot } from 'react-icons/fa';
import { useContext, useEffect, useState } from 'react';
import { InteractiveConfigContext } from '../InteractiveConfigContext';
import { getCookie } from 'cookies-next';

interface Agent {
  id: string;
  name: string;
  companyName?: string;
  default?: boolean;
  status?: boolean | null;
}

export function AgentSelector() {
  const { isMobile } = useSidebar('left');
  const { data: activeCompany, error: companyError } = useCompany();
  const router = useRouter();
  const state = useContext(InteractiveConfigContext);
  const [agentsData, setAgentsData] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<{ agent: Agent | null; commands: string[] }>({ agent: null, commands: [] });
  console.error({ companyError });

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const agents = await state.agixt.getAgents();
        setAgentsData(agents.map(agent => ({
          id: agent.agent_name, // Using agent_name as id since SDK doesn't provide UUID
          name: agent.agent_name,
          companyName: activeCompany?.name
        })));
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    };

    const fetchActiveAgent = async () => {
      const currentAgentName = getCookie('agixt-agent') as string;
      if (currentAgentName) {
        const config = await state.agixt.getAgentConfig(currentAgentName);
        const commands = await state.agixt.getCommands(currentAgentName);
        setActiveAgent({ 
          agent: { id: currentAgentName, name: currentAgentName, companyName: activeCompany?.name },
          commands 
        });
      }
    };

    fetchAgents();
    fetchActiveAgent();
  }, [state.agixt, activeCompany]);

  const switchAgents = (agent: Agent) => {
    setCookie('agixt-agent', agent.name, {
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    });
    setActiveAgent({ 
      agent,
      commands: [] // Will be fetched in useEffect
    });
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
