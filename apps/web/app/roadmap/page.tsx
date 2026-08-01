import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RoadmapView } from '@/app/roadmap/_components/roadmap-view';

export const metadata: Metadata = {
  title: 'Roadmap',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RoadmapPage() {
  return (
    <DashboardShell description="Planned AI, integrations, and product direction.">
      <RoadmapView />
    </DashboardShell>
  );
}
