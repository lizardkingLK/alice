import { DashboardOverview } from '@/app/dashboard/_components/dashboard-overview';
import { getDashboardBurndownBootstrap } from '@/app/dashboard/_services/dashboard-burndown.server';

/** Async RSC — owns burndown prefetch so the shell can stream first. */
export async function DashboardOverviewData() {
  const burndownBootstrap = await getDashboardBurndownBootstrap();
  return <DashboardOverview burndownBootstrap={burndownBootstrap} />;
}
