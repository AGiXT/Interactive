import { Providers } from '@/components/interactive/Settings/providers';
import AgentPanel from '@/components/interactive/Settings/agent/AgentPanel';
import { SidebarPage } from '@/components/idiot/appwrapper/SidebarPage';

export default function ProvidersPage() {
  return (
    <SidebarPage title='Settings'>
      <AgentPanel />
      <Providers />
    </SidebarPage>
  );
}
