import { describe, expect, it } from 'vitest';
import {
  getIssueCorrectedText,
  getIssueOriginalText,
  normalizeAnalysisIssue,
  normalizeAnalysisIssues,
} from '../components/ai/subtitleCorrection';

describe('subtitleCorrection helpers', () => {
  it('normalizes old and new issue shapes', () => {
    const issue = normalizeAnalysisIssue({
      index: 7,
      type: 'typo',
      original_text: '我门',
      corrected_text: '我们',
      reason: '错别字',
      confidence: 0.95,
    });

    expect(getIssueOriginalText(issue)).toBe('我门');
    expect(getIssueCorrectedText(issue)).toBe('我们');
  });

  it('keeps legacy fields compatible', () => {
    const issues = normalizeAnalysisIssues([
      {
        index: 8,
        type: 'grammar',
        text: '这个句子 不通顺',
        suggestion: '这个句子不通顺',
      },
    ]);

    expect(issues[0].text).toBe('这个句子 不通顺');
    expect(issues[0].suggestion).toBe('这个句子不通顺');
  });
});
