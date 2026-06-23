import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileCard, type FileRow } from "@/components/FileCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BookOpen, Smartphone, Users, MessageCircle, Sparkles, ShieldCheck, FileQuestion } from "lucide-react";

const features = [
  { title: "Academic File Sharing", desc: "Upload notes, slides, and study material in seconds.", icon: BookOpen },
  { title: "Cross-Device Access", desc: "Sign in once — your resources follow you everywhere.", icon: Smartphone },
  { title: "Private Groups", desc: "Create study circles with private invite codes.", icon: Users },
  { title: "Real-Time Chat", desc: "Discuss problems with classmates the instant they happen.", icon: MessageCircle },
  { title: "Community Learning", desc: "Built by students — every upload helps someone else.", icon: Sparkles },
  { title: "Secure Reporting", desc: "Flag inappropriate content; admins keep the feed clean.", icon: ShieldCheck },
];

export default function Dashboard() {
  useEffect(() => { document.title = "Dashboard — Edu Awn"; }, []);
  const { data, isLoading } = useQuery({
    queryKey: ["files"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return data as FileRow[];
    },
  });

  return (
    <div className="p-4 sm:p-6 max-w-[1800px] mx-auto space-y-8">
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Recent uploads</h1>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">Files</p>
      <p className="text-2xl font-bold">{data?.length ?? 0}</p>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">Smartboard Files</p>
      <p className="text-2xl font-bold">
        {data?.filter(f => f.file_type === "enb").length ?? 0}
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">PDF Files</p>
      <p className="text-2xl font-bold">
        {data?.filter(f => f.file_type === "pdf").length ?? 0}
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardContent className="p-4">
      <p className="text-sm text-muted-foreground">Images</p>
      <p className="text-2xl font-bold">
        {data?.filter(f =>
          ["jpg","jpeg","png","gif","webp"].includes(f.file_type)
        ).length ?? 0}
      </p>
    </CardContent>
  </Card>
</div>
      <span className="text-sm text-muted-foreground">
  {data?.length ?? 0} files
</span>
        </div>
        {isLoading ? (
         <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <FileQuestion className="h-12 w-12 mx-auto" />
              <p className="font-medium">No uploads yet</p>
              <p className="text-sm">Be the first to share something with your peers.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {data.map((f) => <FileCard key={f.id} file={f} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Why Edu Awn?</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <Card key={f.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-2">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
