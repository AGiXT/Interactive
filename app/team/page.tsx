import { SidebarPage } from '@/components/idiot/appwrapper/SidebarPage';
import Team from '@/components/idiot/auth/management/Team';
import TeamUsers from '@/components/idiot/auth/management/TeamUsers';

export default function TeamPage() {
  return (
    <SidebarPage title='Team Management'>
      <div className='overflow-x-auto px-4'>
        <Team />
        <TeamUsers />
      </div>
    </SidebarPage>
  );
}
