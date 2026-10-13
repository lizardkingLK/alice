import { WORK_ITEM_TYPES } from '@repo/types';
import { z } from 'zod';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

export const PROJECT_CREATION_DRAFT_VERSION = 1 as const;

const STORAGE_PREFIX = `alice:project-creation-draft:v${PROJECT_CREATION_DRAFT_VERSION}:`;
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
]);

const projectCreationDraftSchema = z.object({
  version: z.literal(PROJECT_CREATION_DRAFT_VERSION),
  currentStep: wizardStepSchema,
  basicInfo: z.object({
    name: z.string(),
    key: z.string(),
    description: z.string(),
    selectedOwnerId: z.string(),
    status: z.enum(['active', 'archived']),
    startDate: dateInputSchema,
    endDate: dateInputSchema,
    selectedWorkItemTypes: z.array(z.enum(WORK_ITEM_TYPES)),
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

function resolveStorageKey(
  currentUserId: string | null | undefined
): string | null {
  const userId = normalizeUserId(currentUserId);
  return userId ? projectCreationDraftStorageKey(userId) : null;
}

/** Validate and sanitize unknown stored data. */
export function validateProjectCreationDraft(
  value: unknown
): ProjectCreationDraft | null {
  const parsed = projectCreationDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
  const storageKey = resolveStorageKey(currentUserId);
  if (!storageKey) {
    return null;
  }

  const stored = getLocalStorageJson<unknown>(storageKey);
  if (stored === null) {
    return null;
  }

  const validatedDraft = validateProjectCreationDraft(stored);
  if (!validatedDraft) {
    removeLocalStorageItem(storageKey);
  }
  return validatedDraft;
}

export function clearProjectCreationDraft(
  currentUserId: string | null | undefined
): boolean {
  const storageKey = resolveStorageKey(currentUserId);
  return storageKey ? removeLocalStorageItem(storageKey) : false;
}
