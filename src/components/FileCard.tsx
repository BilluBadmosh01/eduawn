import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase, STORAGE_BUCKET } from "@/integrations/supabase/client";
import { Download, Flag, Eye, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";

export type FileRow = {
  id: string;
  uploader_id: string;
  uploader_username: string;
  file_name: string;
  original_file_name: string;
  storage_path: string;
  file_type: string;
  uploaded_at: string;
};

function isImage(t: string) {
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(t.toLowerCase());
}
function isPdf(t: string) {
  return t.toLowerCase() === "pdf";
}

export function FileCard({ file }: { file: FileRow }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [openPreview, setOpenPreview] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isImage(file.file_type)) return;
    let active = true;
    supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storage_path, 3600).then(({ data }) => {
      if (active && data?.signedUrl) setPreviewUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [file.storage_path, file.file_type]);

  async function getSigned() {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(file.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Couldn't create download link");
      return null;
    }
    return data.signedUrl;
  }

  async function handleDownload() {
    const url = await getSigned();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = file.original_file_name;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handlePreview() {
    if (isPdf(file.file_type)) {
      const url = await getSigned();
      if (url) setPreviewUrl(url);
    }
    setOpenPreview(true);
  }

  async function submitReport() {
    if (!reason.trim()) return toast.error("Please provide a reason");
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      file_id: file.id,
      reporter_id: user.id,
      reporter_username: useAuth.getState().profile?.username ?? "unknown",
      reason: reason.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Report submitted. Thanks for keeping the community safe.");
    setOpenReport(false);
    setReason("");
  }

  async function handleDelete() {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setBusy(true);
    await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path]);
    const { error } = await supabase.from("files").delete().eq("id", file.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("File deleted");
    qc.invalidateQueries({ queryKey: ["files"] });
  }

  const canDelete = isAdmin || user?.id === file.uploader_id;
  const date = new Date(file.uploaded_at);

  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {isImage(file.file_type) && previewUrl ? (
          <img src={previewUrl} alt={file.file_name} className="w-full h-full object-cover" />
        ) : isPdf(file.file_type) ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileText className="h-12 w-12" />
            <span className="text-xs uppercase font-medium">PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-12 w-12" />
            <span className="text-xs uppercase font-medium">{file.file_type}</span>
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold truncate" title={file.file_name}>{file.file_name}</h3>
          <p className="text-xs text-muted-foreground">
            by @{file.uploader_username} · {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={handlePreview}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
          <Dialog open={openReport} onOpenChange={setOpenReport}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Flag className="h-4 w-4 mr-1" /> Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report this file</DialogTitle>
              </DialogHeader>
              <Textarea placeholder="Reason (spam, copyright, off-topic…)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenReport(false)}>Cancel</Button>
                <Button onClick={submitReport} disabled={busy}>Submit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={handleDelete} disabled={busy} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={openPreview} onOpenChange={setOpenPreview}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{file.file_name}</DialogTitle>
          </DialogHeader>
          {isImage(file.file_type) && previewUrl ? (
            <img src={previewUrl} alt={file.file_name} className="w-full max-h-[70vh] object-contain" />
          ) : isPdf(file.file_type) && previewUrl ? (
            <iframe src={previewUrl} className="w-full h-[70vh] border rounded" title={file.file_name} />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2" />
              <p>Preview unavailable. Download to view.</p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleDownload}><Download className="h-4 w-4 mr-1" />Download</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}