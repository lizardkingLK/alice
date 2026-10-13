/**
 * Workflow designer Settings panel open/collapsed preference.
 * Cookie for SSR seed; localStorage mirrors the same boolean per user.
 */

import { createBooleanLocalPreference } from '@/lib/local-preference/create-boolean-local-preference';

export const WORKFLOW_DESIGNER_SETTINGS_COOKIE_NAME =
  'workflow_designer_settings_open';
export const WORKFLOW_DESIGNER_SETTINGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const workflowDesignerSettingsLocalPreference = createBooleanLocalPreference({
  storagePrefix: 'alice:workflow-designer-settings-open:v1:',
  defaultValue: true,
});

export const workflowDesignerSettingsOpenStorageKey =
  workflowDesignerSettingsLocalPreference.storageKey;

export const readWorkflowDesignerSettingsOpenLocal =
  workflowDesignerSettingsLocalPreference.read;

export const writeWorkflowDesignerSettingsOpenLocal =
  workflowDesignerSettingsLocalPreference.write;

export function parseWorkflowDesignerSettingsOpenCookie(
  value: string | undefined
): boolean {
  if (value === undefined) {
    return true;
  }
  return value === 'true';
}

/** Client: persist toggle so the next SSR paint matches. */
export function writeWorkflowDesignerSettingsOpenCookie(open: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${WORKFLOW_DESIGNER_SETTINGS_COOKIE_NAME}=${open}; path=/; max-age=${WORKFLOW_DESIGNER_SETTINGS_COOKIE_MAX_AGE}`;
}

/** Write cookie + localStorage together. */
export function persistWorkflowDesignerSettingsOpen(
  userId: string | null | undefined,
  open: boolean
): void {
  writeWorkflowDesignerSettingsOpenCookie(open);
  writeWorkflowDesignerSettingsOpenLocal(userId, open);
}
