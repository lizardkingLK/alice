import { describe, expect, it } from 'vitest';
import {
  workItemTypeCardToneStyle,
  workItemTypeContrastTextColor,
  workItemTypeRelativeLuminance,
} from '@/app/work-items/_helpers/work-item-type';

describe('work item type contrast text', () => {
  it('darkens light accents for readable card text', () => {
    const accent = '#FDE68A';
    const text = workItemTypeContrastTextColor(accent);
    expect(workItemTypeRelativeLuminance(text)).toBeLessThan(
      workItemTypeRelativeLuminance(accent)
    );
    expect(text).not.toBe(accent);
  });

  it('lightens dark accents for readable card text', () => {
    const accent = '#1E293B';
    const text = workItemTypeContrastTextColor(accent);
    expect(workItemTypeRelativeLuminance(text)).toBeGreaterThan(
      workItemTypeRelativeLuminance(accent)
    );
    expect(text).not.toBe(accent.toUpperCase());
  });

  it('keeps mid-tone accents as the picked color', () => {
    expect(workItemTypeContrastTextColor('#3B6FDB')).toBe('#3B6FDB');
    expect(workItemTypeContrastTextColor('#2F9E6B')).toBe('#2F9E6B');
  });

  it('applies contrast text on catalog card tone styles', () => {
    const tone = workItemTypeCardToneStyle({
      key: 'custom',
      color: '#FEF08A',
    });
    expect(tone.color).toBe(workItemTypeContrastTextColor('#FEF08A'));
    expect(tone.backgroundColor).toContain('rgba(');
    expect(tone.borderColor).toContain('rgba(');
  });
});
