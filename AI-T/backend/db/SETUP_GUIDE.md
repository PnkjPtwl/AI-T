# Database Setup Guide

This guide walks you through setting up the database schema and seeding initial data for the AI Trainer monorepo.

## Prerequisites
- Supabase project created with new URL and credentials
- `.env` file updated with correct Supabase credentials
- Node.js installed

## Step 1: Create Database Schema

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire content from `db/FULL_SCHEMA.sql`
5. Paste it into the SQL editor
6. Click **Run**
7. Wait for all statements to execute (you'll see ✅ for successful statements)

### Option B: Using psql (if you have direct access)
```bash
psql "postgresql://postgres:PASSWORD@HOST:5432/postgres" -f db/FULL_SCHEMA.sql
```

## Step 2: Seed Database with Sample Data

### Using ts-node
```bash
cd backend
npx ts-node db/seed.ts
```

This will create:
- 3 test organizations (with at least 1 active)
- 4 test users (1 manager + 3 reps)
- 5 training scenarios (Skeptical CFO, Angry Customer, Busy Executive, New Prospect, Existing Client)
- 3 sample training assignments

## Step 3: Verify Setup

### Check Organizations
```bash
curl http://localhost:4000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Scenarios
```bash
curl http://localhost:4000/api/scenarios
```

## Step 4: Start the Backend

```bash
npm run dev
```

You should see:
```
✅ Backend running at http://localhost:4000
```

## Troubleshooting

### "Table already exists" errors
- Safe to ignore - these are due to `CREATE TABLE IF NOT EXISTS`

### "ENOTFOUND" error on login
- Verify `.env` has correct `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- Check that the Supabase project is not deleted/paused

### Seed script fails
- Make sure schema was created successfully first
- Check that `.env` credentials are valid
- Verify backend is running before attempting seed

### RLS (Row Level Security) Issues
- The migrations create tables but don't enable RLS by default
- For production, enable RLS policies after schema creation
- See Supabase documentation for RLS setup

## Database Schema Overview

```
organisations
├── users
│   ├── calls
│   │   └── coaching_signals
│   ├── training_sessions
│   │   └── training_assignments
│   └── training_assignments
│
├── training_scenarios
│   ├── training_sessions
│   └── training_assignments
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `organisations` | Company/org grouping |
| `users` | Managers and Reps with roles |
| `calls` | Recorded sales calls with transcripts |
| `training_scenarios` | Practice scenarios (personas) |
| `training_sessions` | Rep practice sessions |
| `training_assignments` | Manager assignments to reps |
| `coaching_signals` | Metrics from call analysis |

## API Quick Reference

### Authentication
- `POST /api/auth/signup/manager` - Create manager account
- `POST /api/auth/signup/rep` - Create rep account  
- `POST /api/auth/login` - Login (both roles)

### Manager Endpoints
- `GET /api/users/team` - Get all reps in org
- `GET /api/scenarios` - Get all scenarios
- `POST /api/users/assign-training` - Assign training to reps

### Rep Endpoints
- `GET /api/sessions/my-sessions` - Get rep's completed sessions
- `POST /api/sessions/start` - Start practice session
- `POST /api/sessions/send-message` - Send message in session

## Next Steps

1. Test login with created users:
   - Manager: manager@acmecorp.com
   - Reps: alice@acmecorp.com, bob@acmecorp.com, carol@acmecorp.com

2. Create a manager assignment to test the flow

3. Customize scenarios for your use case in the Supabase dashboard

4. Set up frontend environment variables for the new Supabase URL

## Support

For issues with schema or migrations, check:
- Supabase dashboard → SQL Editor for query logs
- Backend terminal for API errors
- `.env` file for credential issues
