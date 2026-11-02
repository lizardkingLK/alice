import { z } from 'zod';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

export const PROJECT_CREATION_DRAFT_VERSION = 2 as const;
const LEGACY_DRAFT_VERSION = 1 as const;

const STORAGE_PREFIX = `alice:project-creation-draft:v${PROJECT_CREATION_DRAFT_VERSION}:`;
const LEGACY_STORAGE_PREFIX = `alice:project-creation-draft:v${LEGACY_DRAFT_VERSION}:`;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateInput(value: string): boolean {
  if (value === '') {
    return true;
  }
  if (!DATE_INPUT_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const dateInputSchema = z.string().refine(isValidDateInput);
const wizardStepSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

const draftBodySchema = z.object({
  currentStep: wizardStepSchema,
  basicInfo: z.object({
    name: z.string(),
    key: z.string(),
    description: z.string(),
    selectedOwnerId: z.string(),
    status: z.enum(['active', 'archived']),
    startDate: dateInputSchema,
    endDate: dateInputSchema,
    selectedWorkItemTypes: z.array(z.string().trim().min(1)),
  }),
  imports: z.object({
    importFromJira: z.boolean(),
    jiraConnectionId: z.string(),
    jiraProjectKey: z.string(),
  }),
  sourceControl: z.object({
    enableGithub: z.boolean(),
    githubOwner: z.string(),
    githubRepoName: z.string(),
  }),
  sprint: z.object({
    createInitialSprint: z.boolean(),
    sprintName: z.string(),
    sprintGoal: z.string(),
    sprintStartDate: dateInputSchema,
    sprintEndDate: dateInputSchema,
  }),
  team: z.object({
    createInitialTeam: z.boolean(),
    teamName: z.string(),
    teamDescription: z.string(),
    teamManagerId: z.string(),
    teamTechStack: z.string(),
    teamMemberIds: z.array(z.string().min(1)),
  }),
});

const projectCreationDraftSchema = draftBodySchema.extend({
  version: z.literal(PROJECT_CREATION_DRAFT_VERSION),
});

const legacyDraftSchema = draftBodySchema.omit({ currentStep: true }).extend({
  version: z.literal(LEGACY_DRAFT_VERSION),
  currentStep: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

/**
 * Serializable create-wizard state. Date inputs remain YYYY-MM-DD strings (or
 * an empty string), matching the form controls. Authentication tokens and
 * other credentials are intentionally not part of this type.
 */
export type ProjectCreationDraft = z.infer<typeof projectCreationDraftSchema>;

function normalizeUserId(
  currentUserId: string | null | undefined
): string | null {
  if (typeof currentUserId !== 'string') {
    return null;
  }

  const normalized = currentUserId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function projectCreationDraftStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function legacyProjectCreationDraftStorageKey(userId: string): string {
  return `${LEGACY_STORAGE_PREFIX}${userId}`;
}

function resolveStorageKey(
  currentUserId: string | null | undefined
): string | null {
  const userId = normalizeUserId(currentUserId);
  return userId ? projectCreationDraftStorageKey(userId) : null;
}

/** v1 steps: Details(+types), Imports, Source, Sprint, Team → insert Types at 2. */
function migrateLegacyDraftStep(
  step: 1 | 2 | 3 | 4 | 5
): 1 | 2 | 3 | 4 | 5 | 6 {
  return step === 1 ? 1 : ((step + 1) as 2 | 3 | 4 | 5 | 6);
}

function migrateLegacyDraft(
  draft: z.infer<typeof legacyDraftSchema>
): ProjectCreationDraft {
  return {
    ...draft,
    version: PROJECT_CREATION_DRAFT_VERSION,
    currentStep: migrateLegacyDraftStep(draft.currentStep),
  };
}

/** Validate and sanitize unknown stored data. */
export function validateProjectCreationDraft(
  value: unknown
): ProjectCreationDraft | null {
  const parsed = projectCreationDraftSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const legacy = legacyDraftSchema.safeParse(value);
  if (!legacy.success) {
    return null;
  }
  return migrateLegacyDraft(legacy.data);
}

export function saveProjectCreationDraft(
  currentUserId: string | null | undefined,
  draft: ProjectCreationDraft
): boolean {
  const storageKey = resolveStorageKey(currentUserId);
  if (!storageKey) {
    return false;
  }

  const validatedDraft = validateProjectCreationDraft(draft);
  return validatedDraft
    ? setLocalStorageJson(storageKey, validatedDraft)
    : false;
}

export function readProjectCreationDraft(
  currentUserId: string | null | undefined
): ProjectCreationDraft | null {
  const userId = normalizeUserId(currentUserId);
  if (!userId) {
    return null;
  }

  const storageKey = projectCreationDraftStorageKey(userId);
  const stored = getLocalStorageJson<unknown>(storageKey);
  if (stored !== null) {
    const validatedDraft = validateProjectCreationDraft(stored);
    if (!validatedDraft) {
      removeLocalStorageItem(storageKey);
    }
    return validatedDraft;
  }

  const legacyKey = legacyProjectCreationDraftStorageKey(userId);
  const legacyStored = getLocalStorageJson<unknown>(legacyKey);
  if (legacyStored === null) {
    return null;
  }

  const migrated = validateProjectCreationDraft(legacyStored);
  removeLocalStorageItem(legacyKey);
  if (migrated) {
    setLocalStorageJson(storageKey, migrated);
  }
  return migrated;
}

export function clearProjectCreationDraft(
  currentUserId: string | null | undefined
): boolean {
  const userId = normalizeUserId(currentUserId);
  if (!userId) {
    return false;
  }
  const clearedCurrent = removeLocalStorageItem(
    projectCreationDraftStorageKey(userId)
  );
  const clearedLegacy = removeLocalStorageItem(
    legacyProjectCreationDraftStorageKey(userId)
  );
  return clearedCurrent || clearedLegacy;
}
