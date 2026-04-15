import React, { useState } from 'react';
import Input from './Input';
import Select from './Select';
import Checkbox from './Checkbox';
import Radio from './Radio';
import Button from './Button';

/**
 * 表单组件使用示例
 * Form Components Usage Examples
 */

export const FormComponentsExamples: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');

  return (
    <div style={{ padding: '24px', gap: '24px', display: 'flex', flexDirection: 'column' }}>
      {/* Input 示例 */}
      <section>
        <h3>输入框 / Input</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <Input
            placeholder="普通输入框"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <Input
            placeholder="错误状态输入框"
            error
            fullWidth
          />
          <Input
            placeholder="禁用输入框"
            disabled
          />
        </div>
      </section>

      {/* Select 示例 */}
      <section>
        <h3>下拉菜单 / Select</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <Select
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          >
            <option value="">请选择...</option>
            <option value="option1">选项 1</option>
            <option value="option2">选项 2</option>
            <option value="option3">选项 3</option>
          </Select>
          <Select disabled>
            <option value="">禁用下拉菜单</option>
          </Select>
        </div>
      </section>

      {/* Checkbox 示例 */}
      <section>
        <h3>复选框 / Checkbox</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <Checkbox
            label="同意用户协议"
            checked={checkboxChecked}
            onChange={(e) => setCheckboxChecked(e.target.checked)}
          />
          <Checkbox
            label="禁用复选框"
            disabled
          />
          <Checkbox
            label="已选中的复选框"
            checked
          />
        </div>
      </section>

      {/* Radio 示例 */}
      <section>
        <h3>单选框 / Radio</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <Radio
            name="radioGroup"
            label="选项 1"
            value="option1"
            checked={radioValue === 'option1'}
            onChange={(e) => setRadioValue(e.target.value)}
          />
          <Radio
            name="radioGroup"
            label="选项 2"
            value="option2"
            checked={radioValue === 'option2'}
            onChange={(e) => setRadioValue(e.target.value)}
          />
          <Radio
            name="radioGroup"
            label="选项 3"
            value="option3"
            checked={radioValue === 'option3'}
            onChange={(e) => setRadioValue(e.target.value)}
          />
          <Radio
            name="radioGroupDisabled"
            label="禁用单选框"
            disabled
          />
        </div>
      </section>

      {/* 完整表单示例 */}
      <section>
        <h3>完整表单示例 / Complete Form Example</h3>
        <div style={{
          padding: '24px',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          marginTop: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Input
            placeholder="用户名"
            fullWidth
          />
          <Input
            type="password"
            placeholder="密码"
            fullWidth
          />
          <Select
            value=""
            onChange={() => {}}
          >
            <option value="">选择用户类型</option>
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </Select>
          <Checkbox
            label="我同意服务条款和隐私政策"
            checked={checkboxChecked}
            onChange={(e) => setCheckboxChecked(e.target.checked)}
          />
          <Button variant="primary" fullWidth>
            提交表单
          </Button>
        </div>
      </section>
    </div>
  );
};

export default FormComponentsExamples;