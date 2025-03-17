'use client';

import { useState } from 'react';
import PromptPanel from '@/components/prompt/PromptPanel';
import NewPromptDialog from '@/components/prompt/PromptDialog';
import { SidebarPage } from '@/components/layout/SidebarPage';

export default function PromptPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <SidebarPage title='Prompt Management'>
      <div className='container mx-auto p-6 space-y-6'>
        <PromptPanel />
        <NewPromptDialog open={showCreateDialog} setOpen={setShowCreateDialog} />
      </div>
    </SidebarPage>
  );
}
