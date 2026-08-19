import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DoctorAvailabilityProvider } from '@/hooks/use-doctor-availability';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    // Owns online/offline + verification-gating for the whole app's
    // lifetime — goes online automatically on sign-in once verified, and
    // exposes goOnline/goOffline for the manual toggle.
    <DoctorAvailabilityProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </ThemeProvider>
    </DoctorAvailabilityProvider>
  );
}
