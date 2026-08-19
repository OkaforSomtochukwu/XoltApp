import {
  completeConsultationRequest,
  generateRequestOtp,
  getConsultationRequest,
  getPaymentForRequest,
  initPayment,
  subscribeToConsultationRequest,
  subscribeToPayments,
  verifyPayment,
  type ConsultationRequestRow,
  type PaymentRow,
} from '@xolt/shared';
import { Badge, Button, Card, ConsultationStatusCard, Screen } from '@xolt/ui';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { supabase } from '@/lib/supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

function PaymentStep({ requestId, amount }: { requestId: string; amount: number | null }) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setPaying(true);
    setError(null);
    try {
      const { authorization_url, reference } = await initPayment(supabase, requestId);
      await WebBrowser.openBrowserAsync(authorization_url);
      // The Paystack webhook (verify-payment) is the durable path — this is
      // just a fast check in case it's already landed by the time the
      // browser closes. The realtime subscription in the parent screen
      // catches it either way, whichever arrives.
      await verifyPayment(supabase, SUPABASE_URL, SUPABASE_ANON_KEY, reference);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment.');
    } finally {
      setPaying(false);
    }
  }

  return (
    <Card>
      <Card.Kicker>Consultation fee</Card.Kicker>
      <Card.Title>Payment required</Card.Title>
      <Badge variant="outline">Not yet paid</Badge>
      <Card.Body>
        {amount != null
          ? `Pay ₦${amount} to unlock this consultation.`
          : 'Pay the consultation fee to unlock this consultation.'}
      </Card.Body>
      <Button variant="primary" block onPress={handlePay} disabled={paying}>
        {paying ? 'Opening checkout…' : 'Pay now'}
      </Button>
      {error && <Card.Body>{error}</Card.Body>}
    </Card>
  );
}

function OtpStep({ requestId }: { requestId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const newCode = await generateRequestOtp(supabase, requestId);
      setCode(newCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a code.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Card>
      <Card.Kicker>Grant access</Card.Kicker>
      <Card.Title>Read this code to your doctor</Card.Title>
      {code ? (
        <>
          <Badge variant="accent">{code}</Badge>
          <Card.Body>
            Your doctor enters this code to unlock access to your medical records for this
            consultation. It expires in 10 minutes — generate a new one if it runs out.
          </Card.Body>
          <Button variant="secondary" onPress={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate a new code'}
          </Button>
        </>
      ) : (
        <>
          <Card.Body>
            Payment confirmed. Generate a code and read it to your doctor to grant them access
            for this consultation.
          </Card.Body>
          <Button variant="primary" block onPress={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate code'}
          </Button>
        </>
      )}
      {error && <Card.Body>{error}</Card.Body>}
    </Card>
  );
}

export default function RequestStatusScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ConsultationRequestRow | null>(null);
  const [payment, setPayment] = useState<PaymentRow | null>(null);
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

    Promise.all([getConsultationRequest(supabase, requestId), getPaymentForRequest(supabase, requestId)])
      .then(([requestRow, paymentRow]) => {
        if (cancelled) return;
        setRequest(requestRow);
        setPayment(paymentRow);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribeRequest = subscribeToConsultationRequest(supabase, requestId, (payload) => {
      if (payload.eventType === 'DELETE') return;
      setRequest(payload.new as ConsultationRequestRow);
    });
    const unsubscribePayments = subscribeToPayments(supabase, requestId, (payload) => {
      if (payload.eventType === 'DELETE') return;
      setPayment(payload.new as PaymentRow);
    });

    return () => {
      cancelled = true;
      unsubscribeRequest();
      unsubscribePayments();
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

  const needsPayment = request?.status === 'accepted' && payment?.status !== 'verified';
  const needsOtp = request?.status === 'accepted' && payment?.status === 'verified';
  const inProgress = request?.status === 'in_progress';

  return (
    <Screen>
      <View style={styles.centered}>
        {needsPayment ? (
          <PaymentStep requestId={requestId} amount={payment?.amount ?? null} />
        ) : needsOtp ? (
          <View style={styles.stack}>
            <Badge variant="accent">Payment confirmed</Badge>
            <OtpStep requestId={requestId} />
          </View>
        ) : (
          <View style={styles.stack}>
            {payment?.status === 'verified' && <Badge variant="accent">Payment confirmed</Badge>}
            <ConsultationStatusCard client={supabase} requestId={requestId} />
            {inProgress && (
              <>
                <Button variant="secondary" onPress={() => router.push('/records')}>
                  View my medical records
                </Button>
                <Button
                  variant="secondary"
                  onPress={() => router.push(`/find-doctor/request-status/${requestId}/chat`)}
                >
                  Chat with doctor
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
