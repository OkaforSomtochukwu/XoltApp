import * as Device from 'expo-device';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDoctorAvailability } from '@/hooks/use-doctor-availability';
import { supabase } from '@/lib/supabase';
import { Badge, Button, Card, Input } from '@xolt/ui';

const VERIFICATION_COPY: Record<string, { title: string; body: string }> = {
  pending: {
    title: 'Verification pending',
    body: 'Your documents are submitted and waiting for review.',
  },
  under_review: {
    title: 'Under review',
    body: 'An admin is reviewing your verification right now.',
  },
  rejected: {
    title: 'Verification rejected',
    body: 'Your verification was rejected. Contact support to resubmit.',
  },
};

function AvailabilityCard() {
  const { verificationStatus, isOnline, updating, error, goOnline, goOffline } =
    useDoctorAvailability();

  if (verificationStatus === null) {
    return (
      <Card>
        <Card.Kicker>Availability</Card.Kicker>
        <Card.Title>Verification required</Card.Title>
        <Badge variant="outline">Can't go online yet</Badge>
        <Card.Body>
          You haven't submitted verification documents yet — you can't go online until you're
          verified.
        </Card.Body>
      </Card>
    );
  }

  if (verificationStatus !== 'verified') {
    const copy = VERIFICATION_COPY[verificationStatus];
    return (
      <Card>
        <Card.Kicker>Availability</Card.Kicker>
        <Card.Title>{copy.title}</Card.Title>
        <Badge variant="outline">Can't go online yet</Badge>
        <Card.Body>{copy.body}</Card.Body>
      </Card>
    );
  }

  return (
    <Card>
      <Card.Kicker>Availability</Card.Kicker>
      <Badge variant={isOnline ? 'accent' : 'neutral'}>{isOnline ? 'Online' : 'Offline'}</Badge>
      {error && <Card.Body>{error}</Card.Body>}
      <Button
        variant={isOnline ? 'secondary' : 'primary'}
        onPress={isOnline ? goOffline : goOnline}
        disabled={updating}
      >
        {updating ? 'Updating…' : isOnline ? 'Go offline' : 'Go online'}
      </Button>
    </Card>
  );
}

function DoctorSignupCard() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignUp() {
    setSubmitting(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: 'doctor', full_name: fullName } },
    });
    setSubmitting(false);
    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    setMessage(
      data.session
        ? `Signed up — session active for ${data.user?.email}.`
        : `Signed up — check email to confirm ${data.user?.email}.`,
    );
  }

  return (
    <Card>
      <Card.Kicker>Doctor signup</Card.Kicker>
      <Card.Title>Create a doctor account</Card.Title>
      <Badge variant="accent2">role: doctor</Badge>
      <Input label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button variant="primary" onPress={handleSignUp} disabled={submitting}>
        {submitting ? 'Signing up…' : 'Sign up'}
      </Button>
      {message && <Card.Body>{message}</Card.Body>}
    </Card>
  );
}

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}

        <View style={styles.dsPreview}>
          <AvailabilityCard />
          <DoctorSignupCard />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  dsPreview: {
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
