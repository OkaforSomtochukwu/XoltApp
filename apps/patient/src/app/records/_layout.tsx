import { Stack } from 'expo-router';

export default function RecordsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Medical records' }} />
      <Stack.Screen name="permissions" options={{ title: 'Permissions' }} />
    </Stack>
  );
}
