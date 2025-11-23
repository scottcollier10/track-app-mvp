# Track App - Authentication System

Complete authentication implementation using Supabase Auth for the Track App web portal.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Authentication Flows](#authentication-flows)
- [Security Features](#security-features)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [iOS Integration (Future)](#ios-integration-future)

---

## Overview

The Track App authentication system provides:

- **Email/Password Authentication**: Standard login and registration
- **OAuth Providers**: Google and Apple Sign-In (requires Supabase configuration)
- **Password Reset**: Email-based password recovery
- **Session Management**: Automatic session refresh and persistence
- **Protected Routes**: Middleware-based route protection
- **Row Level Security (RLS)**: Database-level access control
- **Auto Profile Creation**: Automatic driver profile creation on signup

---

## Architecture

### Components

```
web/
├── src/
│   ├── app/
│   │   ├── login/page.tsx                 # Login page
│   │   ├── signup/page.tsx                # Registration page
│   │   ├── reset-password/page.tsx        # Password reset
│   │   └── auth/callback/route.ts         # OAuth callback handler
│   ├── components/auth/
│   │   ├── AuthProvider.tsx               # Auth context provider
│   │   ├── LoginForm.tsx                  # Login form component
│   │   ├── SignupForm.tsx                 # Signup form component
│   │   └── PasswordResetForm.tsx          # Password reset component
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── types.ts                   # Auth type definitions
│   │   │   └── actions.ts                 # Server actions for auth
│   │   └── supabase/
│   │       ├── client.ts                  # Browser client
│   │       ├── server.ts                  # Server client
│   │       └── middleware.ts              # Middleware client
│   └── middleware.ts                      # Route protection middleware
└── .env.local                             # Environment variables
```

### Database Schema

```sql
-- drivers table (linked to auth.users)
CREATE TABLE drivers (
  id UUID PRIMARY KEY,              -- matches auth.users.id
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create driver on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### RLS Policies

All tables have Row Level Security enabled:

- **drivers**: Users can read/update only their own record
- **sessions**: Users can CRUD only their own sessions
- **laps**: Users can CRUD laps for their own sessions
- **coaching_notes**: Users can read/write notes for their own sessions
- **tracks**: Public read access for all authenticated users

---

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the `web/` directory:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: App URL for OAuth redirects (defaults to localhost:3000)
NEXT_PUBLIC_APP_URL=https://trackapp-portal.vercel.app

# Anthropic (existing)
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

### 2. Supabase Dashboard Configuration

#### Enable Email Provider

1. Go to **Authentication** → **Providers** in Supabase Dashboard
2. Enable **Email** provider
3. Configure email templates:
   - **Confirm signup**: Customize welcome email
   - **Reset password**: Customize reset email
4. Set **Site URL**: `https://trackapp-portal.vercel.app` (or your domain)
5. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://trackapp-portal.vercel.app/auth/callback`

#### Enable OAuth Providers (Optional)

**Google:**
1. Enable Google provider in Supabase Dashboard
2. Create OAuth credentials in Google Cloud Console
3. Add authorized redirect URIs:
   - `https://your-project.supabase.co/auth/v1/callback`
4. Enter Client ID and Client Secret in Supabase

**Apple:**
1. Enable Apple provider in Supabase Dashboard
2. Configure Apple Sign In in Apple Developer Console
3. Enter Service ID and Key in Supabase

### 3. Run Database Migration

Apply the authentication migration:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration SQL in Supabase SQL Editor
# File: supabase/migrations/008_add_authentication.sql
```

### 4. Install Dependencies

All required packages are already in `package.json`:

```bash
cd web
npm install
```

### 5. Start Development Server

```bash
npm run dev
```

Navigate to `http://localhost:3000/signup` to create your first account.

---

## Authentication Flows

### Sign Up Flow

1. User visits `/signup`
2. Fills out registration form (name, email, password)
3. On submit:
   - `signUp()` action creates auth.users record
   - Database trigger `handle_new_user()` automatically creates:
     - Driver record (with same ID as auth user)
     - Driver profile record (with default values)
4. User receives confirmation email (if enabled)
5. User clicks confirmation link
6. Redirected to `/auth/callback` → home page

### Sign In Flow

1. User visits `/login`
2. Enters email and password
3. On submit:
   - `signIn()` action authenticates user
   - Session cookie is set
   - User redirected to home page or original destination

### Password Reset Flow

1. User visits `/reset-password`
2. Enters email address
3. On submit:
   - `resetPassword()` action sends reset email
4. User clicks link in email
5. Redirected to `/reset-password?type=recovery`
6. User enters new password
7. Password updated, redirected to login

### OAuth Flow

1. User clicks "Continue with Google/Apple"
2. `signInWithProvider()` action initiates OAuth
3. User redirected to provider's login page
4. After authentication, redirected to `/auth/callback`
5. Session established, user redirected to home page

---

## Security Features

### Password Requirements

- Minimum 8 characters
- Enforced in both frontend and Supabase

### Protected Routes

Middleware automatically protects routes:

**Protected (require authentication):**
- `/sessions`
- `/sessions/[id]`
- `/profile`
- `/coach`

**Public (no auth required):**
- `/` (home/dashboard overview)
- `/login`
- `/signup`
- `/reset-password`
- `/auth/callback`

### Session Management

- **Auto-refresh**: Sessions automatically refresh via middleware
- **Persistence**: Sessions stored in secure HTTP-only cookies
- **Timeout**: Configurable in Supabase Dashboard (default 7 days)

### Database Security (RLS)

All user data is protected by Row Level Security:

```sql
-- Example: Users can only read their own sessions
CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = driver_id);
```

### API Route Protection

API routes check authentication:

```typescript
// Example: Sessions API
const user = await getUser();
if (!user) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  );
}
```

---

## Testing

### Manual Testing Checklist

**Sign Up:**
- [ ] Create account with email/password
- [ ] Verify email confirmation (if enabled)
- [ ] Check driver and driver_profile records created
- [ ] Login with new credentials

**Sign In:**
- [ ] Login with valid credentials
- [ ] Attempt login with wrong password (should fail)
- [ ] Verify redirect to intended page after login

**Protected Routes:**
- [ ] Access `/sessions` while logged out (should redirect to /login)
- [ ] Login and access `/sessions` (should succeed)
- [ ] Logout and try again (should redirect)

**Password Reset:**
- [ ] Request password reset
- [ ] Receive email with reset link
- [ ] Click link and update password
- [ ] Login with new password

**Data Isolation:**
- [ ] Create session as User A
- [ ] Login as User B
- [ ] Verify User B cannot see User A's sessions

**OAuth (if configured):**
- [ ] Sign in with Google
- [ ] Sign in with Apple
- [ ] Verify profile creation

### Automated Testing

```bash
# Run tests (when implemented)
npm test

# E2E tests with Playwright (future)
npm run test:e2e
```

---

## Troubleshooting

### "Missing Supabase environment variables"

**Cause**: `.env.local` not configured or variables not set.

**Fix**:
```bash
cd web
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

### Email confirmation not working

**Cause**: Email provider not configured in Supabase.

**Fix**:
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Verify SMTP settings or use Supabase's default email service
3. Check spam folder

### OAuth redirect errors

**Cause**: Redirect URLs not whitelisted in Supabase.

**Fix**:
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add redirect URL: `https://your-domain.com/auth/callback`
3. Ensure provider credentials are correct

### RLS blocking inserts

**Cause**: RLS policies too restrictive or auth context not available.

**Fix**:
- Verify `auth.uid()` is available in context
- Check policy definitions in migration `008_add_authentication.sql`
- Use service role key for admin operations (not anon key)

### Users can't see their data

**Cause**: Driver record not linked to auth.users.id

**Fix**:
- Verify trigger `handle_new_user()` is active
- For existing users, manually link driver.id to auth.users.id:
  ```sql
  UPDATE drivers
  SET id = (SELECT id FROM auth.users WHERE email = drivers.email)
  WHERE email = 'user@example.com';
  ```

---

## iOS Integration (Future)

### Current State

The iOS app currently uses email-based identification without authentication.

**iOS Upload Flow (No Auth):**
1. User enters email in iOS app
2. Session uploaded via `/api/import-session`
3. Driver looked up or created by email
4. No token/verification required

### Planned Implementation (Phase 3)

**Requirements:**
- Add Supabase Swift SDK to iOS project
- Implement auth views (LoginView, SignupView)
- Store auth tokens in iOS Keychain
- Update APIService to include auth headers
- Modify `/api/import-session` to require authentication

**Migration Path:**
1. Add Supabase Swift package dependency
2. Create SupabaseAuthService.swift
3. Build login/signup UI
4. Implement token storage and refresh
5. Update session upload to use authenticated endpoint

---

## API Reference

### Server Actions

```typescript
// Sign up
import { signUp } from '@/lib/auth/actions';
const result = await signUp({ email, password, name });

// Sign in
import { signIn } from '@/lib/auth/actions';
const result = await signIn({ email, password });

// Sign out
import { signOut } from '@/lib/auth/actions';
await signOut();

// Reset password
import { resetPassword } from '@/lib/auth/actions';
const result = await resetPassword({ email });

// Update password
import { updatePassword } from '@/lib/auth/actions';
const result = await updatePassword({ password });

// OAuth sign in
import { signInWithProvider } from '@/lib/auth/actions';
await signInWithProvider('google'); // or 'apple'
```

### Client Hooks

```typescript
// Use auth context
import { useAuth } from '@/components/auth/AuthProvider';

function MyComponent() {
  const { user, session, loading, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return <div>Welcome {user.email}</div>;
}
```

### Server Utilities

```typescript
// Get current user in Server Component
import { getUser } from '@/lib/supabase/server';
const user = await getUser(); // null if not authenticated

// Require authentication (throws if not authed)
import { requireAuth } from '@/lib/supabase/server';
const user = await requireAuth();
```

---

## Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase SSR Package](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

## Support

For issues or questions:
1. Check this documentation
2. Review Supabase Dashboard logs
3. Check browser console for client-side errors
4. Review server logs for API errors
5. Open GitHub issue with reproduction steps
