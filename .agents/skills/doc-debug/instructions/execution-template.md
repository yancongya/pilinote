# Doc & Debug Execution Template

## Phase 1: Documentation Generation

### Input
```
Feature: {feature_name}
Description: {feature_description}
```

### Process
1. **Analyze Feature**
   - Locate source files: `apps/api/src/routers/{feature}.py`, `apps/web/src/pages/{feature}/*`
   - Identify API endpoints, components, data models
   - Document user flows and interactions

2. **Generate Documentation**
   ```bash
   Call: project-documentation-workflow skill
   Input: "Generate comprehensive documentation for {feature_name}"
   Output: docs/{feature_name}/
   ```

3. **Documentation Structure**
   ```
   docs/{feature_name}/
   ├── api/{feature_name}-api.md
   ├── components/{feature_name}-component.md
   ├── web/{feature_name}-page.md
   ├── video-sources/{feature_name}.md
   └── components/{feature_name}-data-transformer.md
   ```

### Output
- Generated documentation files
- Documentation summary

---

## Phase 2: Test Generation

### Process
1. **Analyze Documentation**
   - Extract API endpoints from `api/{feature_name}-api.md`
   - Identify UI routes from `web/{feature_name}-page.md`
   - List data models from `components/{feature_name}-data-transformer.md`

2. **Generate Test Suite**
   ```typescript
   test.describe('{Feature Name} API Tests', () => {
     test.describe('API 端点验证', () => {
       test('GET /api/{endpoint} - 端点存在性检查')
       test('GET /api/{endpoint} - 需要认证')
       test('GET /api/{endpoint} - 响应格式验证')
     })
     
     test.describe('文档准确性验证', () => {
       test('验证文档中的 API 端点是否正确')
       test('验证文档中的参数是否被接受')
       test('验证响应包含预期字段')
     })
     
     test.describe('数据结构验证', () => {
       test('验证响应是有效的 JSON')
       test('验证字段类型正确')
       test('验证字段名称正确')
     })
     
     test.describe('错误处理验证', () => {
       test('验证无效参数处理')
       test('验证认证错误处理')
     })
   })
   
   test.describe('{Feature Name} UI Tests', () => {
     test.describe('页面访问', () => {
       test('{feature_name}页面应该可以访问')
     })
     
     test.describe('组件渲染', () => {
       test('{feature_name}页面应该显示登录提示（未登录时）')
       test('{feature_name}导航按钮应该存在')
     })
     
     test.describe('文档验证', () => {
       test('验证文档中的路由配置是否正确')
     })
   })
   ```

### Output
- `tests/{feature_name}.spec.ts`

---

## Phase 3: Initial Test Execution

### Process
1. **Check Server Status**
   ```bash
   # Check API server
   curl http://localhost:8000/api/health
   
   # Check frontend server
   curl http://localhost:5173/
   ```

2. **Run Tests**
   ```bash
   pnpm playwright test tests/{feature_name}.spec.ts
   ```

3. **Collect Results**
   - Parse test output
   - Identify failed tests
   - Capture error messages
   - Take screenshots of failures

### Output
- `test-results/{feature_name}/test-results.txt`
- `test-results/{feature_name}/screenshots/`
- `test-results/{feature_name}/api-responses/`

---

## Phase 4: Code Review & Error Detection

### Process
1. **Call Code Review Skill**
   ```
   Input: "Review {feature_name} documentation and implementation
          Focus on:
          - API endpoint correctness
          - Data type accuracy
          - Field name consistency
          - Authentication flow
          - Routing configuration
          Compare documentation vs actual implementation"
   ```

2. **Analyze Review Output**
   - List all identified issues
   - Categorize by severity
   - Map to test failures

3. **Create Issue List**
   ```json
   {
     "issues": [
       {
         "id": 1,
         "type": "field_name_mismatch",
         "location": "docs/api/{feature_name}-api.md:50",
         "description": "Field name mismatch: 'items' vs 'list'",
         "severity": "critical",
         "testImpact": 3
       },
       {
         "id": 2,
         "type": "data_type_mismatch",
         "location": "docs/components/{feature_name}-data-transformer.md:100",
         "description": "Data type mismatch: id: string vs int",
         "severity": "critical",
         "testImpact": 2
       }
     ]
   }
   ```

### Output
- `review-report.md`
- `issues.json`

---

## Phase 5: Debug & Fix

### Iteration Process

