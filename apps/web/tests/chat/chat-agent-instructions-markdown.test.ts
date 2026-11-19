import { describe, expect, it } from 'vitest';
import {
  instructionsDocToMarkdown,
  markdownToInstructionsDoc,
} from '@/app/chat/_helpers/chat-agent-instructions-markdown';

describe('chat-agent-instructions-markdown', () => {
  it('round-trips headings, lists, and inline marks', () => {
    const source = [
      '# Role',
      '',
      'You are **Alice**. Stay *focused*.',
      '',
      '- List projects',
      '- Create sprints',
      '',
      '1. Confirm scope',
      '2. Call tools',
      '',
      'Use `list_projects` when unsure.',
    ].join('\n');

    const doc = markdownToInstructionsDoc(source);
    const markdown = instructionsDocToMarkdown(doc);

    expect(markdown).toContain('# Role');
    expect(markdown).toContain('**Alice**');
    expect(markdown).toContain('*focused*');
    expect(markdown).toContain('- List projects');
    expect(markdown).toContain('1. Confirm scope');
    expect(markdown).toContain('`list_projects`');
  });

  it('preserves plain multi-line prompts as paragraphs with hard breaks', () => {
    const source = 'Line one\nLine two\n\nNext block';
    const doc = markdownToInstructionsDoc(source);
    expect(doc.content).toHaveLength(2);
    expect(instructionsDocToMarkdown(doc)).toContain('Line one');
    expect(instructionsDocToMarkdown(doc)).toContain('Line two');
    expect(instructionsDocToMarkdown(doc)).toContain('Next block');
  });
});
