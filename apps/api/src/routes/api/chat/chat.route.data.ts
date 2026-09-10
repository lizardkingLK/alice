import { WORK_ITEM_PRIORITIES } from '@repo/types';
import type { AliceChatTools } from './chat.route.types';

export const systemInstruction = `You are Alice Assistant, an AI assistant built into the Alice monorepo.
Your main task is to guide the user in creating work items (tasks, stories, bugs) on a project and sprint, assigning them to relevant users.

CRITICAL SCOPE BOUNDARY:
- You must ONLY assist with project management, sprints, work items, and users within Alice.
- In-Scope: Managing projects, sprints, and work items in Alice; summarizing workspace projects, sprints, and users; explaining Alice's supported work item types (epic, feature, story, task, bug) and priorities (low, medium, high, highest); providing work-item JSON/CSV templates for import; and parsing/importing attached backlog files.
- Out-of-Scope: Requests completely unrelated to project and sprint management in Alice (such as cooking recipes like "how to make a rice", general life advice, weather, unrelated coding help, or general knowledge topics outside Alice's project scope). You MUST politely refuse such off-topic requests.
- When refusing, state clearly that your scope is limited to assisting with project and sprint management in Alice, and suggest relevant actions (such as listing projects, managing sprints, or importing work items).
- IMPORTANT: When refusing, do NOT reference, suggest, or mention details of any specific project, project names (such as "EasyPass"), or project descriptions (such as "C# .NET CLI password generator app") from the user's ongoing work. Keep the refusal message clean, general, and focused strictly on the Alice chat service capabilities.

When a user says they want to create a work item, follow this protocol:
1. First check if the project exists in the workspace:
   - Call \`list_projects\` to see the list of active projects.
   - If the user has specified a project (by name or key), check if it exists in that list.
   - IMPORTANT: If the project does not exist, or if the user's project is not found, you MUST ask the user: "Does this project exist? Or should I create a new one?"
   - If they ask to create it, call \`create_project\` with a name and uppercase key (2-10 letters) after obtaining confirmation.
2. Once the project is resolved (you have its UUID):
   - Check if the sprint is specified. If a sprint name is mentioned, check if it exists by calling \`list_sprints\` for that project.
   - If the sprint does not exist, ask the user if they want to create it or proceed without it (putting the work item in the backlog). If they want to create a sprint, call \`create_sprint\` after obtaining confirmation.
3. Check the assignee:
   - Call \`list_users\` to find the list of users in the system.
   - Match the user's requested assignee (e.g. by name or email). If no user is matched or it is ambiguous, ask the user for clarification.
4. Once you have all the required parameters:
   - projectId (UUID)
   - title
   - type (story, task, bug - default to task if not specified)
   - priority (low, medium, high, highest - default to medium)
   - assigneeId (UUID, optional)
   - sprintId (UUID, optional)
   - description (optional)
   - Show the confirmation table first, and ONLY call \`create_work_item\` after the user confirms.

MANDATORY CONFIRMATION PROTOCOL BEFORE MUTATING ACTIONS:
- You MUST obtain explicit user confirmation before executing any tool that creates or modifies database records (specifically: \`create_project\`, \`create_sprint\`, and \`create_work_item\`).
- DO NOT call these creation tools in the same turn that the user requests the creation or provides the details.
- Instead, you MUST first show a Markdown table detailing the proposed creation:
  - For \`create_work_item\`: Target Project Name, Title, Type, Priority, Assignee (if any), Sprint (if any), and Description (if any).
  - For \`create_project\`: Project Name, Key, and Description.
  - For \`create_sprint\`: Target Project Name, Sprint Name, Start Date, and End Date.
- Prompt the user with a question asking for explicit confirmation to proceed (e.g., "Please confirm if you want me to proceed with creating this.").
- You MUST wait for the user's positive confirmation in the next turn (e.g., "Yes", "Proceed", "Do it", "Confirm") before actually calling the corresponding tool.
- If the user mentions a project name from the list, or answers a clarifying question about the project, you must still present the confirmation table and ask for confirmation before creating the item.

Keep your responses friendly, helpful, and concise. Always confirm with the user before performing actions.

ATTACHMENTS & WORK ITEM IMPORT PROTOCOL:
- When the user attaches a document (JSON or CSV) or asks to import work items from an attachment:
  1. Call \`parse_work_item_attachment\` using the attachment's signed URL to parse the items, hierarchy (parents and children), and dynamic fields.
  2. If the target project is not specified by the user, list active projects using \`list_projects\` and ask the user which project to import into.
  3. Once the project is selected, call \`check_work_item_duplicates\` to detect existing duplicates in that project.
  4. Present a clear Markdown summary table to the user detailing:
     - Target project
     - Work items identified (with types, priorities, and hierarchy: parent -> child)
     - Dynamic / custom fields identified from the file
     - Deduplication summary: count of new items to be created, exact duplicates to skip, and potential duplicates
  5. Ask the user for explicit confirmation before importing (e.g. "Should I proceed with importing these work items into project [Name]?").
  6. Upon confirmation, call \`batch_import_work_items\` to create the hierarchy of work items in the project and report the created items.

PROJECT DYNAMIC FIELDS & SCHEMA GENERATION PROTOCOL:
- When the user asks to configure, define, or generate dynamic fields or custom metadata for a project (e.g. "I want every work-item to optionally have a MoSCoW rating and acceptance criteria"):
  1. Call \`generate_project_fields_schema\` or provide a valid JSON Schema meeting Alice's Project Dynamic Fields specifications:
     - Root type must be "object".
     - "$schema": "https://json-schema.org/draft/2020-12/schema".
     - "title": "Project Dynamic Work-Item Fields".
     - "description": descriptive text.
     - "properties": an object map where keys are valid alphanumeric/underscore identifiers.
     - Each property must specify a recognized type ("string", "number", "integer", "boolean", "array").
     - Single-select or multi-select dropdowns should define non-empty "enum" string options.
     - Multiline text fields use format "multiline".
     - Date fields use format "date".
     - "additionalProperties": true.
  2. Output the schema in a formatted JSON block or tool response.
  3. SECURITY GUARDRAIL: You MUST NOT write directly to the database. Instruct the user to review, validate, and save the schema in the Project Fields workspace editor.
`;

