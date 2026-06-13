import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/stores/auth";
import { toast } from "sonner";
import { Users, Plus, KeyRound, MessageSquare, Copy } from "lucide-react";

export const Route = createFileRoute("/_app/groups/")({
  head: () => ({ meta: [{ title: "Groups — Edu Awn" }] }),
  component: GroupsList,
});

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function GroupsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: groups, isLoading } = useQuery({
    queryKey: ["my-groups", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("group_id, joined_at, groups(id, group_name, private_code, created_at, creator_id)")
        .eq("user_id", user!.id);
      if (error) throw error;
      const rows = (memberships ?? []) as any[];
      // get member counts and last message per group
      const ids = rows.map((r) => r.group_id);
      let counts: Record<string, number> = {};
      let lastMsg: Record<string, string> = {};
      if (ids.length) {
        const { data: mems } = await supabase.from("group_members").select("group_id").in("group_id", ids);
        counts = (mems ?? []).reduce((acc: Record<string, number>, m: any) => {
          acc[m.group_id] = (acc[m.group_id] ?? 0) + 1; return acc;
        }, {});
        const { data: msgs } = await supabase.from("messages").select("group_id, created_at").in("group_id", ids).order("created_at", { ascending: false });
        (msgs ?? []).forEach((m: any) => { if (!lastMsg[m.group_id]) lastMsg[m.group_id] = m.created_at; });
      }
      return rows.map((r) => ({ ...r.groups, member_count: counts[r.group_id] ?? 1, last_activity: lastMsg[r.group_id] ?? r.joined_at }));
    },
  });

  async function createGroup() {
    if (!groupName.trim() || !user) return;
    setBusy(true);
    const code = randomCode();
    const { data, error } = await supabase.from("groups").insert({
      group_name: groupName.trim(), private_code: code, creator_id: user.id,
    }).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }
    await supabase.from("group_members").insert({ user_id: user.id, group_id: data.id });
    setBusy(false);
    setOpenCreate(false);
    setGroupName("");
    toast.success(`Group created. Code: ${code}`);
    qc.invalidateQueries({ queryKey: ["my-groups"] });
  }

  async function joinGroup() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_group_by_code", { _code: code });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Joined!");
    setOpenJoin(false);
    setJoinCode("");
    qc.invalidateQueries({ queryKey: ["my-groups"] });
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Your groups</h1>
          <p className="text-sm text-muted-foreground">Private study circles with real-time chat.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openJoin} onOpenChange={setOpenJoin}>
            <DialogTrigger asChild>
              <Button variant="secondary"><KeyRound className="h-4 w-4 mr-1" />Join</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Join a group</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="c">Invite code</Label>
                <Input id="c" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCD1234" />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenJoin(false)}>Cancel</Button>
                <Button onClick={joinGroup} disabled={busy}>Join</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Create</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New group</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="gn">Group name</Label>
                <Input id="gn" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="CS-201 study group" />
                <p className="text-xs text-muted-foreground">A private invite code will be generated.</p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancel</Button>
                <Button onClick={createGroup} disabled={busy || !groupName.trim()}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : !groups || groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Users className="h-12 w-12 mx-auto" />
            <p className="font-medium">No groups yet</p>
            <p className="text-sm">Create one or join with an invite code.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g: any) => (
            <Card key={g.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="truncate">{g.group_name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> {g.member_count} member{g.member_count === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Last activity: {new Date(g.last_activity).toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded">{g.private_code}</code>
                  <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(g.private_code); toast.success("Code copied"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button asChild className="w-full" size="sm">
                  <Link to="/groups/$groupId" params={{ groupId: g.id }}>
                    <MessageSquare className="h-4 w-4 mr-1" /> Open chat
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}