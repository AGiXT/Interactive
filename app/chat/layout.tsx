'use client';

import { SidebarPage } from '@/components/layout/SidebarPage';
import { SidebarInset } from '@/components/ui/sidebar';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset>
      <SidebarPage title='Chat'>{children}</SidebarPage>
    </SidebarInset>
  );
}
