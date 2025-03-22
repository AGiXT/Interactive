'use client';

import { useEffect, useState } from 'react';
import { getCookie } from 'cookies-next';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AgentSelector } from '@/components/layout/agent-selector';
import { ChatHistory } from '@/components/layout/chat-history';
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
  useSidebar,
} from '@/components/ui/sidebar';

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
