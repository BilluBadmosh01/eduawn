
# Edu Awn — Implementation Plan

## Stack decisions (locked)
- **Router**: TanStack Router (file-based, React Router-equivalent DX). Not `react-router-dom`.
- **Backend**: External Supabase project that you own. You'll run the SQL migration and create the storage bucket in your Supabase dashboard. I'll wire `@supabase/supabase-js` directly to it.
- **State**: Zustand for client state (auth/session, theme), TanStack Query for server cache.
- **Styling**: Tailwind v4 (already configured), shadcn/ui components.
- **User auth**: Supabase anonymous sign-in; username stored in `profiles`. Session persists in localStorage → no re-login.
- **Admin**: Role stored in `user_roles` table (separate from profiles to prevent privilege escalation). First admin promoted manually via SQL; subsequent admins promoted from the admin panel. **The hardcoded `AtLeast10Chars` password is dropped** — it's insecure.

## What you need to provide
Before I start coding I'll ask for two secrets via the secrets tool:
- `VITE_SUPABASE_URL` — e.g. `https://xxxx.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` — the anon/publishable key (safe in the browser)

You will also need to, in your Supabase dashboard:
1. Run the SQL migration I generate (I'll output it as `supabase-setup.sql` you paste into the SQL editor).
2. Create the `shared-files` storage bucket (private) — I'll give you the exact RLS policies for `storage.objects`.
3. Enable Realtime on the `messages` table.
4. Run one `INSERT` to grant yourself the `admin` role (I'll include the snippet).

## Pages / routes
```
src/routes/
  __root.tsx                  global shell, theme provider, toast, auth bootstrap
  index.tsx                   redirect → /auth or /dashboard based on session
  auth.tsx                    Sign in: username (user mode) | username (admin mode)
  _app/route.tsx              auth-gated layout: sidebar + topbar + <Outlet/>
  _app/dashboard.tsx          feed of files + feature cards
  _app/uploads.tsx            upload page (drag/drop, validation, progress)
  _app/profile.tsx            view/edit username, stats
  _app/settings.tsx           theme toggle, notifications, account, logout
  _app/groups.index.tsx       list previous groups + create + join
  _app/groups.$groupId.tsx    realtime chat
  _app/admin.tsx              admin-only: reports, files, users tabs
```

## Database schema (single migration)
Tables: `profiles`, `user_roles` (+ `app_role` enum), `files`, `reports`, `groups`, `group_members`, `messages`.

Key rules:
- `profiles.id` references `auth.users(id)` with `ON DELETE CASCADE`. Auto-created via `handle_new_user` trigger that reads username from `raw_user_meta_data`.
- `user_roles` is the **only** source of truth for roles. `has_role(uid, role)` SECURITY DEFINER function used by all admin RLS policies (avoids recursion).
- `groups.private_code` is a unique 8-char code generated server-side.
- All tables: RLS enabled + explicit `GRANT`s to `authenticated` + `service_role`.

## RLS summary (so nothing breaks)
- `profiles`: anyone authenticated can `SELECT` (needed to show uploader names); only owner can `UPDATE` own row.
- `files`: authenticated `SELECT` all (public feed); insert only with `uploader_id = auth.uid()`; delete by owner or admin.
- `reports`: insert by any authenticated user (must set `reporter_id = auth.uid()`); `SELECT` only by admins or the reporter themselves (the spec says users shouldn't see *others'* reports).
- `groups`: members can `SELECT`; anyone authenticated can `INSERT` (becomes creator); creator/admin can `DELETE`.
- `group_members`: a user can read membership rows for groups they're in; insert allowed when joining via valid code (handled by a `join_group_by_code(code)` RPC).
- `messages`: select/insert restricted to group members via `is_group_member(uid, group_id)` SECURITY DEFINER helper.
- `user_roles`: select-self by authenticated; insert/delete admin-only.

## Storage
Bucket `shared-files` (private). Policies on `storage.objects`:
- Authenticated insert (path prefixed with `auth.uid()/`).
- Authenticated select (so the app can generate signed URLs for previews/downloads).
- Owner or admin delete.
- App generates signed URLs (1h) for preview/download — no public bucket needed.

## Realtime
- Add `messages` to the `supabase_realtime` publication.
- Each group chat page subscribes to `INSERT` on `messages` filtered by `group_id`.

## Client architecture
- `src/integrations/supabase/client.ts` — single browser client using `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`, `persistSession: true`.
- `src/stores/auth.ts` — Zustand: `{ session, profile, role, signInAsUser(username), signInAsAdmin(username), signOut() }`. Hydrates on mount via `getSession()` + `onAuthStateChange`.
- `src/stores/theme.ts` — Zustand + localStorage; toggles `.dark` on `<html>`.
- TanStack Query for files feed, groups list, messages history, reports list.
- Route guards: a `_app` pathless layout calls `useAuth()` and renders `<Navigate to="/auth"/>` if not signed in. Admin tab inside `_app/admin.tsx` re-checks role and shows a 403 panel otherwise.

## Auth flows
**User mode**: `supabase.auth.signInAnonymously({ options: { data: { username } } })` → trigger creates `profiles` row with that username and role `user`. Session persists.
**Admin mode**: Same anonymous sign-in path; after sign-in the app queries `user_roles` — if no `admin` row, show "This account isn't an admin yet" and stay on /auth. First admin is bootstrapped by you in SQL.

## Upload flow
1. Client validates extension (whitelist) + non-empty file name.
2. Upload to `shared-files/{user_id}/{uuid}-{original}`.
3. Insert row into `files` with uploader info + storage path.
4. Toast + redirect to dashboard.
5. Feed uses `createSignedUrl` (1h) for previews/downloads.

## Preview support
- Images & PDFs → inline preview (img / iframe).
- Office/other → "Preview unavailable. Download to view." + download button (signed URL).

## Admin panel tabs
- **Reports**: list with file name, reporter, reason, time; actions: Dismiss (delete report row) or Delete file (cascades reports).
- **Files**: searchable list of all files, delete action.
- **Users**: list profiles, search by username, promote/demote admin (writes `user_roles`), delete user (calls a server function — *note: account deletion requires service role; we'll only delete the profile/files since you said external Supabase. Full auth-user deletion would need an Edge Function in your project, which I can scaffold but you'd deploy*).

## UI polish
- shadcn `Card`, `Dialog`, `Sheet` (sidebar on mobile), `Sonner` toasts, `Skeleton` loaders, empty states with icons, confirmation dialogs for destructive actions, Framer-light CSS transitions, mobile-first responsive layouts.

## Deliverables
1. All route files + components above.
2. `supabase-setup.sql` (paste-into-dashboard migration with tables, enum, functions, triggers, RLS, GRANTs, publication, storage policies, realtime).
3. README section with the exact setup steps (env vars, run SQL, create bucket, grant first admin).
4. Working app against your Supabase project once you set the two secrets.

## Out of scope (call out explicitly)
- True Office/Smart Whiteboard preview rendering (we show "download to view").
- Push notifications (Settings has a UI toggle stored locally only).
- Auth-user hard delete from admin panel (needs your own Edge Function with service role — I'll scaffold but not deploy).

Confirm and I'll switch to build mode and ask for the two Supabase secrets first.
