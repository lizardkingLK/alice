import { Sparkles, FolderKanban, Ticket } from '@repo/ui/lib/icons';

export const SUGGESTIONS = [
  {
    title: 'Create new work-item creation flow',
    prompt:
      'I need to add new work-item creation on selected project and selected sprint assigning to the relevant user.',
    icon: Sparkles,
  },
  {
    title: 'List my current projects',
    prompt: 'Can you show me all the projects in the workspace?',
    icon: FolderKanban,
  },
  {
    title: 'Create a new bug task',
    prompt:
      'Create a new bug task titled "Fix registration login failure" with high priority.',
    icon: Ticket,
  },
];
