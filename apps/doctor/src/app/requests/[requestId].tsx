import {
  completeConsultationRequest,
  getConsultationRequest,
  subscribeToConsultationRequest,
  verifyRequestOtp,
  type ConsultationRequestRow,
} from '@xolt/shared';
import { Badge, Button, Card, ConsultationStatusCard, Input, Screen } from '@xolt/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { supabase } from '@/lib/supabase';

function EnterCodeStep({ requestId }: { requestId: string }) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setVerifying(true);
    setError(null);
    try {
      const granted = await verifyRequestOtp(supabase, requestId, code);
      if (!granted) {
        setError('That code is wrong or has expired — ask the patient to check or generate a new one.');
      }
      // On success the parent screen's realtime subscription picks up the
      // status change to in_progress and swaps this step out.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify that code.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Card>
      <Card.Kicker>Grant access</Card.Kicker>
      <Card.Title>Enter the patient's code</Card.Title>
      <Card.Body>
        Ask the patient to read out the code from their app to unlock access to their medical
        records for this consultation.
      </Card.Body>
      <Input
        label="Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        autoCapitalize="none"
      />
      <Button variant="primary" block onPress={handleSubmit} disabled={verifying || code.length === 0}>
        {verifying ? 'Verifying…' : 'Submit code'}
      </Button>
      {error && <Card.Body>{error}</Card.Body>}
    </Card>
  );
}

export default function ActiveRequestScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ConsultationRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  async function handleEndConsultation() {
    setEnding(true);
    setEndError(null);
    try {
      await completeConsultationRequest(supabase, requestId);
      // Parent screen's realtime subscription picks up the status change.
    } catch (err) {
      setEndError(err instanceof Error ? err.message : 'Could not end this consultation.');
    } finally {
      setEnding(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    getConsultationRequest(supabase, requestId)
      .then((row) => {
        if (!cancelled) {
          setRequest(row);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeToConsultationRequest(supabase, requestId, (payload) => {
      if (payload.eventType === 'DELETE') return;
      setRequest(payload.new as ConsultationRequestRow);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [requestId]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const needsCode = request?.status === 'accepted';
  const inProgress = request?.status === 'in_progress';

  return (
    <Screen>
      <View style={styles.centered}>
        {needsCode ? (
          <EnterCodeStep requestId={requestId} />
        ) : (
          <View style={styles.stack}>
            <ConsultationStatusCard client={supabase} requestId={requestId} />
            {inProgress && (
              <>
                <Badge variant="accent">Access granted</Badge>
                <Button
                  variant="primary"
                  onPress={() => router.push(`/requests/${requestId}/records`)}
                >
                  View patient records
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => router.push(`/requests/${requestId}/chat`)}
                >
                  Chat with patient
                </Button>
                <Button variant="ghost" onPress={handleEndConsultation} disabled={ending}>
                  {ending ? 'Ending…' : 'End consultation'}
                </Button>
                {endError && <Card.Body>{endError}</Card.Body>}
              </>
            )}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  stack: {
    gap: 12,
  },
});
