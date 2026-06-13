import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@tanstack/react-router";
import { useAuth } from "@/stores/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Edu Awn — Share academic resources with your peers" },
      { name: "description", content: "A student-built platform to share notes, slides and resources across devices, chat in private groups, and learn together." },
      { property: "og:title", content: "Edu Awn" },
      { property: "og:description", content: "Share academic resources, join private groups, and chat in real-time." },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  return <Navigate to={session ? "/dashboard" : "/auth"} replace />;
}
