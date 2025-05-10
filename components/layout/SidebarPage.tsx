import { ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface SidebarPageProps {
  title: string | ReactNode;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
}

export function SidebarPage({ title, children, className, headerActions }: SidebarPageProps) {
  return (
    <SidebarInset>
      <header
        className='flex shrink-0 items-center justify-between gap-2 px-6 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 w-full sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3rem + env(safe-area-inset-top))' }}
      >
        <div className='flex items-center h-full gap-2'>
          <div className='md:hidden flex items-center'>
            <SidebarTrigger className='size-10' />
            <Separator orientation='vertical' className='h-4' />
          </div>
          <span className='text-foreground font-medium'>{title}</span>
        </div>
        
        {headerActions && <div className='flex items-center'>{headerActions}</div>}
      </header>
      <main
        className={cn('flex flex-col flex-1 gap-6 px-6 py-4', className)}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </main>
    </SidebarInset>
  );
}
