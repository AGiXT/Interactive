'use client';

import { useState } from 'react';
import ChainPanel from '@/components/chain/ChainPanel';
import { SidebarPage } from '@/components/layout/SidebarPage';
import { ChainDialog } from '@/components/chain/ChainDialog';

export default function ChainPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <SidebarPage title='Chains'>
      <ChainPanel showCreateDialog={showCreateDialog} setShowCreateDialog={setShowCreateDialog} />
      <ChainDialog open={showCreateDialog} setOpen={setShowCreateDialog} />
    </SidebarPage>
  );
}
