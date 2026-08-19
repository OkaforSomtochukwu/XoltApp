import {
  getMyMedicalRecords,
  MEDICAL_RECORD_TYPE_LABELS,
  type MedicalRecordRow,
  type MedicalRecordType,
} from '@xolt/shared';
import { Badge, Button, Card, Screen } from '@xolt/ui';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; records: MedicalRecordRow[] };

export default function MedicalRecordsScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });

  const refresh = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const records = await getMyMedicalRecords(supabase);
      setLoad({ state: 'ready', records });
    } catch (error) {
      setLoad({
        state: 'error',
        message: error instanceof Error ? error.message : 'Could not load records.',
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const header = (
    <Button variant="secondary" onPress={() => router.push('/records/permissions')}>
      Permissions
    </Button>
  );

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
          {header}
          <Card>
            <Card.Body>{load.message}</Card.Body>
            <Button variant="secondary" onPress={refresh}>
              Try again
            </Button>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>{header}</View>
      {load.records.length === 0 ? (
        <View style={styles.centered}>
          <Card>
            <Card.Kicker>Medical records</Card.Kicker>
            <Card.Body>Nothing here yet — records your doctor adds will show up here.</Card.Body>
          </Card>
        </View>
      ) : (
        <FlatList
          data={load.records}
          keyExtractor={(record) => record.id}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={false}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <Badge variant="neutral">
                {MEDICAL_RECORD_TYPE_LABELS[item.record_type as MedicalRecordType]}
              </Badge>
              <Card.Title>{item.title ?? MEDICAL_RECORD_TYPE_LABELS[item.record_type as MedicalRecordType]}</Card.Title>
              <Card.Meta>{new Date(item.created_at).toLocaleDateString()}</Card.Meta>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },
  headerRow: {
    alignItems: 'flex-end',
    paddingBottom: 12,
  },
  list: {
    gap: 12,
    paddingBottom: 12,
  },
  card: {
    gap: 8,
  },
});
