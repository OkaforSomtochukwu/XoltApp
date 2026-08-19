import { Stack } from 'expo-router';

export default function FindDoctorLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Find a doctor' }} />
      <Stack.Screen name="[doctorId]" options={{ title: 'Doctor' }} />
      <Stack.Screen name="request-status/[requestId]" options={{ title: 'Request status' }} />
      <Stack.Screen name="request-status/[requestId]/chat" options={{ title: 'Chat' }} />
    </Stack>
  );
}
