import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/groups/$groupId")({
  head: () => ({ meta: [{ title: "Group chat — Edu Awn" }] }),
  component: GroupChat,
});

type Message = {
  id: string;
  group_id: string;
  sender_id: string;
  sender_username: string;
  message: string;
  created_at: string;
};

function GroupChat() {
  const { groupId } = Route.useParams();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Initial load + realtime subscription
  useEffect(() => {
    let active = true;
    supabase.from("messages").select("*").eq("group_id", groupId).order("created_at").then(({ data }) => {
      if (active) setMessages((data as Message[]) ?? []);
    });
    const channel = supabase
      .channel(`messages:${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [groupId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user || !profile) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      group_id: groupId,
      sender_id: user.id,
      sender_username: profile.username,
      message: text.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="border-b px-4 py-3 flex items-center gap-3">
        <Button asChild size="icon" variant="ghost"><Link to="/groups"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h2 className="font-semibold">{group?.group_name ?? "Group"}</h2>
          <p className="text-xs text-muted-foreground">Code: {group?.private_code}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-12">No messages yet — say hi 👋</p>
        ) : messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <div className="text-xs font-medium opacity-70 mb-0.5">@{m.sender_username}</div>}
                <div className="whitespace-pre-wrap break-words text-sm">{m.message}</div>
                <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t p-3 flex gap-2 bg-background">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" autoFocus />
        <Button type="submit" disabled={sending || !text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}