import Team from '@/components/idiot/auth/management/Team';
import TeamUsers from '@/components/idiot/auth/management/TeamUsers';
import { SidebarInset } from '@/components/ui/sidebar';
import { SidebarPage } from '@/components/idiot/appwrapper/SidebarPage';

export default function TeamPage() {
  return (
    <SidebarInset>
      <SidebarPage title='Team Management'>
        <div className='overflow-x-auto px-4'>
          <Team />
          <TeamUsers />
        </div>
      </SidebarPage>
    </SidebarInset>
  );
}
