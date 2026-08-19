"use client";

import { Button, Textarea } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { approveVerificationAction, moveToReviewAction, rejectVerificationAction } from "./actions";

export function VerificationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  if (status === "verified" || status === "rejected") {
    return <p style={{ opacity: 0.7 }}>This verification is closed — no further action possible.</p>;
  }

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: "var(--space-2)" }}>
        <Button
          variant="primary"
          disabled={isPending}
          onClick={() => run(() => approveVerificationAction(id))}
        >
          Approve
        </Button>
        {status === "pending" && (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => run(() => moveToReviewAction(id))}
          >
            Move to review
          </Button>
        )}
        <Button variant="ghost" disabled={isPending} onClick={() => setShowReject((v) => !v)}>
          Reject
        </Button>
      </div>

      {showReject && (
        <div className="stack">
          <Textarea
            label="Rejection reason (shown to the doctor)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="primary"
            disabled={isPending || reason.trim().length === 0}
            onClick={() => run(() => rejectVerificationAction(id, reason.trim()))}
          >
            Confirm reject
          </Button>
        </div>
      )}
    </div>
  );
}
