import { Stack } from 'expo-router';

export default function RequestsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Incoming requests' }} />
      <Stack.Screen name="[requestId]" options={{ title: 'Request' }} />
      <Stack.Screen name="[requestId]/records" options={{ title: 'Patient records' }} />
      <Stack.Screen name="[requestId]/chat" options={{ title: 'Chat' }} />
      <Stack.Screen name="[requestId]/call" options={{ title: 'Call', headerShown: false }} />
    </Stack>
  );
}
