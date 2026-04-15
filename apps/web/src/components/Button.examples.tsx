import React from 'react';
import Button from './Button';

/**
 * Button组件使用示例
 * Button Component Usage Examples
 */

export const ButtonExamples: React.FC = () => {
  return (
    <div style={{ padding: '24px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
      {/* 按钮类型示例 */}
      <section>
        <h3>按钮类型 / Button Variants</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <Button variant="primary">主要按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="ghost">幽灵按钮</Button>
          <Button variant="danger">危险按钮</Button>
          <Button variant="icon">🎨</Button>
        </div>
      </section>

      {/* 按钮尺寸示例 */}
      <section>
        <h3>按钮尺寸 / Button Sizes</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
          <Button variant="primary" size="sm">小按钮</Button>
          <Button variant="primary" size="md">中按钮</Button>
          <Button variant="primary" size="lg">大按钮</Button>
        </div>
      </section>

      {/* 按钮状态示例 */}
      <section>
        <h3>按钮状态 / Button States</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <Button variant="primary">正常状态</Button>
          <Button variant="primary" disabled>禁用状态</Button>
          <Button variant="primary" loading>加载状态</Button>
        </div>
      </section>

      {/* 图标按钮示例 */}
      <section>
        <h3>图标按钮 / Icon Buttons</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <Button variant="icon" icon="🎨" />
          <Button variant="icon" icon="📁" />
          <Button variant="icon" icon="⚙️" />
          <Button variant="icon" icon="🗑️" />
        </div>
      </section>

      {/* 全宽按钮示例 */}
      <section>
        <h3>全宽按钮 / Full Width Button</h3>
        <div style={{ marginTop: '12px' }}>
          <Button variant="primary" fullWidth>全宽按钮</Button>
        </div>
      </section>

      {/* 组合使用示例 */}
      <section>
        <h3>组合使用 / Combined Usage</h3>
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <Button variant="primary" icon="📥" size="lg">
            开始下载
          </Button>
          <Button variant="secondary" icon="⚙️">
            设置
          </Button>
          <Button variant="ghost" icon="❌">
            取消
          </Button>
        </div>
      </section>
    </div>
  );
};

export default ButtonExamples;