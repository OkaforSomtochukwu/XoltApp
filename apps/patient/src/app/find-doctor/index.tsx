import { getAvailableDoctors, getCurrentLocation, type AvailableDoctor } from '@xolt/shared';
import { Badge, Button, Card, Screen } from '@xolt/ui';
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; doctors: AvailableDoctor[] };

export default function FindDoctorScreen() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });

  const refresh = useCallback(async () => {
    setLoad({ state: 'loading' });
    try {
      const { latitude, longitude } = await getCurrentLocation();
      const doctors = await getAvailableDoctors(supabase, latitude, longitude);
      setLoad({ state: 'ready', doctors });
    } catch (error) {
      setLoad({
        state: 'error',
        message: error instanceof Error ? error.message : 'Could not load nearby doctors.',
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
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
          <Card>
            <Card.Kicker>Couldn't load doctors</Card.Kicker>
            <Card.Body>{load.message}</Card.Body>
            <Button variant="secondary" onPress={refresh}>
              Try again
            </Button>
          </Card>
        </View>
      </Screen>
    );
  }

  if (load.doctors.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Card>
            <Card.Kicker>No doctors nearby</Card.Kicker>
            <Card.Body>No verified doctors are online within range right now.</Card.Body>
            <Button variant="secondary" onPress={refresh}>
              Refresh
            </Button>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={load.doctors}
        keyExtractor={(doctor) => doctor.doctor_id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Kicker>{item.specialty ?? 'General practice'}</Card.Kicker>
            <Card.Title>{item.full_name}</Card.Title>
            <Card.Meta>{`${item.distance_km.toFixed(1)} km away`}</Card.Meta>
            <View style={styles.row}>
              <Badge variant="accent">{`${item.years_of_experience ?? 0} yrs experience`}</Badge>
              {item.consultation_fee != null && (
                <Badge variant="neutral">{`₦${item.consultation_fee}`}</Badge>
              )}
            </View>
            <Button variant="primary" onPress={() => router.push(`/find-doctor/${item.doctor_id}`)}>
              View profile
            </Button>
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
