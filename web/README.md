# Track App - Web Dashboard

Next.js coaching dashboard for reviewing track sessions and adding notes.

## Requirements

- Node.js 18+
- npm or yarn
- Supabase account (free tier works)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

#### Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in project details and wait for setup to complete

#### Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the contents of `supabase/migrations/20240101_initial_schema.sql`
4. Paste and click "Run"
5. Verify tables were created: Go to **Table Editor** and check for:
   - `drivers`
   - `tracks`
   - `sessions`
   - `laps`
   - `coaching_notes`

#### Get API Credentials

1. In Supabase dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like `https://xxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Home dashboard
│   │   ├── sessions/            # Sessions pages
│   │   │   ├── page.tsx         # List view
│   │   │   └── [id]/page.tsx   # Detail view
│   │   ├── tracks/              # Tracks pages
│   │   │   └── page.tsx
│   │   └── api/                 # API routes
│   │       └── import-session/
│   │           └── route.ts     # Session import endpoint
│   ├── lib/                     # Shared utilities
│   │   ├── supabase/           # Supabase client
│   │   ├── types/              # TypeScript types
│   │   └── utils/              # Helper functions
│   └── components/              # React components
│       ├── ui/                 # Reusable UI components
│       └── charts/             # Chart components
├── supabase/
│   └── migrations/             # SQL migrations
├── __tests__/                  # Jest tests
└── public/                     # Static assets
```

## Features

### Dashboard (/)

- Quick stats: total sessions, drivers, tracks
- Recent sessions list
- Links to sessions and tracks

### Sessions (/sessions)

- List all sessions with:
  - Driver name
  - Track name
  - Date
  - Best lap time
- Filters:
  - By track
  - By date range

### Session Detail (/sessions/[id])

- Session summary (driver, track, date)
- Lap table with deltas vs best lap
- Lap time chart
- Coaching notes:
  - View existing notes
  - Add new notes

### Tracks (/tracks)

- List all tracks with basic info
- Track length and location

## API Routes

### POST /api/import-session

Import a session from the iOS app.

**Request body:**
```json
{
  "driverEmail": "user@example.com",
  "trackId": "uuid",
  "date": "2024-01-15T14:30:00Z",
  "totalTimeMs": 1200000,
  "bestLapMs": 92500,
  "laps": [
    {"lapNumber": 1, "lapTimeMs": 95000},
    {"lapNumber": 2, "lapTimeMs": 92500}
  ]
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "message": "Session imported successfully"
}
```

## Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- Fly.io

Just ensure environment variables are configured.

## Development Tips

### Database Changes

To make schema changes:

1. Create a new migration file in `supabase/migrations/`
2. Run it in Supabase SQL Editor
3. Update TypeScript types in `src/lib/types/database.ts`

### Supabase Studio

Supabase provides a local development environment:

```bash
npx supabase init
npx supabase start
```

This gives you a local Postgres instance with Studio UI.

### Type Safety

The app uses TypeScript throughout. Key type files:

- `src/lib/types/database.ts` - Database table types
- `src/lib/types/index.ts` - Application types

### Debugging Queries

To see Supabase queries in dev tools:

```typescript
import { supabase } from '@/lib/supabase/client';

const { data, error } = await supabase
  .from('sessions')
  .select('*')
  .limit(10);

console.log('Query result:', { data, error });
```

## Troubleshooting

### "Missing Supabase environment variables"

- Ensure `.env.local` exists and has correct values
- Restart dev server after changing env vars

### Database Connection Errors

- Verify Supabase project is active (not paused)
- Check API keys are correct
- Ensure RLS policies allow access

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Rebuild
npm run build
```

## Next Steps

**Post-MVP enhancements:**

- Add authentication (Supabase Auth)
- Driver vs coach roles
- Real-time session updates
- Video integration
- Advanced analytics
- Weather tracking
- Vehicle management

## Support

For issues, check:
- [Next.js docs](https://nextjs.org/docs)
- [Supabase docs](https://supabase.com/docs)
- [Tailwind CSS docs](https://tailwindcss.com/docs)
