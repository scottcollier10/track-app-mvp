# API Testing Guide: Import Session

## Manual Testing with curl

### Test 1: Import Valid Session

```bash
curl -X POST http://localhost:3000/api/import-session \
  -H "Content-Type: application/json" \
  -d '{
    "driverEmail": "test@example.com",
    "trackId": "550e8400-e29b-41d4-a716-446655440001",
    "date": "2024-01-20T14:30:00Z",
    "totalTimeMs": 1200000,
    "bestLapMs": 92500,
    "laps": [
      {"lapNumber": 1, "lapTimeMs": 95000},
      {"lapNumber": 2, "lapTimeMs": 92500},
      {"lapNumber": 3, "lapTimeMs": 93200}
    ]
  }'
```

**Expected Response (201):**
```json
{
  "sessionId": "uuid-here",
  "message": "Session imported successfully"
}
```

### Test 2: Missing Required Fields

```bash
curl -X POST http://localhost:3000/api/import-session \
  -H "Content-Type: application/json" \
  -d '{
    "driverEmail": "test@example.com"
  }'
```

**Expected Response (400):**
```json
{
  "error": "Missing required fields"
}
```

### Test 3: Invalid Track ID

```bash
curl -X POST http://localhost:3000/api/import-session \
  -H "Content-Type: application/json" \
  -d '{
    "driverEmail": "test@example.com",
    "trackId": "00000000-0000-0000-0000-000000000000",
    "date": "2024-01-20T14:30:00Z",
    "totalTimeMs": 1200000,
    "laps": []
  }'
```

**Expected Response (404):**
```json
{
  "error": "Track not found"
}
```

## Integration Testing

For proper integration tests, you would:

1. Set up a test Supabase instance or use local Supabase
2. Seed test data
3. Use a testing library like `supertest` to make requests
4. Assert on database state after each test
5. Clean up test data

Example skeleton:

```typescript
import { createMocks } from 'node-mocks-http';
import { POST } from '@/app/api/import-session/route';

describe('POST /api/import-session', () => {
  it('should create a new session', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        driverEmail: 'test@example.com',
        trackId: 'valid-uuid',
        date: '2024-01-20T14:30:00Z',
        totalTimeMs: 1200000,
        laps: [],
      },
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('sessionId');
  });
});
```

## Testing Checklist

- [ ] Valid session import
- [ ] New driver auto-creation
- [ ] Existing driver reuse
- [ ] Invalid track ID handling
- [ ] Missing required fields
- [ ] Malformed JSON
- [ ] Large lap arrays (100+ laps)
- [ ] Concurrent imports
- [ ] Duplicate lap numbers
