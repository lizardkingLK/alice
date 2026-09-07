import type { WorkItemPriority } from './work-item-priorities.js';
import type { WorkItemStatus } from './work-item-status.js';
import type { WorkItemType } from './work-item-types.js';

export enum ChatAttachmentFileTypeEnum {
  Json = 'json',
  Csv = 'csv',
  Text = 'text',
  Image = 'image',
  Other = 'other',
}

export enum ChatAttachmentUploadStatusEnum {
  Idle = 'idle',
  Uploading = 'uploading',
  Ready = 'ready',
  Error = 'error',
}

export enum WorkItemDeduplicationActionEnum {
  Create = 'create',
  Skip = 'skip',
  Update = 'update',
}

export enum WorkItemDeduplicationMatchStatusEnum {
  New = 'new',
  ExactDuplicate = 'exact_duplicate',
  PotentialDuplicate = 'potential_duplicate',
}

export enum ChatAgentToolNameEnum {
  ListProjects = 'list_projects',
  CreateProject = 'create_project',
  ListSprints = 'list_sprints',
  CreateSprint = 'create_sprint',
  ListUsers = 'list_users',
  CreateWorkItem = 'create_work_item',
  ParseWorkItemAttachment = 'parse_work_item_attachment',
  CheckWorkItemDuplicates = 'check_work_item_duplicates',
  BatchImportWorkItems = 'batch_import_work_items',
}

export interface ChatAttachmentWire {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  url: string;
  fileType: ChatAttachmentFileTypeEnum;
}

export interface ParsedWorkItemNode {
  temporaryIdentifier: string;
  title: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  description: string | null;
  status?: WorkItemStatus;
  storyPoints?: number | null;
  dueDate?: string | null;
  labels?: string[];
  jiraIssueKey?: string | null;
  parentReference?: string | null;
  children?: ParsedWorkItemNode[];
  dynamicFields?: Record<string, unknown>;
}

export interface WorkItemDeduplicationItemResult {
  incomingItem: ParsedWorkItemNode;
  matchStatus: WorkItemDeduplicationMatchStatusEnum;
  existingWorkItemId: string | null;
  existingWorkItemKey: string | null;
  existingWorkItemTitle: string | null;
  matchReason: string;
  recommendedAction: WorkItemDeduplicationActionEnum;
}

export interface WorkItemDeduplicationReport {
  totalCount: number;
  newCount: number;
  exactDuplicateCount: number;
  potentialDuplicateCount: number;
  items: WorkItemDeduplicationItemResult[];
}
