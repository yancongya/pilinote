import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MindMapTab } from '../MindMapTab'

vi.mock('../../../../components/Toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

describe('MindMapTab', () => {
  it('shows empty state when there is no structural markdown', () => {
    render(<MindMapTab content="Only a paragraph" title="Demo Note" />)

    expect(screen.getByText('暂无可展示的导图内容')).toBeTruthy()
  })
})
