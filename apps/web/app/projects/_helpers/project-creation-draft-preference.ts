import { createBooleanLocalPreference } from '@/lib/local-preference/create-boolean-local-preference';

const STORAGE_PREFIX = 'alice:project-creation-draft-auto:v1:';

/**
 * When enabled, project create drafts auto-save while editing and auto-resume
 * on the next open (no resume gate / close confirmation). Browser-local only.
 */
const projectCreationDraftAutoPreference = createBooleanLocalPreference({
  storagePrefix: STORAGE_PREFIX,
  defaultValue: false,
});

export const PROJECT_CREATION_DRAFT_AUTO_STORAGE_PREFIX = STORAGE_PREFIX;

export function projectCreationDraftAutoStorageKey(userId: string): string {
  return projectCreationDraftAutoPreference.storageKey(userId);
}

export function readProjectCreationDraftAuto(
  userId: string | null | undefined
): boolean {
  return projectCreationDraftAutoPreference.read(userId);
}

export function writeProjectCreationDraftAuto(
  userId: string | null | undefined,
  enabled: boolean
): void {
  projectCreationDraftAutoPreference.write(userId, enabled);
}
