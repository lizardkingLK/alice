import { describe, it, expect, vi } from 'vitest';
import {
  parseJsonWorkItemDocument,
  parseCsvWorkItemDocument,
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
  });
});
