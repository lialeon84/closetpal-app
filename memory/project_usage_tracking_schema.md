---
name: usage_tracking Supabase table schema
description: New table required by usageLimits hook — tracks daily/monthly usage counters for free tier gating
type: project
---

The `usage_tracking` Supabase table must be created for the `hooks/usageLimits.js` hook to work.

**Schema:**
- `user_id` (uuid, primary key / unique, FK to auth.users)
- `outfit_recs_date` (text, YYYY-MM-DD format, nullable)
- `outfit_recs_count` (int, default 0)
- `ai_detections_month` (text, YYYY-MM format, nullable)
- `ai_detections_count` (int, default 0)
- `trips_month` (text, YYYY-MM format, nullable)
- `trips_count` (int, default 0)

**Why:** The `usageLimits` hook upserts on `user_id` conflict (`onConflict: 'user_id'`), so `user_id` must have a unique constraint. The hook does NOT backfill existing trip counts from the `trips` table — existing users start with a fresh count of 0 on their first new trip.

**How to apply:** Run the migration in Supabase SQL editor before deploying. Enable RLS and add a policy so users can only read/write their own row.
