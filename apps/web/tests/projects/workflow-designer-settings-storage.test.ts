import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORKFLOW_DESIGNER_SETTINGS_COOKIE_NAME,
  parseWorkflowDesignerSettingsOpenCookie,
  persistWorkflowDesignerSettingsOpen,
  writeWorkflowDesignerSettingsOpenCookie,
} from '@/app/projects/_helpers/workflow-designer-settings-storage';

describe('workflow-designer-settings-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: '' });
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('defaults to expanded when cookie is missing', () => {
    expect(parseWorkflowDesignerSettingsOpenCookie(undefined)).toBe(true);
  });

  it('parses true and false cookie values', () => {
    expect(parseWorkflowDesignerSettingsOpenCookie('true')).toBe(true);
    expect(parseWorkflowDesignerSettingsOpenCookie('false')).toBe(false);
    expect(parseWorkflowDesignerSettingsOpenCookie('nope')).toBe(false);
  });

  it('writes cookie and localStorage together', () => {
    persistWorkflowDesignerSettingsOpen('user-1', false);
    expect(document.cookie).toContain(
      `${WORKFLOW_DESIGNER_SETTINGS_COOKIE_NAME}=false`
    );
    expect(document.cookie).toContain('path=/');
    expect(
      localStorage.getItem('alice:workflow-designer-settings-open:v1:user-1')
    ).toBe('false');

    writeWorkflowDesignerSettingsOpenCookie(true);
    expect(document.cookie).toContain(
      `${WORKFLOW_DESIGNER_SETTINGS_COOKIE_NAME}=true`
    );
  });
});
