import {
  addMedicalRecord,
  getConsultationRequest,
  getPatientMedicalRecords,
  logRecordViewed,
  MEDICAL_RECORD_TYPE_LABELS,
  type MedicalRecordRow,
  type MedicalRecordType,
} from '@xolt/shared';
import { Badge, Button, Card, Input, Screen } from '@xolt/ui';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { supabase } from '@/lib/supabase';

function AddNoteForm({
  patientId,
  requestId,
  onAdded,
}: {
  patientId: string;
  requestId: string;
  onAdded: (record: MedicalRecordRow) => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const record = await addMedicalRecord(supabase, {
        patientId,
        requestId,
        recordType: 'consultation_note',
        title: title || undefined,
        content: { notes },
      });
      onAdded(record);
      setTitle('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this note.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <Card.Kicker>Add a note</Card.Kicker>
      <Input label="Title (optional)" value={title} onChangeText={setTitle} />
      <Input label="Notes" value={notes} onChangeText={setNotes} multiline numberOfLines={4} />
      <Button variant="primary" onPress={handleSubmit} disabled={submitting || notes.length === 0}>
        {submitting ? 'Saving…' : 'Add consultation note'}
      </Button>
      {error && <Card.Body>{error}</Card.Body>}
    </Card>
  );
}

export default function PatientRecordsScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [records, setRecords] = useState<MedicalRecordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (pid: string) => {
    try {
      const rows = await getPatientMedicalRecords(supabase, pid);
      setRecords(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load records.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getConsultationRequest(supabase, requestId)
      .then(async (request) => {
        if (cancelled || !request) return;
        setPatientId(request.patient_id);
        // Best-effort audit log — a missing 'viewed' entry shouldn't block
        // the doctor from seeing records they're already authorized for.
        logRecordViewed(supabase, request.patient_id).catch(() => {});
        await refresh(request.patient_id);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this request.');
      });

    return () => {
      cancelled = true;
    };
  }, [requestId, refresh]);

  if (error) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Card>
            <Card.Body>{error}</Card.Body>
          </Card>
        </View>
      </Screen>
    );
  }

  if (!patientId || records === null) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={records}
        keyExtractor={(record) => record.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <AddNoteForm
            patientId={patientId}
            requestId={requestId}
            onAdded={(record) => setRecords((prev) => [record, ...(prev ?? [])])}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Badge variant="neutral">
              {MEDICAL_RECORD_TYPE_LABELS[item.record_type as MedicalRecordType]}
            </Badge>
            <Card.Title>
              {item.title ?? MEDICAL_RECORD_TYPE_LABELS[item.record_type as MedicalRecordType]}
            </Card.Title>
            <Card.Meta>{new Date(item.created_at).toLocaleDateString()}</Card.Meta>
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
