import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/stores/auth";
import { toast } from "sonner";
import { GraduationCap, ShieldCheck, Users, BookOpen } from "lucide-react";

export default function AuthPage() {
  const { session, loading, signInAsUser } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;

  async function onUserSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return toast.error("Username is required");
    setBusy(true);
    try {
      await signInAsUser(username.trim());
      toast.success(`Welcome, ${username.trim()}`);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAdminSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!adminUsername.trim()) return toast.error("Username is required");
    setBusy(true);
    try {
      await signInAsUser(adminUsername.trim());
      const fresh = useAuth.getState();
      if (!fresh.isAdmin) {
        await fresh.signOut();
        toast.error("This account isn't an admin. Bootstrap an admin via SQL first.");
      } else {
        toast.success("Admin signed in");
        navigate("/admin");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="flex items-center gap-2 text-xl font-semibold">
          <GraduationCap className="h-7 w-7" /> Edu Awn
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">A platform by students, for students.</h1>
          <p className="text-lg opacity-90">Share notes, slides and resources across devices. Join private study groups. Chat in real-time.</p>
          <ul className="space-y-3 text-sm opacity-90">
            <li className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Cross-device academic file sharing</li>
            <li className="flex items-center gap-2"><Users className="h-4 w-4" /> Private groups with invite codes</li>
            <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Community moderation & reporting</li>
          </ul>
        </div>
        <p className="text-xs opacity-70">© Edu Awn</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>Pick a username — no email required. We'll remember you on this device.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="user">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="user">User</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
              <TabsContent value="user">
                <form onSubmit={onUserSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="u">Username</Label>
                    <Input id="u" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ada-lovelace" />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Signing in…" : "Continue"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="admin">
                <form onSubmit={onAdminSignIn} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="au">Username</Label>
                    <Input id="au" value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="admin-username" />
                  </div>
                  <p className="text-xs text-muted-foreground">Admins must be granted the role in the database (see SUPABASE_SETUP.md). Existing admin sessions on this device land in the admin panel automatically.</p>
                  <Button type="submit" className="w-full" disabled={busy} variant="secondary">
                    {busy ? "Signing in…" : "Enter admin"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}