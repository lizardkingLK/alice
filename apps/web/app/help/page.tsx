import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ComingSoonPanel } from '@/app/help/_components/coming-soon-panel';

export const metadata: Metadata = {
  title: 'Help',
  robots: {
    index: false,
    follow: false,
  },
};

export default function HelpPage() {
  return (
    <DashboardShell description="Guides and support for Jira Teams.">
      <ComingSoonPanel title="Help" />
    </DashboardShell>
  );
}
