import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getHealthCheck, getRecentPayments, getRecentRequests } from "@/lib/admin-queries";

const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const REQUEST_STATUS_VARIANT: Record<string, "accent" | "accent2" | "neutral" | "outline"> = {
  pending: "neutral",
  accepted: "accent",
  declined: "outline",
  in_progress: "accent",
  completed: "accent2",
  cancelled: "outline",
};

export default async function ActivityOverviewPage() {
  const supabase = await createClient();
  const [requests, payments, health] = await Promise.all([
    getRecentRequests(supabase),
    getRecentPayments(supabase),
    getHealthCheck(supabase),
  ]);

  const hasIssues = health.stuckPending.length > 0 || health.stuckAccepted.length > 0 || health.failedPayments.length > 0;

  return (
    <div className="stack">
      <h1>Activity</h1>

      <Card>
        <Card.Kicker>Health check</Card.Kicker>
        {!hasIssues ? (
          <Card.Body>Nothing stuck — all requests and payments look healthy.</Card.Body>
        ) : (
          <div className="stack">
            {health.stuckPending.length > 0 && (
              <div>
                <Card.Body>
                  {health.stuckPending.length} request{health.stuckPending.length === 1 ? "" : "s"} pending
                  with no doctor response for over 30 minutes:
                </Card.Body>
                {health.stuckPending.map((r) => (
                  <div key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                    <span>
                      {r.patient?.full_name ?? "?"} → {r.doctor?.full_name ?? "?"}
                    </span>
                    <span style={{ opacity: 0.6 }}>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {health.stuckAccepted.length > 0 && (
              <div>
                <Card.Body>
                  {health.stuckAccepted.length} accepted request{health.stuckAccepted.length === 1 ? "" : "s"}{" "}
                  unpaid for over an hour:
                </Card.Body>
                {health.stuckAccepted.map((r) => (
                  <div key={r.id} className="row" style={{ justifyContent: "space-between" }}>
                    <span>
                      {r.patient?.full_name ?? "?"} → {r.doctor?.full_name ?? "?"}
                    </span>
                    <span style={{ opacity: 0.6 }}>{r.accepted_at && new Date(r.accepted_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {health.failedPayments.length > 0 && (
              <div>
                <Card.Body>{health.failedPayments.length} failed payment{health.failedPayments.length === 1 ? "" : "s"}:</Card.Body>
                {health.failedPayments.map((p) => (
                  <div key={p.id} className="row" style={{ justifyContent: "space-between" }}>
                    <span>
                      {p.patient?.full_name ?? "?"} — ₦{p.amount}
                    </span>
                    <span style={{ opacity: 0.6 }}>{new Date(p.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <Card.Kicker>Recent requests</Card.Kicker>
        <div className="stack">
          {requests.map((r) => (
            <div key={r.id} className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {r.patient?.full_name ?? "?"} → {r.doctor?.full_name ?? "?"}
              </span>
              <div className="row" style={{ gap: "var(--space-2)", alignItems: "center" }}>
                <Badge variant={REQUEST_STATUS_VARIANT[r.status] ?? "neutral"}>
                  {REQUEST_STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                <span style={{ opacity: 0.6, fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Card.Kicker>Recent payments</Card.Kicker>
        <div className="stack">
          {payments.map((p) => (
            <div key={p.id} className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span>
                {p.patient?.full_name ?? "?"} → {p.doctor?.full_name ?? "?"} — ₦{p.amount}
              </span>
              <div className="row" style={{ gap: "var(--space-2)", alignItems: "center" }}>
                <Badge variant={p.status === "verified" ? "accent" : p.status === "failed" ? "outline" : "neutral"}>
                  {p.status}
                </Badge>
                <span style={{ opacity: 0.6, fontSize: 12 }}>{new Date(p.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
