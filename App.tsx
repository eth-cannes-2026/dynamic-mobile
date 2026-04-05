import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { useReactiveClient } from '@dynamic-labs/react-hooks';
import { dynamicClient } from './client';
import { EthereumScreen } from './src/screens/EthereumScreen';

export default function App() {
  const client = useReactiveClient(dynamicClient);
  const primaryWallet = client.wallets.primary;
  const userWallets = client.wallets.userWallets ?? [];
  const [showWalletScreen, setShowWalletScreen] = useState(false);

  const hasWallet = useMemo(
    () => Boolean(primaryWallet) || userWallets.length > 0,
    [primaryWallet, userWallets.length]
  );

  useEffect(() => {
    if (!hasWallet) {
      setShowWalletScreen(false);
      return;
    }
    const timer = setTimeout(() => setShowWalletScreen(true), 250);
    return () => clearTimeout(timer);
  }, [hasWallet]);

  const openAuth = async () => {
    try {
      await dynamicClient.ui.auth.show();
    } catch (error) {
      console.error('Failed to open auth UI', error);
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />

      {/* WebView toujours montée, cachée quand pas nécessaire */}
      <View style={showWalletScreen ? styles.webviewHidden : styles.webviewVisible}>
        <dynamicClient.reactNative.WebView />
      </View>

      {showWalletScreen ? (
        <EthereumScreen />
      ) : (
        <SafeAreaView style={styles.container}>
          <View style={styles.overlay}>
            <View style={styles.heroCard}>
              <Text style={styles.title}>Dynamic Ethereum Demo</Text>
              <Text style={styles.subtitle}>
                Connect with Google or Apple to access your wallet actions.
              </Text>

              <Pressable style={styles.primaryButton} onPress={openAuth}>
                <Text style={styles.primaryButtonText}>Open Dynamic Auth</Text>
              </Pressable>

              <View style={styles.statusRow}>
                {hasWallet ? (
                  <>
                    <ActivityIndicator size="small" />
                    <Text style={styles.statusText}>
                      Wallet detected, opening your dashboard...
                    </Text>
                  </>
                ) : (
                  <Text style={styles.statusText}>Waiting for connection</Text>
                )}
              </View>
            </View>
          </View>
        </SafeAreaView>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  // WebView visible sur l'écran de connexion (prend tout l'écran)
  webviewVisible: {
    flex: 1,
    ...StyleSheet.absoluteFillObject,
  },
  // WebView cachée mais toujours montée en mémoire (1x1 hors écran)
  webviewHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    bottom: 0,
    right: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  heroCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    fontSize: 14,
    color: '#374151',
  },
});