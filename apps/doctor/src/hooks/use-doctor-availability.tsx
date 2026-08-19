import { getCurrentLocation } from '@xolt/shared';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected' | null;

export type DoctorAvailability = {
  /** null = signed out or no verification row submitted yet. */
  verificationStatus: VerificationStatus;
  isOnline: boolean;
  updating: boolean;
  error: string | null;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
};

const DoctorAvailabilityContext = createContext<DoctorAvailability>({
  verificationStatus: null,
  isOnline: false,
  updating: false,
  error: null,
  goOnline: async () => {},
  goOffline: async () => {},
});

async function fetchVerificationStatus(doctorId: string): Promise<VerificationStatus> {
  const { data } = await supabase
    .from('doctor_verifications')
    .select('status')
    .eq('doctor_id', doctorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.status as VerificationStatus) ?? null;
}

/**
 * Owns the doctor's online/offline state for the whole app. Goes online
 * automatically on sign-in — but only if already verified; an unverified
 * doctor stays offline with their verification status exposed so the UI can
 * show *why*, not just a disabled toggle. Mount once at the app root;
 * everything else reads/acts via useDoctorAvailability().
 */
export function DoctorAvailabilityProvider({ children }: { children: ReactNode }) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = useRef<string | null>(null);

  async function goOnline() {
    const id = userId.current;
    if (!id) return;
    setUpdating(true);
    setError(null);
    try {
      const status = await fetchVerificationStatus(id);
      setVerificationStatus(status);
      if (status !== 'verified') {
        setIsOnline(false);
        return;
      }
      const { latitude, longitude } = await getCurrentLocation();
      const { error: upsertError } = await supabase.from('doctor_profiles').upsert({
        id,
        is_online: true,
        last_lat: latitude,
        last_lng: longitude,
        last_location_updated_at: new Date().toISOString(),
      });
      if (upsertError) throw upsertError;
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
      setError(err instanceof Error ? err.message : 'Could not go online.');
    } finally {
      setUpdating(false);
    }
  }

  async function goOffline() {
    const id = userId.current;
    if (!id) return;
    setUpdating(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('doctor_profiles')
        .update({ is_online: false })
        .eq('id', id);
      if (updateError) throw updateError;
      setIsOnline(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not go offline.');
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function handleSignedIn(id: string) {
      userId.current = id;
      const status = await fetchVerificationStatus(id);
      if (cancelled) return;
      setVerificationStatus(status);
      if (status === 'verified') {
        await goOnline();
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const id = data.session?.user.id;
      if (id) handleSignedIn(id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user.id) {
        handleSignedIn(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        const id = userId.current;
        userId.current = null;
        setIsOnline(false);
        setVerificationStatus(null);
        setError(null);
        // Best-effort — see goOffline() for the caveat on session/token expiry.
        if (id) supabase.from('doctor_profiles').update({ is_online: false }).eq('id', id);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DoctorAvailabilityContext.Provider
      value={{ verificationStatus, isOnline, updating, error, goOnline, goOffline }}
    >
      {children}
    </DoctorAvailabilityContext.Provider>
  );
}

export function useDoctorAvailability(): DoctorAvailability {
  return useContext(DoctorAvailabilityContext);
}
