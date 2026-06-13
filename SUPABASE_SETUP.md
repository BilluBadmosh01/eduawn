# Edu Awn — Supabase Setup

The app talks to **your** Supabase project at
`https://vtroxkoqedpunsncmdhz.supabase.co`. Run these steps once in the
Supabase dashboard.

## 1. Run the SQL migration

1. Open Supabase → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase-setup.sql` and run it.
3. This creates tables, RLS policies, helper functions, the trigger that
   auto-creates a profile on signup, the `shared-files` storage bucket, and
   enables Realtime on `messages`.

## 2. Enable Anonymous sign-ins

Supabase → **Authentication → Providers → Anonymous Sign-Ins** → **Enable**.
(Without this, the username-only login won't work.)

## 3. Bootstrap the first admin

1. In the running app, sign in with any username — this creates your account.
2. Find your `auth.users` id in Supabase → **Authentication → Users**.
3. Run this once in SQL Editor (replace the uuid):

   ```sql
   insert into public.user_roles (user_id, role)
   values ('YOUR-AUTH-USER-UUID', 'admin');
   ```

4. Sign out and back in inside the app — the Admin tab appears in the sidebar.

Subsequent admins can be promoted from the Admin → Users tab.

## Notes
- The publishable (anon) key is committed in
  `src/integrations/supabase/client.ts` — that key is public by design.
- All access control is enforced by RLS, not by hiding the key.
- File previews/downloads use short-lived signed URLs (1 h).