import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Button, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useReactiveClient } from '@dynamic-labs/react-hooks';
import { dynamicClient } from './client';

function WalletInfo() {
  // Read reactive wallet state from Dynamic
  const client = useReactiveClient(dynamicClient);
  const primaryWallet = client.wallets.primary;
  const userWallets = client.wallets.userWallets;

  if (!primaryWallet && (!userWallets || userWallets.length === 0)) {
    return <Text>No wallet connected</Text>;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Primary wallet</Text>
      <Text selectable>{primaryWallet?.address ?? 'None'}</Text>

      <Text style={[styles.label, { marginTop: 12 }]}>All wallets</Text>
      {userWallets.map((wallet) => (
        <Text key={wallet.id} selectable>
          {wallet.address}
        </Text>
      ))}
    </View>
  );
}

export default function App() {
  const openAuth = async () => {
    try {
      await dynamicClient.ui.auth.show();
    } catch (error) {
      console.error('Failed to open auth UI', error);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />

        <View style={styles.webviewContainer}>
          <dynamicClient.reactNative.WebView />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Hello from Dynamic!</Text>
          <Button title="Open Dynamic Auth" onPress={openAuth} />
          <WalletInfo />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webviewContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  card: {
    marginTop: 12,
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
  },
});