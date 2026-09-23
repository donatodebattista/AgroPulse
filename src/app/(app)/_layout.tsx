import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/auth-context';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator size="large" color="#166534" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href={'/login' as any} />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#166534' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'AgroPulse',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
