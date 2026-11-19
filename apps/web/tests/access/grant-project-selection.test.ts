import { describe, expect, it } from 'vitest';
import {
  applyGrantToggle,
  applyMemberToggle,
  buildInitialGrantSelections,
  hasCoveringDomainForEmail,
  toGrantPayload,
} from '@/lib/access-requests/grant-project-selection';

const PROJECTS = [
  { id: 'p1', key: 'ACME', name: 'Acme' },
  { id: 'p2', key: 'BETA', name: 'Beta' },
  { id: 'p3', key: 'GAMMA', name: 'Gamma' },
] as const;

describe('buildInitialGrantSelections', () => {
  it('prefills Grant+Member for accessible requested keys and lists omitted', () => {
    const result = buildInitialGrantSelections(['ACME', 'MISSING'], PROJECTS);

    expect(result.omittedRequestedKeys).toEqual(['MISSING']);
    expect(result.selections).toEqual([
      { projectId: 'p1', granted: true, addMember: true },
      { projectId: 'p2', granted: false, addMember: false },
      { projectId: 'p3', granted: false, addMember: false },
    ]);
  });
});

describe('grant/member coupling', () => {
  it('turns Member on with Grant and clears both when Grant off', () => {
    expect(
      applyGrantToggle(
        { projectId: 'p1', granted: false, addMember: false },
        true
      )
    ).toEqual({ projectId: 'p1', granted: true, addMember: true });

    expect(
      applyGrantToggle(
        { projectId: 'p1', granted: true, addMember: true },
        false
      )
    ).toEqual({ projectId: 'p1', granted: false, addMember: false });
  });

  it('allows Member off while Grant stays on when not locked', () => {
    expect(
      applyMemberToggle(
        { projectId: 'p1', granted: true, addMember: true },
        false
      )
    ).toEqual({ projectId: 'p1', granted: true, addMember: false });
  });

  it('locks Member when covering domain', () => {
    expect(
      applyMemberToggle(
        { projectId: 'p1', granted: true, addMember: true },
        false,
        { memberLocked: true }
      )
    ).toEqual({ projectId: 'p1', granted: true, addMember: true });
  });

  it('builds payload from granted rows only', () => {
    expect(
      toGrantPayload([
        { projectId: 'p1', granted: true, addMember: true },
        { projectId: 'p2', granted: true, addMember: false },
        { projectId: 'p3', granted: false, addMember: false },
      ])
    ).toEqual([
      { projectId: 'p1', addMember: true },
      { projectId: 'p2', addMember: false },
    ]);
  });
});

describe('hasCoveringDomainForEmail', () => {
  it('matches requester domain against active domain values', () => {
    expect(
      hasCoveringDomainForEmail('guest@Partner.COM', ['partner.com'])
    ).toBe(true);
    expect(hasCoveringDomainForEmail('guest@other.com', ['partner.com'])).toBe(
      false
    );
  });
});
