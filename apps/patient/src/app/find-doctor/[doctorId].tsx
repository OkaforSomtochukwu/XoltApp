import {
  createConsultationRequest,
  getCurrentLocation,
  getDoctorProfile,
  type DoctorProfileDetail,
} from '@xolt/shared';
import { Badge, Button, Card, Screen } from '@xolt/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { supabase } from '@/lib/supabase';

type LoadState =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; doctor: DoctorProfileDetail };

export default function DoctorDetailScreen() {
  const { doctorId } = useLocalSearchParams<{ doctorId: string }>();
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ state: 'loading' });
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDoctorProfile(supabase, doctorId)
      .then((doctor) => {
        if (cancelled) return;
        if (!doctor) {
          setLoad({ state: 'error', message: 'This doctor is not available right now.' });
        } else {
          setLoad({ state: 'ready', doctor });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoad({
            state: 'error',
            message: error instanceof Error ? error.message : 'Could not load this doctor.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId]);

  async function handleRequest() {
    setRequesting(true);
    setRequestError(null);
    try {
      const location = await getCurrentLocation();
      const request = await createConsultationRequest(supabase, { doctorId, location });
      router.push(`/find-doctor/request-status/${request.id}`);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Could not send the request.');
    } finally {
      setRequesting(false);
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

  const { doctor } = load;

  return (
    <Screen scroll>
      <View style={styles.stack}>
        <Card>
          <Card.Kicker>{doctor.specialty ?? 'General practice'}</Card.Kicker>
          <Card.Title>{doctor.full_name}</Card.Title>
          <View style={styles.row}>
            <Badge variant="accent">{`${doctor.years_of_experience ?? 0} yrs experience`}</Badge>
            {doctor.consultation_fee != null && (
              <Badge variant="neutral">{`₦${doctor.consultation_fee}`}</Badge>
            )}
          </View>
          {doctor.bio && <Card.Body>{doctor.bio}</Card.Body>}
        </Card>

        {(doctor.clinic_name || doctor.clinic_address) && (
          <Card>
            <Card.Kicker>Clinic</Card.Kicker>
            {doctor.clinic_name && <Card.Title>{doctor.clinic_name}</Card.Title>}
            {doctor.clinic_address && <Card.Body>{doctor.clinic_address}</Card.Body>}
          </Card>
        )}

        <Button variant="primary" block onPress={handleRequest} disabled={requesting}>
          {requesting ? 'Requesting…' : 'Request this doctor'}
        </Button>
        {requestError && (
          <Card>
            <Card.Body>{requestError}</Card.Body>
          </Card>
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
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
