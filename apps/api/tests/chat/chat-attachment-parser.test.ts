import { describe, it, expect, vi } from 'vitest';
import {
  parseJsonWorkItemDocument,
  parseCsvWorkItemDocument,
  parseDelimitedWorkItemDocument,
  parseMarkdownTableWorkItemDocument,
  parseIndentedTextWorkItemDocument,
  parseYamlWorkItemDocument,
  fetchAndParseWorkItemAttachment,
} from '../../src/routes/api/chat/chat-attachment-parser';
import { ChatAttachmentFileTypeEnum, WorkItemTypeEnum } from '@repo/types';

describe('chat-attachment-parser', () => {
  describe('parseJsonWorkItemDocument', () => {
    it('parses a flat array of work items with fields and dynamic fields', () => {
      const jsonContent = JSON.stringify([
        {
          title: 'Implement OAuth Flow',
          type: 'Story',
          priority: 'high',
          description: 'Authenticate users via Google',
          customTag: 'Security',
          estimatedHours: 12,
        },
        {
          title: 'Fix token refresh bug',
          type: 'bug',
          priority: 'highest',
          jiraIssueKey: 'AUTH-101',
        },
      ]);

      const items = parseJsonWorkItemDocument(jsonContent);
      expect(items).toHaveLength(2);

      const first = items[0]!;
      expect(first.title).toBe('Implement OAuth Flow');
      expect(first.type).toBe(WorkItemTypeEnum.Story);
      expect(first.priority).toBe('high');
      expect(first.description).toBe('Authenticate users via Google');
      expect(first.dynamicFields).toEqual({
        customTag: 'Security',
        estimatedHours: 12,
      });

      const second = items[1]!;
      expect(second.title).toBe('Fix token refresh bug');
      expect(second.type).toBe(WorkItemTypeEnum.Issue);
      expect(second.priority).toBe('highest');
      expect(second.jiraIssueKey).toBe('AUTH-101');
    });

    it('parses wrapped items with nested hierarchy (children)', () => {
      const jsonContent = JSON.stringify({
        workItems: [
          {
            id: 'parent-1',
            title: 'User Management Epic',
            type: 'Epic',
            priority: 'medium',
            children: [
              {
                id: 'child-1',
                title: 'User Profile Page',
                type: 'Story',
                priority: 'medium',
                subtasks: [
                  {
                    title: 'Avatar upload widget',
                    type: 'Task',
                    priority: 'low',
                  },
                ],
              },
            ],
          },
        ],
      });

      const items = parseJsonWorkItemDocument(jsonContent);
      expect(items).toHaveLength(1);

      const epic = items[0]!;
      expect(epic.title).toBe('User Management Epic');
      expect(epic.type).toBe(WorkItemTypeEnum.Epic);
      expect(epic.children).toHaveLength(1);

      const story = epic.children![0]!;
      expect(story.title).toBe('User Profile Page');
      expect(story.parentReference).toBe('parent-1');
      expect(story.children).toHaveLength(1);

      const task = story.children![0]!;
      expect(task.title).toBe('Avatar upload widget');
      expect(task.parentReference).toBe('child-1');
    });
  });

  describe('parseCsvWorkItemDocument', () => {
    it('parses CSV with headers, aliases, hierarchy, and dynamic fields', () => {
      const csvContent = `Title,Type,Priority,Description,Parent,Department,Client
Build Authentication,Story,high,Implement OAuth,Epic-1,Engineering,Internal
Setup Database,Task,medium,Postgres setup,,DevOps,ACME`;

      const items = parseCsvWorkItemDocument(csvContent);
      expect(items).toHaveLength(2);

      const first = items[0]!;
      expect(first.title).toBe('Build Authentication');
      expect(first.type).toBe(WorkItemTypeEnum.Story);
      expect(first.priority).toBe('high');
      expect(first.description).toBe('Implement OAuth');
      expect(first.parentReference).toBe('Epic-1');
      expect(first.dynamicFields).toEqual({
        Department: 'Engineering',
        Client: 'Internal',
      });

      const second = items[1]!;
      expect(second.title).toBe('Setup Database');
      expect(second.type).toBe(WorkItemTypeEnum.Task);
      expect(second.parentReference).toBeNull();
      expect(second.dynamicFields).toEqual({
        Department: 'DevOps',
        Client: 'ACME',
      });
    });

    it('handles semicolon delimiters and quoted values', () => {
      const csvContent = `Name;Issue Type;Priority;Details
"Feature: Multi-tenant Support";feature;highest;"Supports multiple organizations; isolated DB"`;

      const items = parseCsvWorkItemDocument(csvContent);
      expect(items).toHaveLength(1);

      const item = items[0]!;
      expect(item.title).toBe('Feature: Multi-tenant Support');
      expect(item.type).toBe(WorkItemTypeEnum.Feature);
      expect(item.priority).toBe('highest');
      expect(item.description).toBe(
        'Supports multiple organizations; isolated DB'
      );
    });

    it('parses CSV with ID and Parent columns for hierarchy linking', () => {
      const csvContent = `ID,Type,Title,Parent,Priority
item-core,Epic,Core Infrastructure,,high
item-auth,Feature,Authentication Service,item-core,high
item-login,Story,User Login API,item-auth,medium`;

      const items = parseDelimitedWorkItemDocument(csvContent);
      expect(items).toHaveLength(3);

      expect(items[0]?.temporaryIdentifier).toBe('item-core');
      expect(items[0]?.parentReference).toBeNull();

      expect(items[1]?.temporaryIdentifier).toBe('item-auth');
      expect(items[1]?.parentReference).toBe('item-core');

      expect(items[2]?.temporaryIdentifier).toBe('item-login');
      expect(items[2]?.parentReference).toBe('item-auth');
    });

    it('parses Jira export CSV with Issue key, Summary, Epic Link, and multiline descriptions', () => {
      const csvContent = `Issue key,Issue Type,Summary,Epic Link,Priority,Description
ALICE-10,Epic,Notification Engine,,high,"Main engine for alerts"
ALICE-11,Feature,Push Notifications,ALICE-10,high,"Sends APNS and FCM
with retry logic"`;

      const items = parseDelimitedWorkItemDocument(csvContent);
      expect(items).toHaveLength(2);

      const epic = items[0]!;
      expect(epic.jiraIssueKey).toBe('ALICE-10');
      expect(epic.temporaryIdentifier).toBe('ALICE-10');
      expect(epic.title).toBe('Notification Engine');
      expect(epic.parentReference).toBeNull();

      const feature = items[1]!;
      expect(feature.jiraIssueKey).toBe('ALICE-11');
      expect(feature.temporaryIdentifier).toBe('ALICE-11');
      expect(feature.title).toBe('Push Notifications');
      expect(feature.parentReference).toBe('ALICE-10');
      expect(feature.description).toContain(
        'Sends APNS and FCM\nwith retry logic'
      );
    });

    it('parses TSV (tab-delimited) work item content', () => {
      const tsvContent = `Key\tType\tTitle\tParent\tPoints\tDept
TASK-1\tEpic\tPlatform Infra\t\t\tDevOps
TASK-2\tFeature\tCI/CD Pipeline\tTASK-1\t8\tDevOps`;

      const items = parseDelimitedWorkItemDocument(tsvContent);
      expect(items).toHaveLength(2);

      expect(items[0]?.temporaryIdentifier).toBe('TASK-1');
      expect(items[0]?.type).toBe(WorkItemTypeEnum.Epic);

      expect(items[1]?.temporaryIdentifier).toBe('TASK-2');
      expect(items[1]?.type).toBe(WorkItemTypeEnum.Feature);
      expect(items[1]?.parentReference).toBe('TASK-1');
      expect(items[1]?.storyPoints).toBe(8);
      expect(items[1]?.dynamicFields).toEqual({ Dept: 'DevOps' });
    });
  });

  describe('parseMarkdownTableWorkItemDocument', () => {
    it('parses Markdown table with headers, types, parent links, and custom columns', () => {
      const mdTable = `| Type | Title | Description | Priority | Parent | CostCenter |
| --- | --- | --- | --- | --- | --- |
| Epic | Payment Gateway | Handle payments | high | | CC-100 |
| Feature | Stripe Integration | Credit card checkout | high | Payment Gateway | CC-100 |
| Story | Webhook Listener | Process events | medium | Stripe Integration | CC-100 |`;

      const items = parseMarkdownTableWorkItemDocument(mdTable);
      expect(items).toHaveLength(3);

      expect(items[0]?.title).toBe('Payment Gateway');
      expect(items[0]?.type).toBe(WorkItemTypeEnum.Epic);
      expect(items[0]?.parentReference).toBeNull();
      expect(items[0]?.dynamicFields).toEqual({ CostCenter: 'CC-100' });

      expect(items[1]?.title).toBe('Stripe Integration');
      expect(items[1]?.type).toBe(WorkItemTypeEnum.Feature);
      expect(items[1]?.parentReference).toBe('Payment Gateway');

      expect(items[2]?.title).toBe('Webhook Listener');
      expect(items[2]?.type).toBe(WorkItemTypeEnum.Story);
      expect(items[2]?.parentReference).toBe('Stripe Integration');
    });
  });

  describe('parseIndentedTextWorkItemDocument', () => {
    it('parses hierarchical indented outline into linked work items', () => {
      const outline = `- [Epic] Analytics Platform: Unified tracking (Key: ANALYTICS-1, Priority: High)
  - [Feature] Event Ingestion (Priority: High)
    - [Story] Kafka Consumer (Points: 5)
      - [Task] Unit tests (Priority: Low)`;

      const items = parseIndentedTextWorkItemDocument(outline);
      expect(items).toHaveLength(4);

      const epic = items[0]!;
      expect(epic.temporaryIdentifier).toBe('ANALYTICS-1');
      expect(epic.jiraIssueKey).toBe('ANALYTICS-1');
      expect(epic.title).toBe('Analytics Platform');
      expect(epic.description).toBe('Unified tracking');
      expect(epic.type).toBe(WorkItemTypeEnum.Epic);
      expect(epic.parentReference).toBeNull();

      const feature = items[1]!;
      expect(feature.title).toBe('Event Ingestion');
      expect(feature.type).toBe(WorkItemTypeEnum.Feature);
      expect(feature.parentReference).toBe('ANALYTICS-1');

      const story = items[2]!;
      expect(story.title).toBe('Kafka Consumer');
      expect(story.type).toBe(WorkItemTypeEnum.Story);
      expect(story.storyPoints).toBe(5);
      expect(story.parentReference).toBe(feature.temporaryIdentifier);

      const task = items[3]!;
      expect(task.title).toBe('Unit tests');
      expect(task.type).toBe(WorkItemTypeEnum.Task);
      expect(task.priority).toBe('low');
      expect(task.parentReference).toBe(story.temporaryIdentifier);
    });
  });

  describe('parseYamlWorkItemDocument', () => {
    it('parses YAML document with nested children and attributes', () => {
      const yamlContent = `
- title: Cloud Migration
  type: Epic
  priority: high
  children:
    - title: Database Migration
      type: Feature
      priority: high
      children:
        - title: PostgreSQL Setup
          type: Story
          priority: medium
          storyPoints: 5
`;

      const items = parseYamlWorkItemDocument(yamlContent);
      expect(items).toHaveLength(1);

      const epic = items[0]!;
      expect(epic.title).toBe('Cloud Migration');
      expect(epic.type).toBe(WorkItemTypeEnum.Epic);
      expect(epic.children).toHaveLength(1);

      const feature = epic.children![0]!;
      expect(feature.title).toBe('Database Migration');
      expect(feature.type).toBe(WorkItemTypeEnum.Feature);
      expect(feature.children).toHaveLength(1);

      const story = feature.children![0]!;
      expect(story.title).toBe('PostgreSQL Setup');
      expect(story.type).toBe(WorkItemTypeEnum.Story);
      expect(story.storyPoints).toBe(5);
    });
  });

  describe('fetchAndParseWorkItemAttachment', () => {
    it('downloads and parses JSON from signed URL', async () => {
      const mockPayload = [
        { title: 'Downloaded Task', type: 'Task', priority: 'low' },
      ];

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockPayload)),
      });

      try {
        const result = await fetchAndParseWorkItemAttachment(
          'https://storage.example.com/chat-attachments/file.json?token=xyz',
          'file.json',
          ChatAttachmentFileTypeEnum.Json
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.title).toBe('Downloaded Task');
        expect(result.summary).toContain('Successfully parsed "file.json"');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('downloads and parses Markdown tables when attached as .md', async () => {
      const mdContent = `| Type | Title | Priority |
| --- | --- | --- |
| Task | Readme Documentation | low |`;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mdContent),
      });

      try {
        const result = await fetchAndParseWorkItemAttachment(
          'https://storage.example.com/chat-attachments/tasks.md',
          'tasks.md',
          ChatAttachmentFileTypeEnum.Text
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.title).toBe('Readme Documentation');
        expect(result.items[0]?.type).toBe(WorkItemTypeEnum.Task);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('downloads and parses pipe-delimited text files via parser registry fallback', async () => {
      const pipeContent = `Title|Type|Priority
Pipe Task|Task|high`;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(pipeContent),
      });

      try {
        const result = await fetchAndParseWorkItemAttachment(
          'https://storage.example.com/chat-attachments/items.txt',
          'items.txt',
          ChatAttachmentFileTypeEnum.Text
        );

        expect(result.items).toHaveLength(1);
        expect(result.items[0]?.title).toBe('Pipe Task');
        expect(result.items[0]?.type).toBe(WorkItemTypeEnum.Task);
        expect(result.items[0]?.priority).toBe('high');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('downloads and parses outline colon format with metadata aliases', async () => {
      const outlineContent = `- Epic: Mobile App (Key: MOB-1, Priority: highest)
  - Task: Setup React Native (estimate: 8, issuekey: MOB-2, customCol: Mobile)`;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(outlineContent),
      });

      try {
        const result = await fetchAndParseWorkItemAttachment(
          'https://storage.example.com/chat-attachments/outline.txt',
          'outline.txt',
          ChatAttachmentFileTypeEnum.Text
        );

        expect(result.items).toHaveLength(2);
        expect(result.items[0]?.title).toBe('Mobile App');
        expect(result.items[0]?.type).toBe(WorkItemTypeEnum.Epic);
        expect(result.items[0]?.jiraIssueKey).toBe('MOB-1');
        expect(result.items[0]?.priority).toBe('highest');

        expect(result.items[1]?.title).toBe('Setup React Native');
        expect(result.items[1]?.type).toBe(WorkItemTypeEnum.Task);
        expect(result.items[1]?.storyPoints).toBe(8);
        expect(result.items[1]?.jiraIssueKey).toBe('MOB-2');
        expect(result.items[1]?.dynamicFields).toEqual({ customCol: 'Mobile' });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('parses YAML with literal booleans and nulls', () => {
      const yamlContent = `
- title: Task With Literals
  type: Task
  isArchived: false
  isReady: true
  emptyNotes: null
  tildeNull: ~
  quotedString: "quoted value"
`;
      const items = parseYamlWorkItemDocument(yamlContent);
      expect(items).toHaveLength(1);
      expect(items[0]?.dynamicFields?.isArchived).toBe(false);
      expect(items[0]?.dynamicFields?.isReady).toBe(true);
      expect(items[0]?.dynamicFields?.emptyNotes).toBeNull();
      expect(items[0]?.dynamicFields?.tildeNull).toBeNull();
      expect(items[0]?.dynamicFields?.quotedString).toBe('quoted value');
    });
  });
});
