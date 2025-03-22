'use client';

import { CaretRightIcon, ComponentPlaceholderIcon } from '@radix-ui/react-icons';
import { BadgeCheck, LogOut, MoonIcon, LayoutGrid } from 'lucide-react';
import { useTheme } from '@/components/layout/themes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/components/interactive/useUser';
import md5 from 'md5';
import { cn } from '@/lib/utils';
import { setCookie, getCookie } from 'cookies-next';
import { useEffect, useState } from 'react';

export function NavUser() {
  const { isMobile } = useSidebar('left');
  const router = useRouter();
  const { data: user } = useUser();
  const { themes, currentTheme, setTheme } = useTheme();

  // Appearance functionality
  const defaultThemes = ['icons', 'labels'];
  const [appearances] = useState(() => {
    return Array.from(new Set([...defaultThemes]));
  });

  const [appearance, setAppearance] = useState(() => {
    const cookieValue = getCookie('appearance');
    return cookieValue?.toString() ?? 'labels';
  });

  useEffect(() => {
    document.body.classList.remove(...appearances);
    setCookie('appearance', appearance, {
      expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
    });
    document.body.classList.add(appearance);
  }, [appearance, appearances]);

  const getGravatarUrl = (email?: string, size = 40): string => {
    if (!email) return '';
    const hash = md5(email.trim().toLowerCase());
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
  };

  const handleLogout = () => {
    router.push('/user/logout');
  };

  function userInitials(user: { firstName?: string; lastName?: string } | null | undefined): string | null {
    if (!user?.firstName || !user?.lastName) return null;
    return `${user.firstName[0].toUpperCase()}${user.lastName[0].toUpperCase()}`;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              side='left'
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:my-2 pl-0 transition-none'
            >
              <Avatar className='w-8 h-8 rounded-lg'>
                <AvatarImage src={getGravatarUrl(user?.email)} alt={user?.firstName} />
                <AvatarFallback className='rounded-lg'>{userInitials(user)}</AvatarFallback>
              </Avatar>
              <div className='grid flex-1 text-sm leading-tight text-left'>
                {!user?.email ? (
                  <>
                    <Skeleton className='w-1/2 h-3 mb-1' />
                    <Skeleton className='h-3' />
                  </>
                ) : (
                  <>
                    <span className='font-semibold capitalize truncate'>
                      {user?.firstName} {user?.lastName}
                    </span>
                    <span className='text-xs truncate'>{user?.email}</span>
                  </>
                )}
              </div>

              <CaretRightIcon className='ml-auto size-4' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg'
            side={isMobile ? 'bottom' : 'right'}
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='p-0 font-normal'>
              <div className='flex items-center gap-2 px-1 py-2 text-sm text-left'>
                <Avatar className='w-8 h-8 rounded-lg'>
                  <AvatarImage src={getGravatarUrl(user?.email)} alt={`${user?.firstName} ${user?.lastName}`} />
                  <AvatarFallback className='rounded-lg'>{userInitials(user)}</AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-sm leading-tight text-left'>
                  <span className='font-semibold truncate'>
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className='text-xs truncate'>{user?.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push('/user/manage')}>
                <BadgeCheck className='mr-2 size-4' />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ComponentPlaceholderIcon className='mr-2 size-4' />
                Billing
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            {/* Themes sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <MoonIcon className='w-4 h-4 mr-2' />
                Themes
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Themes</DropdownMenuLabel>
                  {themes.map((theme) => (
                    <DropdownMenuItem
                      key={theme}
                      className={cn('capitalize', theme === currentTheme && 'bg-muted')}
                      onClick={() => setTheme(theme)}
                    >
                      {theme}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            {/* Appearances sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <LayoutGrid className='w-4 h-4 mr-2' />
                Appearances
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Appearances</DropdownMenuLabel>
                  {appearances.map((thisAppearance) => (
                    <DropdownMenuItem
                      key={thisAppearance}
                      className={cn('capitalize', thisAppearance === appearance && 'bg-muted')}
                      onClick={() => setAppearance(thisAppearance)}
                    >
                      {thisAppearance}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className='mr-2 size-4' />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