For each iteration (1 to max-iterations):

#### Step 1: Error Analysis

```bash
# Get actual API response
curl -X GET "http://localhost:8000/api/{endpoint}" | jq '.'

# Compare with documented structure
# Documented: { data: { items: [...] } }
# Actual: { data: { list: [...] } }
```

#### Step 2: Apply Fixes

**Field Name Fix:**
```diff
- "data": {
-   "items": [...]
- }
+ "data": {
+   "list": [...]
+ }
```

**Data Type Fix:**
```diff
- id: str  # bvid
+ id: int  # aid
```

**API Endpoint Fix:**
```diff
- **端点**: /x/v2/history/toview/web
+ **端点**: /x/v2/history/toview
```

**Authentication Fix:**
```diff
- **认证方式**: Cookie 或查询参数
+ **认证方式**: 仅支持 Cookie
```

#### Step 3: Re-test

```bash
pnpm playwright test tests/{feature_name}.spec.ts
```

#### Step 4: Check Results

- All tests pass? → Exit loop
- Still failing? → Continue to next iteration

### Output
- Updated documentation files
- Updated test files (if needed)
- `iteration-{N}.md`
- Current test results

---

## Phase 6: Final Report

### Generate Report

```markdown
# {Feature Name} Documentation & Debug Report

## Summary
- Feature: {feature_name}
- Date: {timestamp}
- Initial test pass rate: X/Y (Z%)
- Final test pass rate: X/Y (100%)
- Iterations: N
- Total time: T minutes

## Initial Issues
### Issue 1: [Title]
- **Type**: Field name mismatch
- **Location**: docs/api/{feature_name}-api.md:50
- **Description**: ...
- **Test Impact**: Caused 3 test failures
- **Severity**: Critical

## Corrections Made
### File: docs/api/{feature_name}-api.md
- Line 50: Changed "items" to "list"
- Line 100: Updated field type from string to number
- Line 200: Corrected API endpoint URL

### File: docs/components/{feature_name}-data-transformer.md
- Line 30: Updated CardData.id type definition
- Line 80: Fixed field mapping table

## Test Results
### Before Fixes
- API Tests: 8/12 passed (67%)
- UI Tests: 1/3 passed (33%)
- Total: 9/15 passed (60%)

### After Fixes
- API Tests: 12/12 passed (100%)
- UI Tests: 3/3 passed (100%)
- Total: 15/15 passed (100%)

## Files Modified
- docs/api/{feature_name}-api.md
- docs/components/{feature_name}-data-transformer.md
- docs/video-sources/{feature_name}.md
- tests/{feature_name}.spec.ts

## Recommendations
1. Always test API responses against documentation
2. Use type-safe data models in both backend and docs
3. Automate documentation testing in CI/CD
4. Consider API versioning for breaking changes

## Next Steps
- [ ] Add documentation to automated test suite
- [ ] Set up pre-commit hooks for doc validation
- [ ] Create documentation style guide
```

### Output
- `debug-report.md`
- Final test results
- Summary display

---

## Success Criteria

✅ **Documentation Generated**: All required documentation files created
✅ **Tests Created**: Comprehensive test suite generated
✅ **Tests Pass**: All tests passing (100%)
✅ **Issues Fixed**: All critical and high-priority issues resolved
✅ **Report Generated**: Complete debug report produced
✅ **Files Updated**: Documentation and tests updated to match reality

---

## Example Output

```
══════════════════════════════════════════════════════════════
📊 DOCUMENTATION & DEBUG COMPLETE
══════════════════════════════════════════════════════════════

Feature: Watch Later API and UI

Initial Status: ⚠️  9/15 tests passed (60%)
Final Status:   ✅ 15/15 tests passed (100%)

Iterations: 2
Files Modified: 4

Key Fixes:
• Fixed field name: "items" → "list"
• Corrected data type: id: string → int
• Updated API endpoint: /x/v2/history/toview
• Fixed auth method: only Cookie supported

📄 Report: .workflow/doc-debug/watch-later/debug-report.md
📁 Docs: docs/watch-later/
🧪 Tests: tests/watch-later-api.spec.ts

══════════════════════════════════════════════════════════════
```

---

## Notes

- This workflow should be automated where possible
- Always verify fixes against actual implementation
- Keep iteration logs for audit trail
- Generate reports in machine-readable format for CI/CD
- Store screenshots and API responses as evidence