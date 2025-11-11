# Web Tests

This directory contains tests for the Track App web dashboard.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Test Structure

```
__tests__/
├── utils/              # Utility function tests
│   └── formatters.test.ts
├── api/                # API route tests (integration)
│   └── import-session.test.md
└── README.md
```

## What's Tested

### Utility Functions (utils/)
- ✅ `formatLapTime` - Lap time formatting
- ✅ `formatDuration` - Duration formatting
- ✅ `formatDelta` - Delta formatting
- ✅ `calculateDelta` - Delta calculation
- ✅ `formatTrackLength` - Track length conversion

### API Routes (api/)
- 📝 Manual testing guide for import-session endpoint
- 📝 Manual testing guide for add-note endpoint

## Testing Strategy

**MVP Approach:**
- Unit tests for critical utility functions
- Manual testing for API routes
- Rely on TypeScript for type safety

**Post-MVP:**
- Integration tests for API routes with test database
- E2E tests with Playwright or Cypress
- Visual regression tests
- Performance tests

## Manual API Testing

See `api/import-session.test.md` for curl commands to manually test API endpoints.

## Coverage Goals

- **MVP**: >80% coverage on utility functions
- **Post-MVP**: >80% coverage on all code

## CI/CD Integration

Add to GitHub Actions:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
```
