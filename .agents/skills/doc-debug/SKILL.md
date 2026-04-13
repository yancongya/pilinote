---
name: doc-debug
description: Comprehensive documentation generation and debugging workflow. Integrates documentation creation, testing with Playwright, error detection, and automatic documentation correction in a single unified process.
argument-hint: "[--docs-only] [--test-only] [--auto-fix] [--max-iterations N] \"feature/module name or description\""
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, task, run_shell_command, replace, web_search, web_fetch, browser_navigate, browser_snapshot, browser_take_screenshot
---

# Documentation & Debug Workflow

## Usage

```bash
$doc-debug "Watch Later API and UI"
$doc-debug --auto-fix "Authentication module"
$doc-debug --test-only "Existing docs for favorites"
$doc-debug --docs-only "New download queue feature"
$doc-debug --max-iterations 3 "Complete video processing system"
```

**Flags**:
- `--docs-only`: Only generate documentation, skip testing phase
- `--test-only`: Only run tests on existing documentation, skip generation
- `--auto-fix`: Automatically fix documentation errors (default: ask for confirmation)
- `--max-iterations N`: Maximum debugging iterations (default: 3)

**Output Directory**: `.workflow/doc-debug/{feature-name}/`
**Core Output**: `docs/` + `tests/` + `debug-report.md` + `corrected-docs/`

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│           DOCUMENTATION & DEBUG WORKFLOW (Unified)                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Documentation Generation (if not --test-only)                │
│     ├─ Analyze feature/module codebase                                  │
│     ├─ Call project-documentation-workflow skill                        │
│     ├─ Generate comprehensive documentation                             │
│     └─ Output: docs/{feature}/*.md                                      │
│                                                                          │
│  Phase 2: Test Generation                                               │
│     ├─ Analyze API endpoints and UI components                          │
│     ├─ Generate Playwright test suite                                   │
│     ├─ Create API tests (endpoints, auth, data structures)              │
│     ├─ Create UI tests (page navigation, components)                    │
│     └─ Output: tests/{feature}.spec.ts                                  │
│                                                                          │
│  Phase 3: Initial Test Execution                                         │
│     ├─ Run generated test suite with Playwright                         │
│     ├─ Collect test results (passed/failed)                             │
│     ├─ Capture screenshots for failed tests                             │
│     └─ Output: test-results/{feature}/                                  │
│                                                                          │
│  Phase 4: Code Review & Error Detection (if failures)                   │
│     ├─ Call requesting-code-review skill                                │
│     ├─ Analyze documentation vs implementation                           │
│     ├─ Identify mismatches (API endpoints, data types, field names)      │
│     └─ Output: review-report.md                                         │
│                                                                          │
│  Phase 5: Debug & Fix (iteration loop, max N)                           │
│     For each iteration up to max-iterations:                             │
│       ├─ Analyze test failures                                           │
│       ├─ Compare actual API responses vs documented structure            │
│       ├─ Identify specific errors:                                       │
│       │   ├─ Wrong endpoint URLs                                         │
│       │   ├─ Incorrect field types (string vs int)                       │
│       │   ├─ Wrong field names (stat vs stats)                           │
│       │   ├─ Missing fields in documentation                             │
│       │   ├─ Authentication method errors                                │
│       │   └─ Routing errors                                              │
│       ├─ Update documentation files                                      │
│       ├─ Update test files if needed                                     │
│       ├─ Re-run tests                                                    │
│       └─ Check: all tests pass? → exit loop                             │
│                                                                          │
│  Phase 6: Final Report                                                  │
│     ├─ Generate debug-report.md with:                                   │
│       ├─ Initial test results (before fixes)                             │
│       ├─ Issues found and corrections made                              │
│       ├─ Final test results (after fixes)                               │
│       ├─ Files modified (docs, tests)                                    │
│       └─ Recommendations for future work                                 │
│     └─ Display summary                                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Supported Skills Integration

This workflow integrates and orchestrates the following skills:

1. **project-documentation-workflow**: Generate comprehensive documentation
2. **requesting-code-review**: Automated code and documentation review
3. **frontend-tester**: Frontend UI testing (optional, for UI-heavy features)

---

## Workflow Phases

### Phase 1: Documentation Generation

**Trigger**: Unless `--test-only` flag is used

**Process**:
1. Analyze the target feature/module:
   - Locate relevant source files (API routes, components, services)
   - Identify key functionality and data flows
   - Document user-facing behavior

2. Call `project-documentation-workflow` skill:
   ```
   Input: "Generate comprehensive documentation for {feature}"
   Output: Complete documentation suite in docs/{feature}/
   ```

3. Documentation structure typically includes:
   - `api/{feature}-api.md`: API endpoints and data models
   - `components/{feature}-component.md`: Component implementation
   - `web/{feature}-page.md`: Frontend page and routing
   - `video-sources/{feature}.md`: Data source integration
   - `components/{feature}-data-transformer.md`: Data transformation

**Output**: 
- Documentation files in `docs/{feature}/`
- Documentation summary

---

### Phase 2: Test Generation

**Process**:
1. Analyze generated documentation:
   - Extract API endpoints from API documentation
   - Identify UI routes and components
   - List data models and expected fields

2. Generate Playwright test suite:
   ```typescript
   test.describe('{Feature} API Tests', () => {
     // API endpoint tests
     test('GET /api/{endpoint} - endpoint exists')
     test('GET /api/{endpoint} - requires authentication')
     test('GET /api/{endpoint} - response format validation')
     
     // Data structure tests
     test('verify response field types')
     test('verify response structure matches documentation')
     
     // Error handling tests
     test('invalid parameter handling')
     test('authentication error handling')
   });
   
   test.describe('{Feature} UI Tests', () => {
     // Page navigation tests
     test('page should be accessible')
     test('navigation button exists')
     
     // Component tests
     test('login prompt (when not authenticated)')
     test('content display (when authenticated)')
     
     // Documentation verification
     test('verify routes match documentation')
   });
   ```

3. Test features:
   - API endpoint existence and accessibility
   - Authentication requirements
   - Response format validation
   - Data structure verification
   - Error handling
   - UI component rendering
   - Route configuration

**Output**:
- `tests/{feature}.spec.ts`: Complete test suite
- Test configuration files if needed

---

### Phase 3: Initial Test Execution

**Process**:
1. Ensure API server is running:
   - Check `http://localhost:8000` (backend)
   - Check `http://localhost:5173` (frontend, if needed)
   - Start servers if not running

2. Execute Playwright tests:
   ```bash
   pnpm playwright test tests/{feature}.spec.ts
   ```

3. Collect test results:
   - Pass/fail status for each test
   - Error messages and stack traces
   - Screenshots of failed tests
   - API response examples

4. Store results:
   - `test-results/{feature}/test-results.txt`: Summary
   - `test-results/{feature}/screenshots/`: Visual evidence
   - `test-results/{feature}/api-responses/`: Actual API responses

**Output**:
- Test results summary
- Detailed failure information (if any)
- Screenshots and logs

---

### Phase 4: Code Review & Error Detection

**Trigger**: If any tests failed in Phase 3

**Process**:
1. Call `requesting-code-review` skill:
   ```
   Input: "Review {feature} documentation and implementation
          Focus on:
          - API endpoint correctness
          - Data type accuracy
          - Field name consistency
          - Authentication flow
          - Routing configuration
          Compare documentation vs actual implementation"
   ```

2. Analyze review output:
   - List all identified issues
   - Categorize issues by severity (critical, medium, low)
   - Map issues to specific files and lines

3. Compare with test failures:
   - Cross-reference review findings with test errors
   - Prioritize issues causing test failures
   - Create fix plan

**Output**:
- `review-report.md`: Detailed review findings
- `issues.json`: Structured issue list with priorities

---

### Phase 5: Debug & Fix (Iteration Loop)

**Trigger**: If issues found and max-iterations not exceeded

**For each iteration** (1 to max-iterations):

#### 5.1 Error Analysis

1. Parse test failures:
   ```typescript
   // Example test failure:
   // Error: expect(received).toHaveProperty(path)
   // Expected path: "items"
   // Received path: []
   ```
   - Extract error type
   - Identify incorrect expectation
   - Determine actual behavior

2. Compare documentation vs reality:
   - **API Response Comparison**:
     ```bash
     # Get actual API response
     curl -X GET "http://localhost:8000/api/endpoint" | jq '.'
     
     # Compare with documented structure
     # Documented: { data: { items: [...] } }
     # Actual: { data: { list: [...] } }
     ```
   
   - **Data Type Comparison**:
     - Documented: `id: string` (bvid)
     - Actual: `id: number` (aid)
   
   - **Field Name Comparison**:
     - Documented: `stat: { view: int, ... }`
     - Actual: `stats: { view: int, ... }`

3. Create issue list:
   ```
   Issue #1: Field name mismatch
   - Location: docs/api/watchlater-api.md, line 50
   - Documented: "items"
   - Actual: "list"
   - Severity: Critical (causes test failure)
   
   Issue #2: Data type mismatch
   - Location: docs/components/toview-data-transformer.md, line 100
   - Documented: id: string
   - Actual: id: number
   - Severity: Critical (causes test failure)
   ```

#### 5.2 Documentation Correction

For each issue:

1. **API Endpoint Errors**:
   ```diff
   - | B站字段 | API 端点 |
   - | /x/v2/history/toview/web | ... |
   + | B站字段 | API 端点 |
   + | /x/v2/history/toview | ... |
   ```

2. **Field Name Errors**:
   ```diff
   - "data": {
   -   "items": [...]
   - }
   + "data": {
   +   "list": [...]
   + }
   ```

3. **Data Type Errors**:
   ```diff
   - id: str  # bvid
   + id: int  # aid (number type)
   ```

4. **Field Mapping Errors**:
   ```diff
   - | bvid | id, bvid | Video ID |
   + | aid | id, aid | Video ID |
   ```

5. **Authentication Method Errors**:
   ```diff
   - **认证方式**: Cookie 或查询参数
   + **认证方式**: 仅支持 Cookie（不支持查询参数）
   ```

#### 5.3 Test Adjustment (if needed)

Sometimes tests need adjustment too:

1. **Timeout adjustments**:
   ```typescript
   - await expect(element).toBeVisible();
   + await expect(element).toBeVisible({ timeout: 5000 });
   ```

2. **Selector precision**:
   ```typescript
   - page.locator('text=/请先登录/i')
   + page.getByRole('tab', { name: '稍后再看' })
   ```

3. **Status code allowances**:
   ```typescript
   - expect([200, 401]).toContain(response.status());
   + expect([200, 401, 404, 422]).toContain(response.status());
   ```

#### 5.4 Re-test

1. Run tests again:
   ```bash
   pnpm playwright test tests/{feature}.spec.ts
   ```

2. Check results:
   - All tests pass? → Exit loop, proceed to Phase 6
   - Still failing? → Continue to next iteration

3. Update issue tracking:
   - Mark fixed issues as resolved
   - Document new issues found
   - Update iteration count

**Stop Conditions**:
- All tests pass
- Max iterations reached
- No new issues found

**Output**:
- Updated documentation files
- Updated test files (if needed)
- Iteration log (`iteration-{N}.md`)
- Current test results

---

### Phase 6: Final Report

**Process**:

1. Generate `debug-report.md`:
   ```markdown
   # {Feature} Documentation & Debug Report
   
   ## Summary
   - Feature: {feature name}
   - Date: {timestamp}
   - Initial test pass rate: X/Y (Z%)
   - Final test pass rate: X/Y (100%)
   - Iterations: N
   - Total time: T minutes
   
   ## Initial Issues
   ### Issue 1: [Title]
   - **Type**: Field name mismatch
   - **Location**: docs/api/{feature}-api.md:50
   - **Description**: ...
   - **Test Impact**: Caused 3 test failures
   - **Severity**: Critical
   
   ## Corrections Made
   ### File: docs/api/{feature}-api.md
   - Line 50: Changed "items" to "list"
   - Line 100: Updated field type from string to number
   - Line 200: Corrected API endpoint URL
   
   ### File: docs/components/{feature}-data-transformer.md
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
   - docs/api/{feature}-api.md
   - docs/components/{feature}-data-transformer.md
   - docs/video-sources/{feature}.md
   - docs/components/favorites-data-transformer.md
   - tests/{feature}.spec.ts
   
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

2. Display summary:
   ```
   ══════════════════════════════════════════════════════════════
   📊 DOCUMENTATION & DEBUG COMPLETE
   ══════════════════════════════════════════════════════════════
   
   Feature: {feature name}
   
   Initial Status: ⚠️  X/Y tests passed (Z%)
   Final Status:   ✅  Y/Y tests passed (100%)
   
   Iterations: N
   Files Modified: M
   
   Key Fixes:
   • Fixed field name: "items" → "list"
   • Corrected data type: id: string → int
   • Updated API endpoint: /x/v2/history/toview
   
   📄 Report: .workflow/doc-debug/{feature}/debug-report.md
   📁 Docs: docs/{feature}/
   🧪 Tests: tests/{feature}.spec.ts
   
   ══════════════════════════════════════════════════════════════
   ```

**Output**:
- `debug-report.md`: Comprehensive debug report
- Final test results
- Summary display

---

## Common Error Patterns

### 1. API Endpoint Errors

**Symptoms**:
- 404 errors in tests
- "Endpoint not found" messages

**Common Causes**:
- Wrong API path (missing or extra segments)
- Using old endpoint version (e.g., `/v1` vs `/v2`)
- Incorrect HTTP method

**Fix**:
```diff
- **端点**: GET /api/watchlater/items
+ **端点**: GET /api/watchlater/list
```

---

### 2. Field Name Errors

**Symptoms**:
- "expect(received).toHaveProperty(path)" errors
- "Cannot read property of undefined"

**Common Causes**:
- Singular vs plural (`stat` vs `stats`)
- British vs American spelling (`favourite` vs `favorite`)
- Typographical errors

**Fix**:
```diff
- "stats": { ... }
- "stat": { ... }
+ "stats": { ... }
```

---

### 3. Data Type Errors

**Symptoms**:
- "expect(received).toBe(string)" errors
- Type coercion issues

**Common Causes**:
- Documentation shows string, API returns number
- Timestamp vs formatted string
- ID types (string bvid vs number aid)

**Fix**:
```diff
- id: str  # bvid
+ id: int  # aid
```

---

### 4. Authentication Errors

**Symptoms**:
- All tests fail with 401
- "Unauthorized" errors even with credentials

**Common Causes**:
- Wrong auth method (Cookie vs query parameter vs header)
- Missing auth dependency in backend
- Cookie name mismatch

**Fix**:
```diff
- **认证方式**: Cookie 或查询参数
+ **认证方式**: 仅支持 Cookie
+ **依赖**: get_current_user_with_sessdata
```

---

### 5. Routing Errors

**Symptoms**:
- UI tests fail with navigation errors
- Page not found errors

**Common Causes**:
- Wrong route path in documentation
- Missing route configuration
- Dynamic parameter errors

**Fix**:
```diff
- **路由**: /watchlater (无路由)
+ **路由**: /watch-later → /video/:bvid
```

---

## Best Practices

### For Documentation

1. **Always verify against actual code**:
   - Read source files before documenting
   - Test API endpoints manually
   - Verify data types with code

2. **Use examples from real responses**:
   ```bash
   # Get actual API response
   curl -X GET "http://localhost:8000/api/endpoint" | jq '.'
   
   # Use this in documentation
   ```

3. **Document authentication clearly**:
   - Specify auth method (Cookie/Header/Token)
   - Show exact cookie/header name
   - Provide working examples

4. **Include both success and error responses**:
   - Document 200 response structure
   - Document error responses (400, 401, 500)
   - List all error codes and meanings

### For Testing

1. **Test at multiple levels**:
   - API endpoint existence
   - Authentication requirements
   - Response structure
   - Data types
   - Error handling
   - UI rendering
   - User interactions

2. **Use specific selectors**:
   ```typescript
   // Bad
   page.locator('text=/请先登录/i')
   
   // Good
   page.getByRole('tab', { name: '稍后再看' })
   ```

3. **Handle both authenticated and unauthenticated states**:
   ```typescript
   const loginPrompt = page.getByText(/请先登录以查看稍后再看/);
   if (await loginPrompt.isVisible().catch(() => false)) {
     await expect(loginPrompt).toBeVisible();
   } else {
     // User is logged in
     const videoList = page.locator('.video-list');
     await expect(videoList).toBeVisible();
   }
   ```

### For Debugging

1. **Start with actual API responses**:
   - Use `curl` to get real data
   - Compare structure with documentation
   - Identify exact differences

2. **Fix documentation first**:
   - Update docs to match implementation
   - Then update tests to match reality
   - Tests verify documentation accuracy

3. **Iterate quickly**:
   - Make one change at a time
   - Re-run tests immediately
   - Verify fix worked before moving on

4. **Document what you fixed**:
   - Keep track of issues found
   - Note what was changed
   - Record reasoning for changes

---

## Example Usage

### Example 1: New Feature Documentation

```bash
$doc-debug "Watch Later API and UI"
```

**Process**:
1. Generates comprehensive docs for watch later feature
2. Creates Playwright test suite
3. Runs tests → finds 7 issues
4. Calls code review → confirms issues
5. Iterates 2 times to fix all issues
6. All 15 tests pass
7. Generates debug report

**Output**:
```
✅ Documentation & Debug Complete

Feature: Watch Later API and UI

Initial: 9/15 tests passed (60%)
Final:   15/15 tests passed (100%)

Iterations: 2
Files Modified: 4

Key Fixes:
• Fixed field name: "items" → "list"
• Corrected data type: id: string → int
• Updated API endpoint: /x/v2/history/toview
• Fixed auth method: only Cookie supported

📄 Report: .workflow/doc-debug/watch-later/debug-report.md
```

---

### Example 2: Existing Documentation Review

```bash
$doc-debug --test-only "Favorites API"
```

**Process**:
1. Skips documentation generation
2. Creates tests based on existing docs
3. Runs tests → finds 3 issues
4. Calls code review → confirms issues
5. Fixes documentation in 1 iteration
6. All tests pass

**Output**:
```
✅ Documentation Review Complete

Feature: Favorites API

Initial: 10/13 tests passed (77%)
Final:   13/13 tests passed (100%)

Iterations: 1
Files Modified: 2

Key Fixes:
• Updated endpoint: /fav/v2/folder/list
• Fixed field type: folder_id: string → int
• Corrected response structure

📄 Report: .workflow/doc-debug/favorites/debug-report.md
```

---

## Integration with CI/CD

This workflow can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/doc-test.yml
name: Documentation Testing

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'apps/api/src/routers/**'

jobs:
  doc-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Start API server
        run: cd apps/api && python main.py &
      
      - name: Test documentation
        run: |
          for changed_doc in ${{ steps.changes.outputs.docs }}; do
            doc-debug --test-only "$changed_doc"
          done
      
      - name: Upload debug reports
        uses: actions/upload-artifact@v2
        with:
          name: debug-reports
          path: .workflow/doc-debug/**/debug-report.md
