import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReactiveClient } from '@dynamic-labs/react-hooks';
import { isAddress, parseEther } from 'viem';
import { dynamicClient } from '../../client';
import { EthFaceAvatar } from './EthFaceAvatar';

type NetworkOption = {
  name: string;
  chainId: number;
};

export function EthereumScreen() {
  const client = useReactiveClient(dynamicClient);
  const primaryWallet = client.wallets.primary;
  const authenticatedUser = client.auth.authenticatedUser;
  const evmNetworks = client.networks.evm ?? [];

  const networkOptions = useMemo<NetworkOption[]>(
    () =>
      evmNetworks.map((network: any) => ({
        name: network.name,
        chainId: Number(network.networkId ?? network.chainId),
      })),
    [evmNetworks]
  );

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState<string>('Loading...');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const selectedNetwork = useMemo(
    () => networkOptions.find((network) => network.chainId === selectedChainId) ?? null,
    [networkOptions, selectedChainId]
  );

  const userLabel =
    authenticatedUser?.email ||
    authenticatedUser?.verifiedCredentials?.find((item: any) => item.email)?.email ||
    authenticatedUser?.verifiedCredentials?.find((item: any) => item.publicIdentifier)
      ?.publicIdentifier ||
    'Connected user';

  const refreshWalletState = async () => {
    try {
      if (!primaryWallet) {
        setBalance('No wallet');
        setSelectedChainId(null);
        return;
      }

      setIsRefreshing(true);

      const [{ network }, walletBalance] = await Promise.all([
        dynamicClient.wallets.getNetwork({ wallet: primaryWallet }),
        dynamicClient.wallets.getBalance({ wallet: primaryWallet }),
      ]);

      setSelectedChainId(Number(network));
      setBalance(walletBalance?.balance ?? '0');
    } catch (error) {
      console.error('Failed to refresh wallet state', error);
      setBalance('Unavailable');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshWalletState();
  }, [primaryWallet?.address]);

  useEffect(() => {
    if (!selectedChainId && networkOptions.length > 0) {
      setSelectedChainId(networkOptions[0].chainId);
    }
  }, [selectedChainId, networkOptions]);

  const handleSwitchNetwork = async (chainId: number) => {
    try {
      if (!primaryWallet) {
        Alert.alert('Wallet missing', 'No primary wallet connected.');
        return;
      }

      setIsSwitching(true);

      await dynamicClient.wallets.switchNetwork({
        wallet: primaryWallet,
        chainId,
      });

      setSelectedChainId(chainId);
      await refreshWalletState();
    } catch (error: any) {
      console.error('Failed to switch network', error);
      Alert.alert('Network error', error?.message ?? 'Unable to switch network.');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSend = async () => {
    try {
      if (!primaryWallet) {
        Alert.alert('Wallet missing', 'No primary wallet connected.');
        return;
      }

      if (!to || !isAddress(to)) {
        Alert.alert('Invalid address', 'Please enter a valid EVM address.');
        return;
      }

      if (!amount || Number(amount) <= 0) {
        Alert.alert('Invalid amount', 'Please enter a valid amount.');
        return;
      }

      setIsSending(true);
      setTxHash(null);

      const { network } = await dynamicClient.wallets.getNetwork({
        wallet: primaryWallet,
      });

      const publicClient = dynamicClient.viem.createPublicClient({
        chain: { id: Number(network) } as any,
      });

      const walletClient = dynamicClient.viem.createWalletClient({
        wallet: primaryWallet,
      });

      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amount),
      });

      await publicClient.getTransactionReceipt({ hash });

      setTxHash(hash);
      setTo('');
      setAmount('');
      await refreshWalletState();

      Alert.alert('Transaction sent', `Hash: ${hash}`);
    } catch (error: any) {
      console.error('Failed to send transaction', error);
      Alert.alert('Transaction failed', error?.message ?? 'Unable to send transaction.');
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await dynamicClient.auth.logout();
    } catch (error: any) {
      console.error('Failed to logout', error);
      Alert.alert('Logout failed', error?.message ?? 'Unable to logout right now.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Ethereum Actions</Text>
          <Text style={styles.meta}>User: {userLabel}</Text>
          <Text style={styles.meta}>Network: {selectedNetwork?.name ?? 'Unknown'}</Text>
          <Text style={styles.meta}>Balance: {balance}</Text>

          <Text style={styles.label}>Address</Text>
          <Text selectable style={styles.address}>
            {primaryWallet?.address ?? 'No wallet connected'}
          </Text>
        </View>

        {/* <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose network</Text>

          <View style={styles.networkRow}>
            {networkOptions.map((network) => {
              const selected = selectedChainId === network.chainId;

              return (
                <Pressable
                  key={network.chainId}
                  onPress={() => handleSwitchNetwork(network.chainId)}
                  style={[styles.networkButton, selected && styles.networkButtonSelected]}
                >
                  <Text
                    style={[
                      styles.networkButtonText,
                      selected && styles.networkButtonTextSelected,
                    ]}
                  >
                    {network.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isSwitching ? (
            <View style={styles.inlineStatus}>
              <ActivityIndicator size="small" />
              <Text style={styles.inlineStatusText}>Switching network...</Text>
            </View>
          ) : null}
        </View> */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Send native crypto</Text>

          <Text style={styles.label}>To</Text>
          <TextInput
            style={styles.input}
            value={to}
            onChangeText={setTo}
            placeholder="0x..."
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.01"
            keyboardType="decimal-pad"
          />

          {isAddress(to, { strict: false }) ? (
            <View style={styles.avatarRow}>
              <EthFaceAvatar address={to} size={160} />
              <View style={styles.avatarMeta}>
                <Text style={styles.avatarTitle}>Recipient</Text>
                <Text style={styles.avatarAddress}>{to}</Text>
              </View>
            </View>
          ) : null}ks

          <Pressable
            style={[styles.primaryButton, (isSending || isSwitching) && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={isSending || isSwitching}
          >
            {isSending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Send</Text>
            )}
          </Pressable>

          {txHash ? (
            <>
              <Text style={styles.label}>Last transaction hash</Text>
              <Text selectable style={styles.hash}>
                {txHash}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryButton, isRefreshing && styles.buttonDisabled]}
            onPress={refreshWalletState}
            disabled={isRefreshing}
          >
            <Text style={styles.secondaryButtonText}>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.dangerButton, isLoggingOut && styles.buttonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.dangerButtonText}>Logout</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.hiddenWebview}>
        <dynamicClient.reactNative.WebView />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    fontSize: 14,
    color: '#374151',
  },
  label: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  address: {
    fontSize: 14,
    color: '#111827',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    color: '#111827',
  },
  networkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  networkButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
  },
  networkButtonSelected: {
    backgroundColor: '#111827',
  },
  networkButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  networkButtonTextSelected: {
    color: '#ffffff',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  dangerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#b91c1c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineStatusText: {
    color: '#4b5563',
    fontSize: 14,
  },
  hash: {
    fontSize: 13,
    color: '#111827',
  },
  hiddenWebview: {
    height: 1,
    width: 1,
    opacity: 0.01,
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  avatarRow: { flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around', gap: 12, paddingVertical: 4 },
  avatarMeta: { flex: 1, gap: 2 },
  avatarTitle: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  avatarAddress: { fontSize: 13, color: '#111827', fontFamily: 'monospace' },
});