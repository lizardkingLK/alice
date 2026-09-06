'use client';

import { ABOUT_FLOW_PHASES } from '@/app/about/_components/about-flow-data';
import { AboutFlowPanel } from '@/app/about/_components/about-flow-panel';

/** Client-owned so Lucide icons never cross the RSC → client prop boundary. */
export function AboutFlowStory() {
  return (
    <>
      {ABOUT_FLOW_PHASES.map((phase, index) => (
        <AboutFlowPanel key={phase.step} phase={phase} index={index} />
      ))}
    </>
  );
}
