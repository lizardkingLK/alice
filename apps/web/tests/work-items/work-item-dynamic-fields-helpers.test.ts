import { describe, it, expect } from 'vitest';
import {
  extractDynamicFieldValues,
  patchWorkItemDynamicFields,
  findWorkItemsWithFieldValues,
  parseTextDynamicFields,
  findDynamicFieldsInContent,
} from '@/app/work-items/_helpers/work-item-dynamic-fields';

describe('work-item-dynamic-fields helpers', () => {
  describe('parseTextDynamicFields', () => {
    it('returns empty object if marker is not present', () => {
      const result = parseTextDynamicFields('Just a normal description text.');
      expect(result).toEqual({});
    });

    it('extracts key-value pairs following [Dynamic Fields] marker', () => {
      const text = `This is description.\n\n[Dynamic Fields]\nmoscowRating: Must\nbusinessValue: 90\nsecurityClassification: Confidential`;
      const result = parseTextDynamicFields(text);
      expect(result).toEqual({
        moscowRating: 'Must',
        businessValue: '90',
        securityClassification: 'Confidential',
      });
    });

    it('skips empty lines or malformed lines without colons', () => {
      const text = `[Dynamic Fields]\n\nmoscowRating: Must\ninvalid line\n : empty key\n`;
      const result = parseTextDynamicFields(text);
      expect(result).toEqual({
        moscowRating: 'Must',
      });
    });
  });

  describe('findDynamicFieldsInContent', () => {
    it('returns null if content array has no node containing marker', () => {
      const content = [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
      ];
      expect(findDynamicFieldsInContent(content)).toBeNull();
    });

    it('extracts dynamic fields from child text node containing marker', () => {
      const content = [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '[Dynamic Fields]\nacceptanceCriteria: Must pass tests\nenvironment: Production',
            },
          ],
        },
      ];
      const result = findDynamicFieldsInContent(content);
      expect(result).toEqual({
        acceptanceCriteria: 'Must pass tests',
        environment: 'Production',
      });
    });
  });

  describe('extractDynamicFieldValues', () => {
    it('returns empty object for null, undefined, or non-object description', () => {
      expect(extractDynamicFieldValues(null)).toEqual({});
      expect(extractDynamicFieldValues(undefined)).toEqual({});
      expect(extractDynamicFieldValues('not an object')).toEqual({});
      expect(extractDynamicFieldValues(123)).toEqual({});
    });

    it('extracts dynamicFields directly from doc.attrs.dynamicFields', () => {
      const doc = {
        type: 'doc',
        attrs: {
          dynamicFields: {
            moscowRating: 'Should',
            releaseNotesIncluded: true,
          },
        },
        content: [],
      };
      expect(extractDynamicFieldValues(doc)).toEqual({
        moscowRating: 'Should',
        releaseNotesIncluded: true,
      });
    });

    it('falls back to searching doc.content text nodes when attrs.dynamicFields is absent', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '[Dynamic Fields]\nseverity: Blocker',
              },
            ],
          },
        ],
      };
      expect(extractDynamicFieldValues(doc)).toEqual({
        severity: 'Blocker',
      });
    });
  });

  describe('patchWorkItemDynamicFields', () => {
    it('creates new doc structure if currentDescription is null or empty', () => {
      const result = patchWorkItemDynamicFields(null, 'moscowRating', 'Could');
      expect(result).toEqual({
        type: 'doc',
        attrs: {
          dynamicFields: {
            moscowRating: 'Could',
          },
        },
        content: [],
      });
    });

    it('adds new field to existing doc without mutating existing fields or attributes', () => {
      const initialDoc = {
        type: 'doc',
        attrs: {
          someOtherAttr: 'preserved',
          dynamicFields: {
            moscowRating: 'Must',
          },
        },
        content: [{ type: 'paragraph' }],
      };

      const result = patchWorkItemDynamicFields(
        initialDoc,
        'businessValue',
        85
      );

      expect(result).toEqual({
        type: 'doc',
        attrs: {
          someOtherAttr: 'preserved',
          dynamicFields: {
            moscowRating: 'Must',
            businessValue: 85,
          },
        },
        content: [{ type: 'paragraph' }],
      });
      // Verify immutability
      expect(initialDoc.attrs.dynamicFields).not.toHaveProperty(
        'businessValue'
      );
    });

    it('deletes field from dynamicFields when value is null, undefined, or empty string', () => {
      const docWithField = {
        type: 'doc',
        attrs: {
          dynamicFields: {
            moscowRating: 'Must',
            acceptanceCriteria: 'Criteria text',
            businessValue: 50,
          },
        },
      };

      // Set to null
      const resNull = patchWorkItemDynamicFields(
        docWithField,
        'moscowRating',
        null
      );
      expect((resNull.attrs as Record<string, unknown>).dynamicFields).toEqual({
        acceptanceCriteria: 'Criteria text',
        businessValue: 50,
      });

      // Set to undefined
      const resUndef = patchWorkItemDynamicFields(
        docWithField,
        'acceptanceCriteria',
        undefined
      );
      expect((resUndef.attrs as Record<string, unknown>).dynamicFields).toEqual(
        {
          moscowRating: 'Must',
          businessValue: 50,
        }
      );

      // Set to empty string
      const resEmpty = patchWorkItemDynamicFields(
        docWithField,
        'businessValue',
        ''
      );
      expect((resEmpty.attrs as Record<string, unknown>).dynamicFields).toEqual(
        {
          moscowRating: 'Must',
          acceptanceCriteria: 'Criteria text',
        }
      );
    });
  });

  describe('findWorkItemsWithFieldValues', () => {
    it('finds work items containing configured values for the given field key', () => {
      const workItems = [
        {
          id: 'item-1',
          title: 'Implement OAuth',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                moscowRating: 'Must',
              },
            },
          },
        },
        {
          id: 'item-2',
          title: 'Refactor DB Queries',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                moscowRating: 'Should',
                businessValue: 80,
              },
            },
          },
        },
        {
          id: 'item-3',
          title: 'Update Documentation',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                businessValue: 30,
              },
            },
          },
        },
        {
          id: 'item-4',
          title: 'Unconfigured Item',
          description: null,
        },
      ];

      const moscowMatches = findWorkItemsWithFieldValues(
        workItems,
        'moscowRating'
      );
      expect(moscowMatches).toEqual([
        { id: 'item-1', title: 'Implement OAuth', value: 'Must' },
        { id: 'item-2', title: 'Refactor DB Queries', value: 'Should' },
      ]);

      const bvMatches = findWorkItemsWithFieldValues(
        workItems,
        'businessValue'
      );
      expect(bvMatches).toEqual([
        { id: 'item-2', title: 'Refactor DB Queries', value: '80' },
        { id: 'item-3', title: 'Update Documentation', value: '30' },
      ]);
    });

    it('falls back to generated title when item title is missing or empty', () => {
      const items = [
        {
          id: '12345678-abcd-ef00-1234-567890abcdef',
          title: '',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                moscowRating: 'Could',
              },
            },
          },
        },
      ];

      const matches = findWorkItemsWithFieldValues(items, 'moscowRating');
      expect(matches).toEqual([
        {
          id: '12345678-abcd-ef00-1234-567890abcdef',
          title: 'Work Item #12345678',
          value: 'Could',
        },
      ]);
    });

    it('properly stringifies object values in matches', () => {
      const items = [
        {
          id: 'item-complex',
          title: 'Complex Item',
          description: {
            type: 'doc',
            attrs: {
              dynamicFields: {
                customObject: { score: 10 },
              },
            },
          },
        },
      ];

      const matches = findWorkItemsWithFieldValues(items, 'customObject');
      expect(matches).toEqual([
        {
          id: 'item-complex',
          title: 'Complex Item',
          value: JSON.stringify({ score: 10 }),
        },
      ]);
    });
  });
});
