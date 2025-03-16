'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useInteractiveConfig } from '@/components/interactive/InteractiveConfigContext';
import PromptPanel from '@/components/prompt/PromptPanel';
import NewPromptDialog from '@/components/prompt/PromptDialog';

export default function PromptPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const context = useInteractiveConfig();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <PromptPanel
        showCreateDialog={showCreateDialog}
        setShowCreateDialog={setShowCreateDialog}
        context={context}
        searchParams={searchParams}
        pathname={pathname}
        router={router}
      />
      <NewPromptDialog open={showCreateDialog} setOpen={setShowCreateDialog} />
    </div>
  );
}
