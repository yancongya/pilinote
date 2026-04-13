# Doc & Debug Quick Reference

## Commands

```bash
# Full workflow
$doc-debug "Feature Name"

# Documentation only
$doc-debug --docs-only "Feature Name"

# Test existing docs only
$doc-debug --test-only "Feature Name"

# Auto-fix mode
$doc-debug --auto-fix "Feature Name"

# Custom iterations
$doc-debug --max-iterations 5 "Feature Name"
```

## Workflow Phases

1. **Documentation Generation** → Create comprehensive docs
2. **Test Generation** → Generate Playwright tests
3. **Test Execution** → Run tests and collect results
4. **Code Review** → Analyze docs vs implementation
5. **Debug & Fix** → Iterate until tests pass
6. **Final Report** → Generate comprehensive report

## Output Structure

```
.workflow/doc-debug/{feature}/
├── docs/
├── tests/
├── test-results/
├── iteration-1.md
├── iteration-2.md
└── debug-report.md
```

## Common Fixes

| Issue Type | Example | Fix |
|------------|---------|-----|
| Field Name | `items` → `list` | Update documentation |
| Data Type | `id: string` → `id: int` | Update type definition |
| API Endpoint | `/v1/` → `/v2/` | Update endpoint URL |
| Auth Method | Cookie vs Header | Clarify auth method |
| Routing | Wrong route path | Update route configuration |

## Test Categories

### API Tests
- ✅ Endpoint existence
- ✅ Authentication
- ✅ Response format
- ✅ Data structure
- ✅ Error handling

### UI Tests
- ✅ Page accessibility
- ✅ Component rendering
- ✅ Navigation
- ✅ Authentication states

### Documentation Tests
- ✅ Route configuration
- ✅ API endpoints
- ✅ Data models
- ✅ Auth methods

## Error Patterns

### 404 Not Found
- Check API endpoint URL
- Verify server is running
- Check HTTP method

### 401/403 Unauthorized
- Verify authentication method
- Check cookie/header name
- Validate credentials

### Type Errors
- `expect(received).toBe(string)`
- `typeof` mismatches
- Type coercion issues

### Selector Errors
- `strict mode violation`
- Multiple elements matched
- Element not found

## Success Metrics

- ✅ 100% test pass rate
- ✅ All critical issues fixed
- ✅ Documentation matches implementation
- ✅ Tests validate documentation
- ✅ Report generated

## Requirements

- Node.js 18+
- pnpm
- Python 3.8+
- Playwright
- API server on localhost:8000
- Frontend on localhost:5173 (optional)

## Tips

1. **Start small**: Test single feature first
2. **Use auto-fix**: For quick iteration
3. **Review reports**: Check debug-report.md
4. **Keep logs**: Save iteration logs
5. **Integrate CI/CD**: Automate in pipeline

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Server not running | Start API server |
| Tests timeout | Increase timeout |
| Selectors fail | Use data-testid |
| Max iterations reached | Increase or fix manually |

## Integration

### Pre-commit Hook
```bash
git diff --name-only --cached | grep '^docs/' | while read file; do
  doc-debug --test-only --auto-fix "$file"
done
```

### CI/CD
```yaml
- name: Test Documentation
  run: |
    for changed_doc in $CHANGED_DOCS; do
      doc-debug --test-only --auto-fix "$changed_doc"
    done
```

## Related Skills

- `project-documentation-workflow` - Generate documentation
- `requesting-code-review` - Code review
- `frontend-tester` - Frontend testing

## Documentation

- **Full Guide**: SKILL.md
- **Getting Started**: README.md
- **Execution**: instructions/execution-template.md
- **Config**: schemas/config.json

---

**Quick Reference v1.0** | Last Updated: 2025-04-13