import { getVideoToken } from '@xolt/shared';
import { Screen, VideoCallView } from '@xolt/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';

export default function DoctorCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();

  const getToken = useCallback(() => getVideoToken(supabase, requestId), [requestId]);

  return (
    <Screen edges={['top', 'bottom']}>
      <VideoCallView getToken={getToken} onLeave={() => router.back()} />
    </Screen>
  );
}