```

---

## Limitations & Future Enhancements

### Current Limitations

1. **API server must be running**: Requires manual server startup
2. **Database state**: Tests may be affected by database state
3. **Browser-based only**: Currently uses Playwright, may not cover CLI tools
4. **Language-specific**: Primarily designed for JavaScript/TypeScript frontend

### Future Enhancements

1. **Server startup automation**: Automatically start required servers
2. **Database fixtures**: Create test data on demand
3. **Multi-language support**: Extend to Python, Go, etc.
4. **CI/CD integration**: Full automation support
5. **Documentation templates**: Pre-built templates for common patterns
6. **Regression detection**: Track documentation changes over time

---

## Troubleshooting

### Server Not Running

**Error**: `ECONNREFUSED localhost:8000`

**Solution**:
```bash
# Start API server
cd apps/api
source venv/bin/activate
python main.py
```

### Tests Timeout

**Error**: Test exceeds timeout

**Solution**:
- Increase timeout in test:
  ```typescript
  await expect(element).toBeVisible({ timeout: 10000 });
  ```
- Check if page is actually loading
- Verify network connectivity

### Selector Issues

**Error**: `strict mode violation`

**Solution**:
- Use more specific selectors
- Add test ID to elements:
  ```html
  <button data-testid="watch-later-nav">稍后再看</button>
  ```
  ```typescript
  page.getByTestId('watch-later-nav')
  ```

### Max Iterations Exceeded

**Error**: Some tests still failing after max iterations

**Solution**:
- Increase max-iterations:
  ```bash
  doc-debug --max-iterations 5 "Feature"
  ```
- Review debug report manually
- Check for implementation bugs (not just documentation errors)

---

## References

- [Playwright Documentation](https://playwright.dev/)
- [project-documentation-workflow Skill](./project-documentation-workflow/SKILL.md)
- [requesting-code-review Skill](./requesting-code-review/SKILL.md)
- [frontend-tester Skill](./frontend-tester/SKILL.md)

---

**Version**: 1.0.0  
**Last Updated**: 2025-04-13  
**Maintained by**: PiliNote Development Team