import {
  parseWorkItemLabels,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
} from '@repo/types';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import {
  CHARTS_SAMPLE_MEMBERS,
  CHARTS_SAMPLE_PROJECTS,
  type ChartsSampleWorkItem,
} from '@/app/charts/_components/charts-sample.data';
import {
  parseCreateWorkItemFormData,
  parsePatchWorkItemFormData,
} from '@/app/work-items/_helpers/work-item-mutation-body';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

const FALLBACK_PROJECT_ID = '11111111-1111-4111-8111-111111111101';
const FALLBACK_OWNER_ID = '22222222-2222-4222-8222-222222222201';

/** Pad sample projects into form-ready `Project` rows (charts mock only). */
export function chartsSampleProjectsForForm(): Project[] {
  const now = '2026-01-01T00:00:00.000Z';
  return CHARTS_SAMPLE_PROJECTS.map((project) => ({
    id: project.id,
    name: project.name,
    key: project.key,
    description: null,
    owner_id: CHARTS_SAMPLE_MEMBERS[0]?.id ?? FALLBACK_OWNER_ID,
    status: 'active',
    start_date: null,
    end_date: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    deleted_at: null,
    attributes_config: null,
    workflow_config: null,
    github_repo: null,
    jira_connection_id: null,
    jira_project_key: null,
    has_github_token: false,
    logo_url: null,
    cover_picture: null,
  }));
}

export function chartsSampleMembersForForm(): {
  id: string;
  name: string;
  email: string;
}[] {
  return CHARTS_SAMPLE_MEMBERS.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
  }));
}

function memberById(id: string | null | undefined) {
  if (!id) {
    return null;
  }
  const member = CHARTS_SAMPLE_MEMBERS.find((entry) => entry.id === id);
  if (!member) {
    return null;
  }
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    profile_picture: member.profilePicture,
  };
}

function normalizeDescription(
  value: unknown
): string | Record<string, unknown> | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      if (typeof parsed === 'string') {
        return parsed;
      }
      return trimmed;
    } catch {
      // TipTap also accepts plain text as initial content.
      return trimmed;
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim().split('T')[0] ?? null;
}

function normalizeStoryPoints(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeLabels(value: unknown): string[] {
  return parseWorkItemLabels(value);
}

export function chartsSampleToDbWorkItem(
  sample: ChartsSampleWorkItem
): DbWorkItem {
  const now = new Date().toISOString();
  return {
    id: sample.id,
    title: sample.title,
    type: sample.type,
    status: sample.status,
    priority: sample.priority,
    project_id: sample.projectId,
    assignee_id: sample.assigneeId,
    reporter_id: null,
    parent_id: null,
    sprint_id: null,
    story_points: sample.storyPoints,
    done_at: null,
    description: (sample.description ?? null) as DbWorkItem['description'],
    due_date: sample.dueDate,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    jira_issue_key: null,
    labels: [...sample.labels],
    record_status: 'active',
    assignee: memberById(sample.assigneeId),
    reporter: null,
  };
}

function asStatus(value: unknown, fallback: WorkItemStatus): WorkItemStatus {
  return typeof value === 'string' && value
    ? (value as WorkItemStatus)
    : fallback;
}

function asType(value: unknown, fallback: WorkItemType): WorkItemType {
  return typeof value === 'string' && value
    ? (value as WorkItemType)
    : fallback;
}

function asPriority(
  value: unknown,
  fallback: WorkItemPriority
): WorkItemPriority {
  return typeof value === 'string' && value
    ? (value as WorkItemPriority)
    : fallback;
}

function nextSampleId(existing: readonly ChartsSampleWorkItem[]): string {
  let max = 0;
  for (const item of existing) {
    const match = /^wi-(\d+)$/.exec(item.id);
    if (match?.[1]) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `wi-${max + 1}`;
}

function sampleFromDbFallback(item: DbWorkItem): ChartsSampleWorkItem {
  return {
    id: item.id,
    title: item.title,
    status: item.status,
    type: item.type,
    priority: item.priority,
    assigneeId: item.assignee_id,
    projectId: item.project_id,
    description: normalizeDescription(item.description),
    dueDate: normalizeDueDate(item.due_date),
    storyPoints: item.story_points ?? null,
    labels: parseWorkItemLabels(item.labels),
  };
}

function mergePatchedSample(
  previous: ChartsSampleWorkItem,
  patch: ReturnType<typeof parsePatchWorkItemFormData>
): ChartsSampleWorkItem {
  return {
    id: previous.id,
    title:
      typeof patch.title === 'string' && patch.title.trim()
        ? patch.title.trim()
        : previous.title,
    status: asStatus(patch.status, previous.status),
    type: asType(patch.type, previous.type),
    priority: asPriority(patch.priority, previous.priority),
    assigneeId:
      patch.assignee_id === undefined
        ? previous.assigneeId
        : patch.assignee_id || null,
    projectId:
      typeof patch.project_id === 'string' && patch.project_id
        ? patch.project_id
        : previous.projectId,
    description:
      patch.description === undefined
        ? previous.description
        : normalizeDescription(patch.description),
    dueDate:
      patch.due_date === undefined
        ? previous.dueDate
        : normalizeDueDate(patch.due_date),
    storyPoints:
      patch.story_points === undefined
        ? previous.storyPoints
        : normalizeStoryPoints(patch.story_points),
    labels:
      patch.labels === undefined
        ? [...previous.labels]
        : normalizeLabels(patch.labels),
  };
}

export function chartsSampleFromFormData(
  formData: FormData,
  existing: readonly ChartsSampleWorkItem[],
  itemToEdit: DbWorkItem | null
): ChartsSampleWorkItem {
  if (itemToEdit) {
    const patch = parsePatchWorkItemFormData(formData, itemToEdit.updated_at);
    const previous =
      existing.find((item) => item.id === itemToEdit.id) ??
      sampleFromDbFallback(itemToEdit);
    return mergePatchedSample(previous, patch);
  }

  const body = parseCreateWorkItemFormData(formData);
  return {
    id: nextSampleId(existing),
    title: body.title.trim(),
    status: asStatus(body.status, 'New'),
    type: asType(body.type, 'Task'),
    priority: asPriority(body.priority, 'medium'),
    assigneeId: body.assignee_id || null,
    projectId:
      typeof body.project_id === 'string' && body.project_id
        ? body.project_id
        : (CHARTS_SAMPLE_PROJECTS[0]?.id ?? FALLBACK_PROJECT_ID),
    description: normalizeDescription(body.description),
    dueDate: normalizeDueDate(body.due_date),
    storyPoints: normalizeStoryPoints(body.story_points),
    labels: normalizeLabels(body.labels),
  };
}

export function applyChartsSampleLocalMutate(
  args: {
    mode: 'create' | 'update';
    formData: FormData;
    itemToEdit: DbWorkItem | null;
  },
  existing: readonly ChartsSampleWorkItem[]
): {
  readonly nextItems: ChartsSampleWorkItem[];
  readonly workItem: DbWorkItem;
} {
  const sample = chartsSampleFromFormData(
    args.formData,
    existing,
    args.itemToEdit
  );

  const nextItems =
    args.mode === 'update' && args.itemToEdit
      ? existing.map((item) => (item.id === sample.id ? sample : item))
      : [...existing, sample];

  return {
    nextItems,
    workItem: chartsSampleToDbWorkItem(sample),
  };
}
