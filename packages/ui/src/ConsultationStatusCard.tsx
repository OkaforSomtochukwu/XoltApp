import {
  CONSULTATION_STATUS_LABELS,
  getConsultationRequest,
  subscribeToConsultationRequest,
  type ConsultationRequestRow,
  type ConsultationStatus,
  type XoltSupabaseClient,
} from "@xolt/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { Badge, type BadgeVariant } from "./Badge";
import { Card } from "./Card";

const BADGE_VARIANT: Record<ConsultationStatus, BadgeVariant> = {
  pending: "neutral",
  accepted: "accent",
  declined: "outline",
  in_progress: "accent",
  completed: "accent2",
  cancelled: "outline",
};

const STATUS_DESCRIPTION: Record<ConsultationStatus, string> = {
  pending: "Waiting for the doctor to respond — this updates automatically.",
  accepted: "The doctor accepted this request.",
  declined: "The doctor declined this request.",
  in_progress: "This consultation is in progress.",
  completed: "This consultation is complete.",
  cancelled: "This request was cancelled.",
};

export type ConsultationStatusCardProps = {
  /** The app's own typed Supabase client — this component has no client of its own. */
  client: XoltSupabaseClient;
  requestId: string;
};

/**
 * Live status card for one consultation request — fetches once, then stays
 * current via Realtime. Shared by the patient's request-status screen and
 * the doctor's mirrored active-request screen: same data, same rendering.
 */
export function ConsultationStatusCard({ client, requestId }: ConsultationStatusCardProps) {
  const [request, setRequest] = useState<ConsultationRequestRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getConsultationRequest(client, requestId)
      .then((row) => {
        if (!cancelled) setRequest(row);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load request.");
      });

    const unsubscribe = subscribeToConsultationRequest(client, requestId, (payload) => {
      if (payload.eventType === "DELETE") return;
      setRequest(payload.new as ConsultationRequestRow);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, requestId]);

  if (error) {
    return (
      <Card>
        <Card.Body>{error}</Card.Body>
      </Card>
    );
  }

  if (!request) {
    return (
      <View>
        <ActivityIndicator />
      </View>
    );
  }

  const status = request.status as ConsultationStatus;

  return (
    <Card>
      <Card.Kicker>Request status</Card.Kicker>
      <Badge variant={BADGE_VARIANT[status]}>{CONSULTATION_STATUS_LABELS[status]}</Badge>
      <Card.Body>{STATUS_DESCRIPTION[status]}</Card.Body>
    </Card>
  );
}
