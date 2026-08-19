import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getVerificationQueue } from "@/lib/admin-queries";
import Link from "next/link";

export default async function VerificationQueuePage() {
  const supabase = await createClient();
  const queue = await getVerificationQueue(supabase);

  return (
    <div className="stack">
      <h1>Verification queue</h1>
      <p style={{ opacity: 0.7 }}>{queue.length} awaiting review, oldest first.</p>

      {queue.length === 0 ? (
        <Card>
          <Card.Body>Nothing waiting on review right now.</Card.Body>
        </Card>
      ) : (
        <div className="stack">
          {queue.map((v) => (
            <Link key={v.id} href={`/verifications/${v.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card>
                <Card.Kicker>{v.doctor?.email ?? v.doctor_id}</Card.Kicker>
                <Card.Title>{v.doctor?.full_name ?? "Unknown doctor"}</Card.Title>
                <Badge variant={v.status === "under_review" ? "accent" : "neutral"}>
                  {v.status === "under_review" ? "Under review" : "Pending"}
                </Badge>
                <Card.Meta>Submitted {new Date(v.submitted_at).toLocaleString()}</Card.Meta>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
