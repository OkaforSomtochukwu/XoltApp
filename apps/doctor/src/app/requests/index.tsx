import {
  getIncomingConsultationRequests,
  respondToConsultationRequest,
  subscribeToConsultationRequests,
  type IncomingConsultationRequest,
} from '@xolt/shared';
import { Badge, Button, Card, Screen } from '@xolt/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; requests: IncomingConsultationRequest[] };

export default function IncomingRequestsScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const refresh = useCallback(async (doctorId: string) => {
    setLoad({ state: 'loading' });
    try {
      const requests = await getIncomingConsultationRequests(supabase, doctorId);
      setLoad({ state: 'ready', requests });
    } catch (error) {
      setLoad({
        state: 'error',
        message: error instanceof Error ? error.message : 'Could not load requests.',
      });
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    supabase.auth.getSession().then(({ data }) => {
      const doctorId = data.session?.user.id;
      if (!doctorId) return;
      refresh(doctorId);
      unsubscribe = subscribeToConsultationRequests(supabase, { doctorId }, () => {
        // Any change to this doctor's requests (new pending, one responded to
        // elsewhere/on another device) — just refetch rather than patch state
        // in place, the list is small and this keeps the embed intact.
        refresh(doctorId);
      });
    });

    return () => unsubscribe?.();
  }, [refresh]);

  async function handleRespond(requestId: string, decision: 'accepted' | 'declined') {
    setRespondingId(requestId);
    try {
      await respondToConsultationRequest(supabase, requestId, decision);
      if (decision === 'accepted') {
        router.push(`/requests/${requestId}`);
      }
      // The realtime subscription above will refresh the list either way.
    } catch (error) {
      console.warn('[requests] could not respond:', error);
    } finally {
      setRespondingId(null);
    }
  }

  if (load.state === 'loading') {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (load.state === 'error') {
    return (
      <Screen>
        <View style={styles.centered}>
          <Card>
            <Card.Body>{load.message}</Card.Body>
          </Card>
        </View>
      </Screen>
    );
  }

  if (load.requests.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Card>
            <Card.Kicker>Incoming requests</Card.Kicker>
            <Card.Body>No pending requests right now — new ones appear here automatically.</Card.Body>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={load.requests}
        keyExtractor={(request) => request.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Kicker>New request</Card.Kicker>
            <Card.Title>{item.patient?.full_name ?? 'A patient'}</Card.Title>
            <Badge variant="neutral">Waiting for your response</Badge>
            <View style={styles.row}>
              <Button
                variant="primary"
                onPress={() => handleRespond(item.id, 'accepted')}
                disabled={respondingId === item.id}
              >
                Accept
              </Button>
              <Button
                variant="secondary"
                onPress={() => handleRespond(item.id, 'declined')}
                disabled={respondingId === item.id}
              >
                Decline
              </Button>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  list: {
    gap: 12,
    paddingVertical: 12,
  },
  card: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
