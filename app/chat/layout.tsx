'use client';

import { SidebarPage } from '@/components/layout/SidebarPage';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <SidebarPage title='Chat'>{children}</SidebarPage>;
}
