import { Providers } from '@/components/agent/providers';
import AgentPanel from '@/components/agent/AgentPanel';
import { SidebarPage } from '@/components/layout/SidebarPage';

export default function ProvidersPage() {
  return (
    <SidebarPage title='Settings'>
      <AgentPanel />
      <Providers />
    </SidebarPage>
  );
}
