import Team from '@/components/team/Team';
import TeamUsers from '@/components/team/TeamUsers';
import { SidebarPage } from '@/components/layout/SidebarPage';

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
