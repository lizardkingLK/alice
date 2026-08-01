import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ComingSoonPanel } from '@/app/help/_components/coming-soon-panel';

export const metadata: Metadata = {
  title: 'Docs',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DocsPage() {
  return (
    <DashboardShell description="Product documentation for Jira Teams.">
      <ComingSoonPanel title="Docs" />
    </DashboardShell>
  );
}
