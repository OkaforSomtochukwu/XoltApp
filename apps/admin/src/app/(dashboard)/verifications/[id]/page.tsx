import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getVerificationDetail, getVerificationDocuments } from "@/lib/admin-queries";
import { notFound } from "next/navigation";

import { VerificationActions } from "./VerificationActions";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  verified: "Verified",
  rejected: "Rejected",
};

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  medical_license: "Medical license",
  id_card: "ID card",
  specialty_certificate: "Specialty certificate",
  other: "Other",
};

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const verification = await getVerificationDetail(supabase, id);
  if (!verification) notFound();

  const documents = await getVerificationDocuments(supabase, id);

  return (
    <div className="stack">
      <Card>
        <Card.Kicker>{verification.doctor?.email}</Card.Kicker>
        <Card.Title>{verification.doctor?.full_name ?? "Unknown doctor"}</Card.Title>
        <Badge variant={verification.status === "verified" ? "accent" : "neutral"}>
          {STATUS_LABEL[verification.status]}
        </Badge>
        <Card.Meta>Submitted {new Date(verification.submitted_at).toLocaleString()}</Card.Meta>
        {verification.reviewed_at && (
          <Card.Meta>Reviewed {new Date(verification.reviewed_at).toLocaleString()}</Card.Meta>
        )}
        {verification.rejection_reason && <Card.Body>Rejection reason: {verification.rejection_reason}</Card.Body>}
        {verification.notes && <Card.Body>Notes: {verification.notes}</Card.Body>}
      </Card>

      <Card>
        <Card.Kicker>Documents</Card.Kicker>
        {documents.length === 0 ? (
          <Card.Body>No documents submitted.</Card.Body>
        ) : (
          <div className="stack">
            {documents.map((doc) => (
              <div key={doc.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  {DOCUMENT_TYPE_LABEL[doc.document_type] ?? doc.document_type}
                  {doc.file_name ? ` — ${doc.file_name}` : ""}
                </span>
                {doc.signedUrl ? (
                  <a href={doc.signedUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                ) : (
                  <span style={{ opacity: 0.6 }}>Unavailable</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Card.Kicker>Decision</Card.Kicker>
        <VerificationActions id={verification.id} status={verification.status} />
      </Card>
    </div>
  );
}
