import { Redirect } from 'expo-router';
import { useStore } from '../src/store/useStore';

export default function Index() {
  const { isAuthenticated, isLoading } = useStore();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/today" />;
  }

  return <Redirect href="/login" />;
}
