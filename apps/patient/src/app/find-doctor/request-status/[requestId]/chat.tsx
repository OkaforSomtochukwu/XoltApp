import { getConsultationRequest, type ConsultationRequestRow } from '@xolt/shared';
import { ChatView, Screen } from '@xolt/ui';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { supabase } from '@/lib/supabase';

export default function PatientChatScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const [request, setRequest] = useState<ConsultationRequestRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getConsultationRequest(supabase, requestId), supabase.auth.getUser()]).then(
      ([requestRow, { data }]) => {
        if (cancelled) return;
        setRequest(requestRow);
        setUserId(data.user?.id ?? null);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (!request || !userId) {
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
      <ChatView
        client={supabase}
        requestId={requestId}
        currentUserId={userId}
        canSend={request.status === 'in_progress'}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
});
