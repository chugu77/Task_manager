import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useStore } from '../src/store/useStore';

export default function RootLayout() {
  const { init, isLoading } = useStore();

  useEffect(() => {
    init();
  }, []);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
      </Stack>
    </>
  );
}
