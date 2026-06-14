import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/stores/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Profile() {
  useEffect(() => { document.title = "Profile — Edu Awn"; }, []);
  const { user, profile, isAdmin, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.username ?? "");
  const [busy, setBusy] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ count: uploads }, { count: groups }] = await Promise.all([
        supabase.from("files").select("*", { count: "exact", head: true }).eq("uploader_id", user!.id),
        supabase.from("group_members").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      return { uploads: uploads ?? 0, groups: groups ?? 0 };
    },
  });

  async function save() {
    if (!name.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username: name.trim() }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refreshProfile();
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
              {profile?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <div className="font-semibold text-lg">@{profile?.username}</div>
              <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "admin" : "user"}</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="u">Username</Label>
            <div className="flex gap-2">
              <Input id="u" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={save} disabled={busy || !name.trim() || name === profile?.username}>Save</Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2">
            <Stat label="Joined" value={profile ? new Date(profile.created_at).toLocaleDateString() : "—"} />
            <Stat label="Uploads" value={stats?.uploads ?? "—"} />
            <Stat label="Groups" value={stats?.groups ?? "—"} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
