import { getGrantsForPatient, revokeGrant, subscribeToGrantsForPatient, type GrantWithDoctor } from '@xolt/shared';
import { Badge, Button, Card, Screen } from '@xolt/ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; grants: GrantWithDoctor[] };

export default function PermissionsScreen() {
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function refresh(patientId: string) {
      try {
        const grants = await getGrantsForPatient(supabase, patientId);
        if (!cancelled) setLoad({ state: 'ready', grants });
      } catch (error) {
        if (!cancelled) {
          setLoad({
            state: 'error',
            message: error instanceof Error ? error.message : 'Could not load permissions.',
          });
        }
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      const patientId = data.user?.id;
      if (!patientId) return;
      refresh(patientId);
      unsubscribe = subscribeToGrantsForPatient(supabase, patientId, () => refresh(patientId));
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function handleRevoke(grantId: string) {
    setRevokingId(grantId);
    try {
      await revokeGrant(supabase, grantId);
      // The realtime subscription above refreshes the list either way.
    } catch (error) {
      console.warn('[permissions] could not revoke:', error);
    } finally {
      setRevokingId(null);
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

  if (load.grants.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Card>
            <Card.Kicker>Permissions</Card.Kicker>
            <Card.Body>No doctor has been granted access to your records yet.</Card.Body>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={load.grants}
        keyExtractor={(grant) => grant.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Title>{item.doctor?.full_name ?? 'A doctor'}</Card.Title>
            {item.status === 'granted' ? (
              <>
                <Badge variant="accent">Has access</Badge>
                <Card.Meta>{`Granted ${new Date(item.granted_at!).toLocaleDateString()}`}</Card.Meta>
                <Button
                  variant="secondary"
                  onPress={() => handleRevoke(item.id)}
                  disabled={revokingId === item.id}
                >
                  {revokingId === item.id ? 'Revoking…' : 'Revoke access'}
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline">Access revoked</Badge>
                <Card.Meta>{`Revoked ${new Date(item.revoked_at!).toLocaleDateString()}`}</Card.Meta>
              </>
            )}
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
});
