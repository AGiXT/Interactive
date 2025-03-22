'use client';
import Subscribe from '@/components/auth/Subscribe';
import { SidebarInset } from '@/components/ui/sidebar';

export default function Page({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  return (
    <SidebarInset>
      <Subscribe searchParams={searchParams} />
    </SidebarInset>
  );
}
