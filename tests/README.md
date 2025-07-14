# Firewalla MSP MCP Server Tests - v1.2.0

## Overview

The Firewalla MSP MCP Server test suite has been completely reorganized and modernized for v1.2.0. Tests now use the Vitest framework and are properly structured for maintainability and CI/CD integration.

## Test Structure

```
src/__tests__/
├── formatting.test.ts      ✅ Tests v1.2.0 enhanced XML formatting
├── server.test.ts          ✅ Basic server and environment tests
├── mcp-integration.test.ts ✅ MCP protocol integration tests
├── endpoints/
│   ├── alarms.test.ts      ✅ Comprehensive alarm endpoint tests
│   ├── devices.test.ts     🚧 Device endpoint tests
│   ├── flows.test.ts       🚧 Flow endpoint tests
│   ├── rules.test.ts       🚧 Rules CRUD tests
│   ├── boxes.test.ts       🚧 Box management tests
│   ├── target-lists.test.ts 🚧 Target list tests
│   └── statistics.test.ts  🚧 Statistics & trends tests
├── search/
│   ├── qualifiers.test.ts  ✅ Search qualifier tests
│   ├── syntax.test.ts      🚧 Advanced syntax tests
│   ├── pagination.test.ts  🚧 Pagination tests
│   └── edge-cases.test.ts  🚧 Error & edge case tests
└── utils/
    └── test-helpers.ts     ✅ Shared test utilities and mock data
```

## Running Tests

### All Tests
```bash
npm test
```

### Test UI (Interactive Browser)
```bash
npm run test:ui
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test Categories
```bash
# Run endpoint tests only
npm run test:endpoints

# Run search tests only
npm run test:search

# Run formatting tests only
npm run test:formatting
```

### Watch Mode
```bash
npm test -- --watch
```

## Key Features for v1.2.0

### 1. Enhanced XML Response Testing

All tests validate the new enhanced XML response format:

```xml
<firewalla_response>
  <metadata>
    <response_type>endpoint_name</response_type>
    <timestamp>ISO_8601_timestamp</timestamp>
  </metadata>
  <presentation>
    <artifact_content type="markdown" title="Dynamic Title">
      # Formatted Markdown Content
      Ready for Claude's artifact editor
    </artifact_content>
  </presentation>
  <summary>Brief one-line summary</summary>
  <data>
    <!-- Raw API data preserved for backward compatibility -->
  </data>
</firewalla_response>
```

### 2. Test Categories

#### Formatting Tests (`formatting.test.ts`)
- Validates XML structure
- Tests markdown generation
- Verifies dynamic titles
- Ensures backward compatibility
- Tests all formatters

#### Endpoint Tests
- CRUD operations
- Response validation
- Error handling
- Pagination support
- Enhanced formatting

#### Search Tests
- Qualifier support
- Advanced syntax
- Wildcard matching
- Range queries
- Complex combinations

### 3. Mock Data

Comprehensive mock data in `test-helpers.ts`:
- Boxes with groups
- Devices with types
- Alarms with severity
- Rules with actions
- Flows with traffic data
- Target lists
- Statistics
- Trends

## Test Development

### Adding New Tests

1. **For a new endpoint:**
```typescript
// src/__tests__/endpoints/new-endpoint.test.ts
import { describe, it, expect } from 'vitest';
import { mockData } from '../utils/test-helpers';

describe('New Endpoint', () => {
  it('should test endpoint functionality', async () => {
    // Your test here
  });
});
```

2. **For new search functionality:**
```typescript
// src/__tests__/search/new-search-feature.test.ts
describe('New Search Feature', () => {
  it('should support new qualifier', async () => {
    // Test implementation
  });
});
```

### Test Utilities

Use the provided helpers:

```typescript
import { 
  parseEnhancedResponse,
  validateEnhancedFormat,
  extractMarkdownContent,
  createMockEnhancedResponse,
  mockData,
  mockErrors
} from '../utils/test-helpers';

// Parse XML response
const parsed = await parseEnhancedResponse(xmlResponse);

// Validate v1.2.0 format
expect(validateEnhancedFormat(xmlResponse)).toBe(true);

// Extract markdown
const markdown = await extractMarkdownContent(xmlResponse);
```

## CI/CD Integration

Tests are designed to run in GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - run: npm run test:coverage
```

## Migration Status

### ✅ Completed
- Test structure setup
- Formatting tests for v1.2.0
- Alarm endpoint tests
- Search qualifier tests
- Test utilities and helpers
- Package.json scripts

### 🚧 In Progress
- Remaining endpoint tests
- Advanced search syntax tests
- Pagination tests
- Edge case tests

### 📋 To Do
- Remove old test files after migration
- Add performance benchmarks
- Add integration test suite
- Document test patterns

## Best Practices

1. **Use TypeScript** - All tests are in TypeScript for type safety
2. **Mock API Calls** - Use MSW for consistent API mocking
3. **Test Enhanced Format** - Always validate v1.2.0 XML structure
4. **Shared Test Data** - Use mockData from test-helpers
5. **Descriptive Names** - Clear test descriptions
6. **Isolated Tests** - Each test should be independent

## Troubleshooting

### Common Issues

1. **Environment Variables**
   - Tests set mock env vars automatically
   - No need for .env file in tests

2. **XML Parsing Errors**
   - Use parseEnhancedResponse helper
   - Check for proper XML escaping

3. **Mock Server Issues**
   - Ensure beforeAll/afterAll hooks
   - Check mock server handlers

4. **Type Errors**
   - Run `npm run build` first
   - Check TypeScript version

## Contributing

When adding tests:
1. Follow existing patterns
2. Add to appropriate category
3. Update mock data if needed
4. Ensure tests pass locally
5. Check coverage report

## Support

For test-related issues:
1. Check this README
2. Review test examples
3. Run with `--reporter=verbose`
4. Check GitHub Issues