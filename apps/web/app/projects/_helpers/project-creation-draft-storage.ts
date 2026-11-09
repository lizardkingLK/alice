import { z } from 'zod';
import { buildDefaultProjectTypeDefs } from '@repo/types';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

export const PROJECT_CREATION_DRAFT_VERSION = 4 as const;
const V3_DRAFT_VERSION = 3 as const;
const V2_DRAFT_VERSION = 2 as const;
const V1_DRAFT_VERSION = 1 as const;

const STORAGE_PREFIX = `alice:project-creation-draft:v${PROJECT_CREATION_DRAFT_VERSION}:`;
const V3_STORAGE_PREFIX = `alice:project-creation-draft:v${V3_DRAFT_VERSION}:`;
const V2_STORAGE_PREFIX = `alice:project-creation-draft:v${V2_DRAFT_VERSION}:`;
const V1_STORAGE_PREFIX = `alice:project-creation-draft:v${V1_DRAFT_VERSION}:`;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

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

const emptyIntegrations = {
  aiBindingIds: [] as string[],
  defaultAiIntegrationId: null as string | null,
};

const workItemTypeDefSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().optional(),
  icon: z.string().trim().min(1),
  color: z.string().regex(HEX_COLOR_PATTERN).optional(),
  level: z.number().finite(),
});

const basicInfoSharedSchema = {
  name: z.string(),
  key: z.string(),
  description: z.string(),
  selectedOwnerId: z.string(),
  status: z.enum(['active', 'archived']),
  startDate: dateInputSchema,
  endDate: dateInputSchema,
};

const draftBodySchema = z.object({
  currentStep: wizardStepSchema,
  basicInfo: z.object({
    ...basicInfoSharedSchema,
    workItemTypeDefs: z.array(workItemTypeDefSchema).min(1),
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
  integrations: z.object({
    aiBindingIds: z.array(z.string()),
    defaultAiIntegrationId: z.string().nullable(),
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

const legacyBasicInfoSchema = z.object({
  ...basicInfoSharedSchema,
  selectedWorkItemTypes: z.array(z.string().trim().min(1)),
});

const legacySectionsSchema = z.object({
  imports: draftBodySchema.shape.imports,
  sourceControl: draftBodySchema.shape.sourceControl,
  sprint: draftBodySchema.shape.sprint,
  team: draftBodySchema.shape.team,
});

/** v3: same wizard steps as v4, but types stored as key strings only. */
const v3DraftSchema = legacySectionsSchema.extend({
  version: z.literal(V3_DRAFT_VERSION),
  currentStep: wizardStepSchema,
  basicInfo: legacyBasicInfoSchema,
  integrations: draftBodySchema.shape.integrations,
});

/** v2: Details, Types, Imports, Source, Sprint, Team (1–6); no AI bindings. */
const v2DraftSchema = legacySectionsSchema.extend({
  version: z.literal(V2_DRAFT_VERSION),
  currentStep: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  basicInfo: legacyBasicInfoSchema,
});

/** v1: Details(+types), Imports, Source, Sprint, Team (1–5). */
const v1DraftSchema = legacySectionsSchema.extend({
  version: z.literal(V1_DRAFT_VERSION),
  currentStep: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  basicInfo: legacyBasicInfoSchema,
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

function v3ProjectCreationDraftStorageKey(userId: string): string {
  return `${V3_STORAGE_PREFIX}${userId}`;
}

function v2ProjectCreationDraftStorageKey(userId: string): string {
  return `${V2_STORAGE_PREFIX}${userId}`;
}

function v1ProjectCreationDraftStorageKey(userId: string): string {
  return `${V1_STORAGE_PREFIX}${userId}`;
}

function resolveStorageKey(
  currentUserId: string | null | undefined
): string | null {
  const userId = normalizeUserId(currentUserId);
  return userId ? projectCreationDraftStorageKey(userId) : null;
}

function migrateLegacyBasicInfo(
  basicInfo: z.infer<typeof legacyBasicInfoSchema>
): ProjectCreationDraft['basicInfo'] {
  const { selectedWorkItemTypes, ...rest } = basicInfo;
  return {
    ...rest,
    workItemTypeDefs: buildDefaultProjectTypeDefs(selectedWorkItemTypes),
  };
}

/** v1 steps: Details(+types), Imports, Source, Sprint, Team → insert Types at 2. */
function migrateV1DraftStep(step: 1 | 2 | 3 | 4 | 5): 1 | 2 | 3 | 4 | 5 | 6 {
  return step === 1 ? 1 : ((step + 1) as 2 | 3 | 4 | 5 | 6);
}

/**
 * v2 → v3: merge Imports (3) + Source (4) into Integrations (3);
 * Sprint 5→4, Team 6→5.
 */
export function migrateV2DraftStep(
  step: 1 | 2 | 3 | 4 | 5 | 6
): 1 | 2 | 3 | 4 | 5 {
  if (step === 1 || step === 2) {
    return step;
  }
  if (step === 3 || step === 4) {
    return 3;
  }
  if (step === 5) {
    return 4;
  }
  return 5;
}

function migrateV3Draft(
  draft: z.infer<typeof v3DraftSchema>
): ProjectCreationDraft {
  return {
    ...draft,
    version: PROJECT_CREATION_DRAFT_VERSION,
    basicInfo: migrateLegacyBasicInfo(draft.basicInfo),
  };
}

function migrateV2Draft(
  draft: z.infer<typeof v2DraftSchema>
): ProjectCreationDraft {
  return migrateV3Draft({
    ...draft,
    version: V3_DRAFT_VERSION,
    currentStep: migrateV2DraftStep(draft.currentStep),
    integrations: { ...emptyIntegrations },
  });
}

function migrateV1Draft(
  draft: z.infer<typeof v1DraftSchema>
): ProjectCreationDraft {
  return migrateV2Draft({
    ...draft,
    version: V2_DRAFT_VERSION,
    currentStep: migrateV1DraftStep(draft.currentStep),
  });
}

/** Validate and sanitize unknown stored data. */
export function validateProjectCreationDraft(
  value: unknown
): ProjectCreationDraft | null {
  const parsed = projectCreationDraftSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const v3 = v3DraftSchema.safeParse(value);
  if (v3.success) {
    return migrateV3Draft(v3.data);
  }

  const v2 = v2DraftSchema.safeParse(value);
  if (v2.success) {
    return migrateV2Draft(v2.data);
  }

  const v1 = v1DraftSchema.safeParse(value);
  if (v1.success) {
    return migrateV1Draft(v1.data);
  }

  return null;
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

  const legacyKeys = [
    v3ProjectCreationDraftStorageKey(userId),
    v2ProjectCreationDraftStorageKey(userId),
    v1ProjectCreationDraftStorageKey(userId),
  ];

  for (const legacyKey of legacyKeys) {
    const legacyStored = getLocalStorageJson<unknown>(legacyKey);
    if (legacyStored === null) {
      continue;
    }
    const migrated = validateProjectCreationDraft(legacyStored);
    removeLocalStorageItem(legacyKey);
    if (migrated) {
      setLocalStorageJson(storageKey, migrated);
      return migrated;
    }
  }

  return null;
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
  const clearedV3 = removeLocalStorageItem(
    v3ProjectCreationDraftStorageKey(userId)
  );
  const clearedV2 = removeLocalStorageItem(
    v2ProjectCreationDraftStorageKey(userId)
  );
  const clearedV1 = removeLocalStorageItem(
    v1ProjectCreationDraftStorageKey(userId)
  );
  return clearedCurrent || clearedV3 || clearedV2 || clearedV1;
}
