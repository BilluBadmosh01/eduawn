import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, STORAGE_BUCKET } from "@/integrations/supabase/client";
import { useAuth } from "@/stores/auth";
import { toast } from "sonner";
import { ShieldX, Trash2, ShieldCheck, ShieldOff } from "lucide-react";

export default function AdminPage() {
  useEffect(() => { document.title = "Admin — Edu Awn"; }, []);
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <ShieldX className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Admins only</h2>
            <p className="text-sm text-muted-foreground">You don't have admin privileges on this account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">Admin panel</h1>
      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="files"><FilesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ReportsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*, files(file_name, storage_path, id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function dismiss(id: string) {
    const { error } = await supabase.from("reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dismissed");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  async function deleteFile(fileId: string, path: string) {
    if (!confirm("Delete this file and all its reports?")) return;
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    const { error } = await supabase.from("files").delete().eq("id", fileId);
    if (error) return toast.error(error.message);
    toast.success("File deleted");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    qc.invalidateQueries({ queryKey: ["files"] });
  }

  if (isLoading) return <p className="py-6 text-muted-foreground">Loading…</p>;
  if (!data?.length) return <p className="py-6 text-muted-foreground">No reports.</p>;

  return (
    <div className="space-y-3 mt-4">
      {data.map((r: any) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="space-y-1 min-w-0">
              <div className="font-medium truncate">{r.files?.file_name ?? "(deleted file)"}</div>
              <div className="text-xs text-muted-foreground">Reported by @{r.reporter_username} · {new Date(r.created_at).toLocaleString()}</div>
              <div className="text-sm">Reason: {r.reason}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => dismiss(r.id)}>Dismiss</Button>
              {r.files && (
                <Button size="sm" variant="destructive" onClick={() => deleteFile(r.files.id, r.files.storage_path)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete file
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FilesTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-files"],
    queryFn: async () => {
      const { data, error } = await supabase.from("files").select("*").order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const filtered = (data ?? []).filter((f: any) => f.file_name.toLowerCase().includes(q.toLowerCase()) || f.uploader_username.toLowerCase().includes(q.toLowerCase()));

  async function remove(id: string, path: string) {
    if (!confirm("Delete this file?")) return;
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    const { error } = await supabase.from("files").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin-files"] });
    qc.invalidateQueries({ queryKey: ["files"] });
  }

  return (
    <div className="space-y-3 mt-4">
      <Input placeholder="Search by name or uploader…" value={q} onChange={(e) => setQ(e.target.value)} />
      {filtered.map((f: any) => (
        <Card key={f.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">{f.file_name}</div>
              <div className="text-xs text-muted-foreground">@{f.uploader_username} · .{f.file_type} · {new Date(f.uploaded_at).toLocaleString()}</div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => remove(f.id, f.storage_path)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && <p className="text-muted-foreground py-4">No files.</p>}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);
      const adminIds = new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));
      return (profiles ?? []).map((p: any) => ({ ...p, isAdmin: adminIds.has(p.id) }));
    },
  });
  const filtered = (data ?? []).filter((u: any) => u.username.toLowerCase().includes(q.toLowerCase()));

  async function toggleAdmin(userId: string, isAdmin: boolean) {
    if (isAdmin) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Admin revoked");
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Promoted to admin");
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="space-y-3 mt-4">
      <Input placeholder="Search by username…" value={q} onChange={(e) => setQ(e.target.value)} />
      {filtered.map((u: any) => (
        <Card key={u.id}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                @{u.username}
                {u.isAdmin && <Badge>admin</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()}</div>
            </div>
            <Button size="sm" variant={u.isAdmin ? "outline" : "default"} onClick={() => toggleAdmin(u.id, u.isAdmin)}>
              {u.isAdmin ? <><ShieldOff className="h-4 w-4 mr-1" />Revoke</> : <><ShieldCheck className="h-4 w-4 mr-1" />Promote</>}
            </Button>
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && <p className="text-muted-foreground py-4">No users.</p>}
    </div>
  );
}