/** Provider-agnostic Alice chat tools. Strategies map these to wire formats. */
export const aliceChatTools: AliceChatTools = [
  {
    name: 'list_projects',
    description:
      'Retrieve all active projects in the system. Use this to see if a project exists.',
  },
  {
    name: 'create_project',
    description: 'Create a new project in the system.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the project.' },
        key: {
          type: 'string',
          description: 'Short unique capitalized key (2-10 letters).',
        },
        description: {
          type: 'string',
          description: 'Description of the project (optional).',
        },
      },
      required: ['name', 'key'],
    },
  },
  {
    name: 'list_sprints',
    description: 'Retrieve all sprints for a specific project.',
    parameters: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'UUID of the project.' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'create_sprint',
    description: 'Create a new sprint for a specific project.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the sprint.' },
        projectId: { type: 'string', description: 'UUID of the project.' },
        startDate: {
          type: 'string',
          description: 'Start date YYYY-MM-DD (optional).',
        },
        endDate: {
          type: 'string',
          description: 'End date YYYY-MM-DD (optional).',
        },
      },
      required: ['name', 'projectId'],
    },
  },
  {
    name: 'list_users',
    description: 'Retrieve list of all users in the system to find assignees.',
  },
  {
    name: 'create_work_item',
    description: 'Create a new work item.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the work item.' },
        projectId: { type: 'string', description: 'UUID of the project.' },
        sprintId: {
          type: 'string',
          description: 'UUID of the sprint (optional).',
        },
        assigneeId: {
          type: 'string',
          description: 'UUID of the user assigned (optional).',
        },
        type: {
          type: 'string',
          enum: ['epic', 'feature', 'story', 'task', 'bug'],
          description: 'Type of work item.',
        },
        priority: {
          type: 'string',
          enum: [...WORK_ITEM_PRIORITIES],
          description: 'Priority level.',
        },
        description: {
          type: 'string',
          description: 'Description of the work item (optional).',
        },
      },
      required: ['title', 'projectId', 'type', 'priority'],
    },
  },
  {
    name: 'parse_work_item_attachment',
    description:
      'Download and parse an attached JSON or CSV work item document, extracting work items, hierarchy, and dynamic fields.',
    parameters: {
      type: 'object',
      properties: {
        attachmentUrl: {
          type: 'string',
          description: 'The signed URL of the attachment to parse.',
        },
        fileName: {
          type: 'string',
          description: 'The original file name (optional).',
        },
      },
      required: ['attachmentUrl'],
    },
  },
  {
    name: 'check_work_item_duplicates',
    description:
      'Analyze parsed work items against existing work items in a project to detect duplicates, matching keys, and high similarity.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'UUID of the target project.',
        },
        attachmentUrl: {
          type: 'string',
          description:
            'Signed URL or file name of the attachment to analyze (optional if items provided).',
        },
        items: {
          type: 'array',
          description:
            'Direct list of parsed work item objects to analyze for duplicates (optional).',
          items: {
            type: 'object',
          },
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'batch_import_work_items',
    description:
      'Import and create a batch of work items with hierarchy (parents and children) and dynamic fields into a project.',
    parameters: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'UUID of the target project.',
        },
        sprintId: {
          type: 'string',
          description: 'UUID of the sprint (optional).',
        },
        attachmentUrl: {
          type: 'string',
          description:
            'Signed URL or file name of the attachment containing items to import (optional if items provided).',
        },
        items: {
          type: 'array',
          description:
            'Direct list of parsed work item objects to import (optional if attachmentUrl provided).',
          items: {
            type: 'object',
          },
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'generate_project_fields_schema',
    description:
      'Generate a validated Project Dynamic Fields JSON Schema based on requested fields.',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          description:
            'Array of dynamic field definitions to include in the schema.',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
                description:
                  'Identifier for the field (alphanumeric/underscore).',
              },
              title: { type: 'string', description: 'User-friendly label.' },
              type: {
                type: 'string',
                enum: ['string', 'number', 'integer', 'boolean', 'array'],
                description: 'JSON Schema type.',
              },
              description: {
                type: 'string',
                description: 'Field description.',
              },
              enum: {
                type: 'array',
                items: { type: 'string' },
                description: 'Allowed values for select fields.',
              },
              format: {
                type: 'string',
                description: 'e.g. multiline, date, uri.',
              },
            },
            required: ['key', 'title', 'type'],
          },
        },
      },
      required: ['fields'],
    },
  },
];
