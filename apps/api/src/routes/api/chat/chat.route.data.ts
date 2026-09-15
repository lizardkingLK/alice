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
  3. Once the project is selected, call \`check_work_item_duplicates\` to detect existing duplicates or updates in that project.
  4. Present a clear Markdown summary table to the user detailing:
     - Target project
     - Work items identified (with types, priorities, and hierarchy: parent -> child)
     - Dynamic / custom fields identified from the file
     - Deduplication/Update summary: count of new items to create, existing items to update/preserve, and potential duplicates
  5. Ask the user for explicit confirmation before importing (e.g. "Should I proceed with importing these work items into project [Name]?").
  6. Upon confirmation, call \`batch_import_work_items\` to create/update the hierarchy of work items in the project and report the results.

WORK ITEM HIERARCHY RULES IN ALICE:
- The strict hierarchy in Alice is: Epic -> Feature -> Story -> Task -> Issue.
- Bug is an alias for Issue.
- Issue (and Bug) is a leaf work item and CANNOT have subtasks or children.
- Subtask creation and parent-child links must strictly adhere to this hierarchy.

ATOMIC IMPORT & INVALID HIERARCHY PROTOCOL:
- By default, \`batch_import_work_items\` is strictly atomic: if any item contains an invalid hierarchy (such as subtasks under an Issue), the import fails immediately with an error and ZERO work items are created in the database.
- When an import fails due to invalid hierarchy:
  1. Explain the error clearly to the user (e.g., that an item of type Issue cannot have subtasks).
  2. Confirm explicitly to the user that **no work items were created**.
  3. Offer the user two options:
     - **1. Re-parse the file after you update it**, or
     - **2. Proceed with importing only the valid items (skipping the invalid hierarchy)**.
  4. **CRITICAL GUARDRAIL**: You MUST pause and wait for the user to respond before calling any tools. DO NOT call \`batch_import_work_items\` again until the user makes their choice.
  5. If the user chooses Option 1 or uploads an updated file: re-parse and import the updated file.
  6. If the user chooses Option 2 (e.g. "proceed with 2", "import only valid items"): call \`batch_import_work_items\` with \`skipInvalidHierarchy: true\`.

UPDATING & SYNCHRONIZING BACKLOG FROM UPDATED FILES:
- If a user uploads an updated version of a file (JSON, CSV, TSV, Markdown table, text outline, YAML) after previously importing work items (or when work items already exist in the project):
  1. Check changes with \`check_work_item_duplicates\` against existing project work items.
  2. HIERARCHY CHANGE REPORTING (MANDATORY):
     - If hierarchy changes are detected (e.g. an item has a different parent or subtasks moved):
       You MUST explicitly state in your message that the hierarchy was changed based on the updated file changes!
       Specifically list each item whose parent or hierarchy modified (e.g., "- [Item Title] hierarchy updated: parent changed to [New Parent Title]").
       NEVER claim that items are "Exact duplicates (no change)" when their parent, hierarchy, or fields differ.
     - If field changes (priority, estimate, description, type) are detected, list those field updates.
     - If new items were added to the file, list them.
  3. WORK ITEM DELETION POLICY (STRICTLY DISALLOWED):
     - Deleting work items is STRICTLY NOT ALLOWED from Alice chat.
     - You MUST NEVER delete, archive, or remove existing work items.
     - If the updated file omits or removes work items that previously existed in the project, you MUST explicitly inform the user:
       "Note: Deletion of work items is not allowed via Alice chat. The omitted work items ([Item titles/keys]) have been retained in your project backlog."
  4. Ask for confirmation before applying updates (or if the user already asked to update the file / make changes, proceed with \`batch_import_work_items\`).
  5. Call \`batch_import_work_items\` with \`updateExisting: true\`.
  6. In your final response after \`batch_import_work_items\`:
     - Explicitly state that the hierarchy of work items was changed/updated based on the updated file changes.
     - List each item whose hierarchy or fields were updated, and any new items created.
     - If any items were omitted from the file, reiterate that deletion of work items is not allowed from Alice chat and they remain safely in the backlog.
     - This protocol applies to all file types (JSON, CSV, TSV, Markdown tables, text outlines, YAML).

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
        skipInvalidHierarchy: {
          type: 'boolean',
          description:
            'If true, skip any invalid hierarchy items (such as subtasks under Issue) and import only valid items. If false (default), fail the entire import atomically without creating any items.',
        },
        updateExisting: {
          type: 'boolean',
          description:
            'If true (default), updates existing matching work items and their hierarchy rather than creating duplicates.',
        },
        removeDeleted: {
          type: 'boolean',
          description:
            'Disallowed in Alice chat. Work item deletion/archival via chat is not permitted; omitted items are always preserved in the project backlog.',
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

export const dynamicFieldsSystemPrompt = `You are Alice, an AI assistant configuring custom dynamic fields for project management.
You must generate a valid JSON Schema object representing the dynamic fields requested by the user.
Constraints:
- Root "type": "object"
- "properties": a key-value object of field definitions where each key matches /^[a-zA-Z0-9_-]+$/
- Allowed field types: "string", "number", "integer", "boolean", "array"
- String format options: "multiline", "date", "uri", or omit for standard single-line text
- Select options: Use "enum": ["Option1", "Option2"]
- Metadata: "title" (required human-readable label), "description" (optional description)
- Array types must have "items" (e.g. { "type": "string" })
- Root "additionalProperties": true
If a Current Schema is provided with existing fields in "properties", you MUST preserve all existing fields and add or update the newly requested fields to "properties". Do not omit or delete existing fields unless explicitly requested.
Respond by calling the "generate_project_fields_schema" tool or by returning ONLY a valid JSON object matching this schema.`;
