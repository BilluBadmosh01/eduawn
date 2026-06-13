import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signInAsUser: (username: string) => Promise<void>;
  signOut: () => Promise<void>;
};

async function loadProfileAndRole(userId: string) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin");
  return { profile: (profile as Profile) ?? null, isAdmin };
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      set({ session: null, user: null, profile: null, isAdmin: false, loading: false });
      return;
    }
    const { profile, isAdmin } = await loadProfileAndRole(session.user.id);
    set({ session, user: session.user, profile, isAdmin, loading: false });
  },
  refreshProfile: async () => {
    const u = get().user;
    if (!u) return;
    const { profile, isAdmin } = await loadProfileAndRole(u.id);
    set({ profile, isAdmin });
  },
  signInAsUser: async (username: string) => {
    const name = username.trim();
    if (!name) throw new Error("Username is required");
    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { username: name } },
    });
    if (error) throw error;
    if (!data.session) throw new Error("Sign in failed");
    // Wait briefly for trigger to populate profile, then load
    for (let i = 0; i < 5; i++) {
      const { profile, isAdmin } = await loadProfileAndRole(data.session.user.id);
      if (profile) {
        set({ session: data.session, user: data.session.user, profile, isAdmin, loading: false });
        return;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    // Fallback: upsert manually
    await supabase.from("profiles").upsert({ id: data.session.user.id, username: name });
    const { profile, isAdmin } = await loadProfileAndRole(data.session.user.id);
    set({ session: data.session, user: data.session.user, profile, isAdmin, loading: false });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isAdmin: false });
  },
}));

// Bootstrap listener
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      useAuth.setState({ session: null, user: null, profile: null, isAdmin: false });
      return;
    }
    // Defer profile fetch
    loadProfileAndRole(session.user.id).then(({ profile, isAdmin }) => {
      useAuth.setState({ session, user: session.user, profile, isAdmin });
    });
  });
}