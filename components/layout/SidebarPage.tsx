'use client';

import { ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Edit, Download, Trash } from 'lucide-react';

interface SidebarPageProps {
  title: string;
  children: ReactNode;
  className?: string;
  conversationName?: string;
  onRename?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  showControls?: boolean;
}

export function SidebarPage({ 
  title, 
  children, 
  className, 
  conversationName,
  onRename,
  onExport,
  onDelete,
  showControls = false
}: SidebarPageProps) {
  // Display conversation name if available, otherwise use title
  const displayTitle = conversationName || title;

  return (
    <SidebarInset>
      <header
        className='flex shrink-0 items-center justify-between gap-2 px-6 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 w-full sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'
        style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(3rem + env(safe-area-inset-top))' }}
      >
        <div className='flex items-center h-full'>
          <div className='flex items-center h-full md:hidden'>
            <SidebarTrigger className='size-10' />
            <Separator orientation='vertical' className='h-4' />
          </div>
          <span className='text-muted-foreground'>{displayTitle}</span>
        </div>

        {showControls && (
          <div className='flex items-center gap-2'>
            {onRename && (
              <Button variant='outline' size='icon' onClick={onRename} title="Rename Conversation">
                <Edit className='h-4 w-4' />
              </Button>
            )}
            
            {onExport && (
              <Button variant='outline' size='icon' onClick={onExport} title="Export Conversation">
                <Download className='h-4 w-4' />
              </Button>
            )}
            
            {onDelete && (
              <Button variant='outline' size='icon' onClick={onDelete} title="Delete Conversation">
                <Trash className='h-4 w-4' />
              </Button>
            )}
          </div>
        )}
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