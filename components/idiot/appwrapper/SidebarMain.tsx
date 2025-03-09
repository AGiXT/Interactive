'use client';

import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AgentSelector } from '../../interactive/Selectors/agent-selector';
import { ChatHistory } from '../../interactive/Layout/chat-history';
import { NavMain } from '@/components/idiot/appwrapper/NavMain';
import { NavUser } from '@/components/idiot/appwrapper/NavUser';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { ToggleSidebar } from './ToggleSidebar';
import { useUser } from '../auth/hooks/useUser';

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
