import { describe, expect, it } from 'vitest';
import {
  CHARTS_CONTRIBUTION_DEFAULT_TITLE,
  isSprintContributionWidgetType,
  sprintContributionLoggedIndicatorClass,
  SPRINT_CONTRIBUTION_GROUP_LABELS,
} from '@/app/charts/_helpers/charts-sprint-contribution-widget';

describe('charts-sprint-contribution-widget', () => {
  it('identifies the contribution type id', () => {
    expect(isSprintContributionWidgetType('sprint-contribution')).toBe(true);
    expect(isSprintContributionWidgetType('burndown')).toBe(false);
  });

  it('exposes default title and group labels', () => {
    expect(CHARTS_CONTRIBUTION_DEFAULT_TITLE).toBe('Sprint contribution');
    expect(SPRINT_CONTRIBUTION_GROUP_LABELS.active).toBe('Active');
    expect(SPRINT_CONTRIBUTION_GROUP_LABELS.unassigned).toBe('Unassigned');
    expect(SPRINT_CONTRIBUTION_GROUP_LABELS.done).toBe('Done');
  });

  it('maps logged bands to indicator classes', () => {
    expect(sprintContributionLoggedIndicatorClass('critical')).toContain(
      'rose'
    );
    expect(sprintContributionLoggedIndicatorClass('high')).toContain('sky');
  });
});
