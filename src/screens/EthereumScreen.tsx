import { File, Paths } from 'expo-file-system';
import RNShare from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { SvgXml } from 'react-native-svg';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useOpenPeepsAvatar } from '../hooks/useOpenPeepsAvatar';

type NetworkOption = {
  name: string;
  chainId: number;
};

export function EthereumScreen() {
  const client            = useReactiveClient(dynamicClient);
  const primaryWallet     = client.wallets.primary;
  const authenticatedUser = client.auth.authenticatedUser;
  const evmNetworks       = client.networks.evm ?? [];

  const networkOptions = useMemo<NetworkOption[]>(
    () =>
      evmNetworks.map((network: any) => ({
        name:    network.name,
        chainId: Number(network.networkId ?? network.chainId),
      })),
    [evmNetworks]
  );

  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [to,            setTo]            = useState('');
  const [amount,        setAmount]        = useState('');
  const [balance,       setBalance]       = useState<string>('Loading...');
  const [txHash,        setTxHash]        = useState<string | null>(null);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const [isSending,     setIsSending]     = useState(false);
  const [isSwitching,   setIsSwitching]   = useState(false);
  const [isLoggingOut,  setIsLoggingOut]  = useState(false);
  const [isSharing,     setIsSharing]     = useState(false);

  const ownAddress = primaryWallet?.address ?? null;

  // Avatar SVGs — deterministic from each address
  const { svg: ownSvg }       = useOpenPeepsAvatar(ownAddress);
  const { svg: recipientSvg } = useOpenPeepsAvatar(
    isAddress(to, { strict: false }) ? to : null
  );

  // Ref on own avatar View — used by captureRef() to snapshot as PNG for share
  const ownAvatarRef = useRef<View>(null);

  const selectedNetwork = useMemo(
    () => networkOptions.find((n) => n.chainId === selectedChainId) ?? null,
    [networkOptions, selectedChainId]
  );

  const userLabel =
    authenticatedUser?.email ||
    authenticatedUser?.verifiedCredentials?.find((i: any) => i.email)?.email ||
    authenticatedUser?.verifiedCredentials?.find((i: any) => i.publicIdentifier)
      ?.publicIdentifier ||
    'Connected user';

  /* ---- wallet helpers ---- */

  const refreshWalletState = async () => {
    try {
      if (!primaryWallet) { setBalance('No wallet'); setSelectedChainId(null); return; }
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

  useEffect(() => { refreshWalletState(); }, [primaryWallet?.address]);

  useEffect(() => {
    if (!selectedChainId && networkOptions.length > 0)
      setSelectedChainId(networkOptions[0].chainId);
  }, [selectedChainId, networkOptions]);

  const handleSwitchNetwork = async (chainId: number) => {
    try {
      if (!primaryWallet) { Alert.alert('Wallet missing', 'No primary wallet connected.'); return; }
      setIsSwitching(true);
      await dynamicClient.wallets.switchNetwork({ wallet: primaryWallet, chainId });
      setSelectedChainId(chainId);
      await refreshWalletState();
    } catch (error: any) {
      Alert.alert('Network error', error?.message ?? 'Unable to switch network.');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSend = async () => {
    try {
      if (!primaryWallet)                          { Alert.alert('Wallet missing', 'No primary wallet connected.'); return; }
      if (!to || !isAddress(to, { strict: false })) { Alert.alert('Invalid address', 'Please enter a valid EVM address.'); return; }
      if (!amount || Number(amount) <= 0)           { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }
      setIsSending(true);
      setTxHash(null);
      const { network }  = await dynamicClient.wallets.getNetwork({ wallet: primaryWallet });
      const publicClient = dynamicClient.viem.createPublicClient({ chain: { id: Number(network) } as any });
      const walletClient = dynamicClient.viem.createWalletClient({ wallet: primaryWallet });
      const hash         = await walletClient.sendTransaction({ to: to as `0x${string}`, value: parseEther(amount) });
      await publicClient.getTransactionReceipt({ hash });
      setTxHash(hash);
      setTo('');
      setAmount('');
      await refreshWalletState();
      Alert.alert('Transaction sent', `Hash: ${hash}`);
    } catch (error: any) {
      Alert.alert('Transaction failed', error?.message ?? 'Unable to send transaction.');
    } finally {
      setIsSending(false);
    }
  };

  /* ---- share own address + avatar ---- */

  const handleShareAddress = async () => {
    if (!ownAddress || !ownSvg || isSharing) return;
    try {
      setIsSharing(true);

      // Capture the rendered SVG as a PNG file
      const pngUri   = await captureRef(ownAvatarRef, { format: 'png', quality: 1 });
      const safeName = ownAddress.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 12);
      const destFile = new File(Paths.cache, `peeps-${safeName}.png`);

      // Copy the temp snapshot into our named cache file
      await destFile.downloadContent(pngUri);

      await RNShare.open({
        url:     destFile.uri,
        message: ownAddress,
        type:    'image/png',
      });
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancel'))
        Alert.alert('Share failed', err?.message ?? 'Unable to share.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await dynamicClient.auth.logout();
    } catch (error: any) {
      Alert.alert('Logout failed', error?.message ?? 'Unable to logout right now.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  /* ---- render ---- */

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Own wallet card ── */}
        <View style={styles.card}>
          <Text style={styles.title}>Ethereum Actions</Text>
          <Text style={styles.meta}>User: {userLabel}</Text>
          <Text style={styles.meta}>Network: {selectedNetwork?.name ?? 'Unknown'}</Text>
          <Text style={styles.meta}>Balance: {balance}</Text>

          <Text style={styles.label}>Address</Text>
          <View style={styles.addressRow}>

            {/* Own avatar — collapsable={false} required for captureRef on Android */}
            <View
              ref={ownAvatarRef}
              style={styles.avatarThumb}
              collapsable={false}
            >
              {ownSvg
                ? <SvgXml xml={ownSvg} width={40} height={40} />
                : <View style={styles.avatarPlaceholder} />
              }
            </View>

            <Text selectable style={[styles.address, { flex: 1 }]} numberOfLines={1}>
              {ownAddress ?? 'No wallet connected'}
            </Text>

            {ownAddress && ownSvg ? (
              <Pressable
                onPress={handleShareAddress}
                disabled={isSharing}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed   && styles.shareButtonPressed,
                  isSharing && styles.shareButtonDisabled,
                ]}
                accessibilityLabel="Share my address"
                accessibilityRole="button"
              >
                {isSharing
                  ? <ActivityIndicator size="small" color="#ffffff" />
                  : <Text style={styles.shareButtonText}>↑ Share</Text>
                }
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── Network picker ── */}
        <View style={styles.card}>
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
                  <Text style={[styles.networkButtonText, selected && styles.networkButtonTextSelected]}>
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
        </View>

        {/* ── Send card ── */}
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

          {/* Recipient avatar — appears as soon as the address is valid */}
          {recipientSvg ? (
            <View style={styles.recipientRow}>
              <View style={styles.recipientAvatar}>
                <SvgXml xml={recipientSvg} width={128} height={128} />
              </View>
              <View style={styles.recipientMeta}>
                <Text style={styles.avatarTitle}>Recipient</Text>
                <Text style={styles.avatarAddress} numberOfLines={2}>{to}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.01"
            keyboardType="decimal-pad"
          />

          <Pressable
            style={[styles.primaryButton, (isSending || isSwitching) && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={isSending || isSwitching}
          >
            {isSending
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.primaryButtonText}>Send</Text>
            }
          </Pressable>

          {txHash ? (
            <>
              <Text style={styles.label}>Last transaction hash</Text>
              <Text selectable style={styles.hash}>{txHash}</Text>
            </>
          ) : null}
        </View>

        {/* ── Actions ── */}
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
            {isLoggingOut
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.dangerButtonText}>Logout</Text>
            }
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
  container:        { flex: 1, backgroundColor: '#ffffff' },
  content:          { padding: 16, gap: 16 },
  card:             { backgroundColor: '#f9fafb', borderRadius: 18, padding: 16, gap: 10 },
  title:            { fontSize: 24, fontWeight: '700', color: '#111827' },
  sectionTitle:     { fontSize: 18, fontWeight: '700', color: '#111827' },
  meta:             { fontSize: 14, color: '#374151' },
  label:            { marginTop: 4, fontSize: 13, fontWeight: '600', color: '#6b7280' },

  /* Own address row */
  addressRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarThumb:      { width: 40, height: 40, borderRadius: 6, overflow: 'hidden',
                      borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', flexShrink: 0 },
  avatarPlaceholder:{ width: 40, height: 40, backgroundColor: '#e5e7eb' },
  address:          { fontSize: 14, color: '#111827' },

  /* Share button */
  shareButton:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                      paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10,
                      backgroundColor: '#111827', minWidth: 72, minHeight: 32, flexShrink: 0 },
  shareButtonPressed:  { backgroundColor: '#374151' },
  shareButtonDisabled: { opacity: 0.55 },
  shareButtonText:  { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  /* Recipient avatar */
  recipientRow:     { flexDirection: 'column', alignItems: 'center', gap: 12,
                      backgroundColor: '#ffffff', borderRadius: 12, padding: 10,
                      borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  recipientAvatar:  { width: 128, height: 128, borderRadius: 10, overflow: 'hidden',
                      borderWidth: StyleSheet.hairlineWidth, borderColor: '#d1d5db', flexShrink: 0 },
  recipientMeta:    { flex: 1, gap: 4 },
  avatarTitle:      { fontSize: 12, fontWeight: '600', color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: 0.3 },
  avatarAddress:    { fontSize: 12, color: '#111827', fontFamily: 'monospace' },

  /* Inputs */
  input:            { minHeight: 48, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12,
                      backgroundColor: '#ffffff', paddingHorizontal: 12, color: '#111827' },

  /* Network */
  networkRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  networkButton:         { minHeight: 40, paddingHorizontal: 14, paddingVertical: 10,
                           borderRadius: 999, backgroundColor: '#e5e7eb', justifyContent: 'center' },
  networkButtonSelected: { backgroundColor: '#111827' },
  networkButtonText:     { color: '#111827', fontWeight: '600' },
  networkButtonTextSelected: { color: '#ffffff' },

  /* Buttons */
  primaryButton:     { minHeight: 50, borderRadius: 14, backgroundColor: '#111827',
                       alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  secondaryButton:   { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#374151',
                       alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  dangerButton:      { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#b91c1c',
                       alignItems: 'center', justifyContent: 'center' },
  dangerButtonText:  { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  actionRow:         { flexDirection: 'row', gap: 12 },
  buttonDisabled:    { opacity: 0.6 },

  /* Misc */
  inlineStatus:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineStatusText: { color: '#4b5563', fontSize: 14 },
  hash:             { fontSize: 13, color: '#111827' },
  hiddenWebview:    { height: 1, width: 1, opacity: 0.01, position: 'absolute', bottom: 0, right: 0 },
});
