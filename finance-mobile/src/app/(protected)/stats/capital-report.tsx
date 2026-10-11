import { Redirect } from 'expo-router';

export default function LegacyCapitalStatisticsScreen() {
  return <Redirect href="/(protected)/(tabs)/stats" />;
}
