# Track App Authentication - Quick Setup Guide

This guide will help you get authentication up and running in under 10 minutes.

## Prerequisites

- Supabase project created
- Local development environment with Node.js installed
- Git repository cloned

## Step-by-Step Setup

### 1. Configure Environment Variables (2 minutes)

```bash
cd web
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

**Where to find these:**
- Supabase URL and Anon Key: Supabase Dashboard → Settings → API

### 2. Run Database Migration (3 minutes)

**Option A: Using Supabase CLI (recommended)**
```bash
# Link to your project (first time only)
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

**Option B: Manual (via Supabase Dashboard)**
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/008_add_authentication.sql`
3. Paste and run the SQL

### 3. Configure Supabase Auth Settings (3 minutes)

In Supabase Dashboard → Authentication:

#### Email Provider
1. Go to **Providers** → **Email**
2. Enable if not already enabled
3. Disable "Confirm email" if you want to test without email verification (re-enable for production)

#### URL Configuration
1. Go to **URL Configuration**
2. Set **Site URL**: `http://localhost:3000` (or your production URL)
3. Add **Redirect URLs**:
   ```
   http://localhost:3000/auth/callback
   https://trackapp-portal.vercel.app/auth/callback
   ```

#### Email Templates (Optional)
1. Go to **Email Templates**
2. Customize confirmation and password reset emails
3. Use your own SMTP server or use Supabase's default

### 4. Start the Application (1 minute)

```bash
cd web
npm install  # if not already done
npm run dev
```

### 5. Test Authentication (2 minutes)

1. Open browser: `http://localhost:3000`
2. Click **Sign Up** in navigation
3. Create account:
   - Name: Test User
   - Email: test@example.com
   - Password: password123
4. You should be redirected to the home page
5. Verify you're logged in (email shows in navigation)

## Quick Verification Checklist

After setup, verify these work:

- [ ] Signup creates account
- [ ] Login works with credentials
- [ ] Protected routes redirect to `/login` when not authenticated
- [ ] Logout works
- [ ] User can only see their own sessions
- [ ] Password reset email is sent (check spam folder)

## Optional: Enable OAuth (5-10 minutes)

### Google Sign-In

1. **Create OAuth App** in [Google Cloud Console](https://console.cloud.google.com/):
   - Create new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI:
     ```
     https://xxxxx.supabase.co/auth/v1/callback
     ```

2. **Configure in Supabase**:
   - Go to Authentication → Providers → Google
   - Enable provider
   - Enter Client ID and Client Secret
   - Save

3. **Test**:
   - Go to `/login`
   - Click "Continue with Google"
   - Authenticate with Google
   - Should redirect back to app

### Apple Sign-In

1. **Configure in Apple Developer**:
   - Enable Sign In with Apple
   - Create Service ID
   - Add return URL:
     ```
     https://xxxxx.supabase.co/auth/v1/callback
     ```

2. **Configure in Supabase**:
   - Go to Authentication → Providers → Apple
   - Enable provider
   - Enter Service ID and Key
   - Save

## Troubleshooting

### "Missing Supabase environment variables"
- Check `.env.local` exists and has correct values
- Restart dev server after changing `.env.local`

### Can't create account
- Check Supabase Dashboard → Logs → Authentication
- Verify migration ran successfully (check drivers table exists)
- Ensure email provider is enabled

### Redirect loop on login
- Check middleware.ts is not blocking auth routes
- Verify `/login` and `/auth/callback` are in PUBLIC_ROUTES

### Users can't see their data
- Check RLS policies are enabled
- Verify trigger `handle_new_user()` fired (check drivers table)
- User ID should match in `auth.users` and `drivers` tables

### Email not received
- Check spam folder
- Verify email provider configured in Supabase
- Test with your own email domain in Supabase settings

## Production Deployment

### Vercel Deployment

1. **Set Environment Variables** in Vercel Dashboard:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   NEXT_PUBLIC_APP_URL=https://trackapp-portal.vercel.app
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

2. **Update Supabase URL Configuration**:
   - Add production URL to redirect URLs
   - Update site URL if needed

3. **Deploy**:
   ```bash
   git push origin main
   ```

### Security Checklist for Production

- [ ] Enable email confirmation in Supabase
- [ ] Configure custom SMTP for emails
- [ ] Set up custom domain
- [ ] Enable rate limiting in Supabase
- [ ] Review and test all RLS policies
- [ ] Enable two-factor authentication option
- [ ] Set up monitoring and alerts
- [ ] Configure proper CORS settings
- [ ] Use strong password policies

## Next Steps

After authentication is working:

1. **Migrate Existing Data** (if you have users):
   - Create auth.users records for existing drivers
   - Link driver.id to auth.users.id
   - Test data access with new accounts

2. **Implement iOS Auth** (Phase 3):
   - See `/docs/authentication.md` → iOS Integration section

3. **Add Profile Management**:
   - Expand `/profile` page with more fields
   - Add profile picture upload
   - Add preferences and settings

4. **Enhance Security**:
   - Add two-factor authentication
   - Implement session management UI
   - Add device tracking

## Support

Need help? Check:
- `/docs/authentication.md` - Full documentation
- Supabase Dashboard Logs
- Browser console errors
- Server logs in terminal

## Quick Commands Reference

```bash
# Start dev server
npm run dev

# Run migration
supabase db push

# Check Supabase status
supabase status

# View logs
supabase logs

# Reset database (DANGER: deletes all data)
supabase db reset
```

---

**Setup complete!** 🎉

You now have a fully functional authentication system with protected routes, user sessions, and database-level security.
