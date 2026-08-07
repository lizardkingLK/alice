export const systemInstruction = `You are Jira Teams Assistant, an AI assistant built into the Jira Teams monorepo.
Your main task is to guide the user in creating work items (tasks, stories, bugs) on a project and sprint, assigning them to relevant users.

When a user says they want to create a work item, follow this protocol:
1. First check if the project exists in the workspace:
   - Call \`list_projects\` to see the list of active projects.
   - If the user has specified a project (by name or key), check if it exists in that list.
   - IMPORTANT: If the project does not exist, or if the user's project is not found, you MUST ask the user: "Does this project exist? Or should I create a new one?"
   - If they ask to create it, call \`create_project\` with a name and uppercase key (2-10 letters).
2. Once the project is resolved (you have its UUID):
   - Check if the sprint is specified. If a sprint name is mentioned, check if it exists by calling \`list_sprints\` for that project.
   - If the sprint does not exist, ask the user if they want to create it or proceed without it (putting the work item in the backlog). If they want to create a sprint, call \`create_sprint\`.
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
   Call \`create_work_item\` to create the work item.
5. Provide a summary of the created item and its details.

Keep your responses friendly, helpful, and concise. Always confirm with the user before performing actions, but proactively call tools when appropriate.
`;

export const geminiTools = [
  {
    functionDeclarations: [
      {
        name: 'list_projects',
        description: 'Retrieve all active projects in the system. Use this to see if a project exists.',
      },
      {
        name: 'create_project',
        description: 'Create a new project in the system.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the project.' },
            key: { type: 'STRING', description: 'Short unique capitalized key (2-10 letters).' },
            description: { type: 'STRING', description: 'Description of the project (optional).' },
          },
          required: ['name', 'key'],
        },
      },
      {
        name: 'list_sprints',
        description: 'Retrieve all sprints for a specific project.',
        parameters: {
          type: 'OBJECT',
          properties: {
            projectId: { type: 'STRING', description: 'UUID of the project.' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'create_sprint',
        description: 'Create a new sprint for a specific project.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the sprint.' },
            projectId: { type: 'STRING', description: 'UUID of the project.' },
            startDate: { type: 'STRING', description: 'Start date YYYY-MM-DD (optional).' },
            endDate: { type: 'STRING', description: 'End date YYYY-MM-DD (optional).' },
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
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: 'Title of the work item.' },
            projectId: { type: 'STRING', description: 'UUID of the project.' },
            sprintId: { type: 'STRING', description: 'UUID of the sprint (optional).' },
            assigneeId: { type: 'STRING', description: 'UUID of the user assigned (optional).' },
            type: { type: 'STRING', enum: ['story', 'task', 'bug'], description: 'Type of work item.' },
            priority: { type: 'STRING', enum: ['low', 'medium', 'high', 'highest'], description: 'Priority level.' },
            description: { type: 'STRING', description: 'Description of the work item (optional).' },
          },
          required: ['title', 'projectId', 'type', 'priority'],
        },
      },
    ],
  },
];

