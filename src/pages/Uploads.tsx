import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload as UploadIcon, FileCheck } from "lucide-react";
import { supabase, STORAGE_BUCKET } from "@/integrations/supabase/client";
import { useAuth } from "@/stores/auth";
import { toast } from "sonner";

const ALLOWED = ["jpg", "jpeg", "png", "ppt", "pptx", "doc", "docx", "pdf", "xls", "xlsx", "swb", "iwb", "notebook", "enb"];

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function Uploads() {
  useEffect(() => { document.title = "Upload — Edu Awn"; }, []);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | null) {
    if (!f) return;
    const e = extOf(f.name);
    if (!ALLOWED.includes(e)) {
      toast.error(`Unsupported file type: .${e}`);
      return;
    }
    setFile(f);
    if (!displayName) setDisplayName(f.name.replace(/\.[^.]+$/, ""));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pick a file first");
    if (!displayName.trim()) return toast.error("File name is required");
    if (!user || !profile) return toast.error("Not signed in");

    setBusy(true);
    setProgress(10);
    const ext = extOf(file.name);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    setProgress(70);
    if (upErr) {
      setBusy(false); setProgress(0);
      return toast.error(upErr.message);
    }
    const { error: insErr } = await supabase.from("files").insert({
      uploader_id: user.id,
      uploader_username: profile.username,
      file_name: displayName.trim(),
      original_file_name: file.name,
      storage_path: path,
      file_type: ext,
    });
    setProgress(100);
    setBusy(false);
    if (insErr) {
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      return toast.error(insErr.message);
    }
    toast.success("Uploaded!");
    navigate("/dashboard");
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Upload a resource</CardTitle>
          <CardDescription>Share notes, slides, PDFs, or whiteboard files with the community.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">File name <span className="text-destructive">*</span></Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Calculus chapter 4 summary" required />
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0] ?? null); }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
            >
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept={ALLOWED.map((e) => "." + e).join(",")}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="space-y-1">
                  <FileCheck className="h-10 w-10 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB · click to change</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <UploadIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drop a file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Allowed: {ALLOWED.join(", ")}</p>
                </div>
              )}
            </div>

            {busy && <Progress value={progress} />}

            <Button type="submit" disabled={busy || !file} className="w-full">
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
