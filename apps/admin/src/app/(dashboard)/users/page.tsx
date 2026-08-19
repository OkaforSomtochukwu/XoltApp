import { Badge, Card, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { searchUsers } from "@/lib/admin-queries";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const users = await searchUsers(supabase, q ?? "");

  return (
    <div className="stack">
      <h1>Users</h1>

      <form method="GET" className="row" style={{ gap: "var(--space-2)" }}>
        <Input name="q" placeholder="Search by name or email" defaultValue={q ?? ""} style={{ flex: 1 }} />
      </form>

      <p style={{ opacity: 0.7 }}>{users.length} result{users.length === 1 ? "" : "s"}</p>

      <div className="stack">
        {users.map((user) => (
          <Card key={user.id}>
            <Card.Kicker>{user.email}</Card.Kicker>
            <Card.Title>{user.full_name || "(no name set)"}</Card.Title>
            <div className="row" style={{ gap: "var(--space-2)" }}>
              <Badge variant={user.role === "doctor" ? "accent" : "neutral"}>{user.role}</Badge>
              {user.doctor_profile?.specialty && <Badge variant="outline">{user.doctor_profile.specialty}</Badge>}
            </div>
            {user.phone && <Card.Meta>{user.phone}</Card.Meta>}
            <Card.Meta>Joined {new Date(user.created_at).toLocaleDateString()}</Card.Meta>
          </Card>
        ))}
      </div>
    </div>
  );
}
