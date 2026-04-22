export type SubtitleIssueType = 'typo' | 'grammar' | 'term'

export interface SubtitleAnalysisIssue {
  index: number
  type: SubtitleIssueType
  text?: string
  suggestion?: string
  original_text?: string
  corrected_text?: string
  reason?: string
  confidence?: number
}

export function getIssueOriginalText(issue: SubtitleAnalysisIssue): string {
  return issue.text || issue.original_text || ''
}

export function getIssueCorrectedText(issue: SubtitleAnalysisIssue): string {
  return issue.suggestion || issue.corrected_text || ''
}

export function normalizeAnalysisIssue(issue: SubtitleAnalysisIssue): SubtitleAnalysisIssue {
  const originalText = getIssueOriginalText(issue)
  const correctedText = getIssueCorrectedText(issue)
  return {
    ...issue,
    type: issue.type || 'typo',
    text: originalText,
    suggestion: correctedText,
    original_text: issue.original_text || originalText,
    corrected_text: issue.corrected_text || correctedText,
    reason: issue.reason || '',
    confidence: typeof issue.confidence === 'number' ? issue.confidence : 0,
  }
}

export function normalizeAnalysisIssues(issues: SubtitleAnalysisIssue[]): SubtitleAnalysisIssue[] {
  return issues.map(normalizeAnalysisIssue)
}

export function formatAnalysisStageSummary(
  stage: string,
  status: string,
  data?: Record<string, any>
): string {
  const parts = [`stage=${stage}`, `status=${status}`]
  if (data?.task_id) parts.push(`task=${String(data.task_id).slice(0, 8)}`)
  if (data?.title) parts.push(`title=${data.title}`)
  if (data?.showtitle) parts.push(`showtitle=${data.showtitle}`)
  if (data?.studio) parts.push(`studio=${data.studio}`)
  if (data?.runtime) parts.push(`runtime=${data.runtime}`)
  if (data?.total_batches !== undefined) parts.push(`batches=${data.total_batches}`)
  if (data?.batch_index !== undefined) parts.push(`batch=${data.batch_index}`)
  if (data?.phase) parts.push(`phase=${data.phase}`)
  if (data?.parsed_batches !== undefined) parts.push(`parsed=${data.parsed_batches}`)
  if (data?.covered_blocks !== undefined) parts.push(`covered=${data.covered_blocks}`)
  if (data?.total_blocks !== undefined) parts.push(`blocks=${data.total_blocks}`)
  if (data?.overview) parts.push(`overview=${data.overview}`)
  if (data?.issues) parts.push(`issues=${Array.isArray(data.issues) ? data.issues.length : 0}`)
  if (data?.error) parts.push(`error=${data.error}`)
  return parts.join(' | ')
}
