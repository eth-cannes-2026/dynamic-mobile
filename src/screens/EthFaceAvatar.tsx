/**
 * EthFaceAvatar.tsx
 *
 * Displays the deterministic pixel-art face for a given Ethereum address.
 * Drop this component anywhere you want to show a visual identity badge.
 *
 * Props:
 *   address   — raw ETH address string (validated before rendering)
 *   size      — rendered width/height in dp  (default 96)
 *   style     — optional extra ViewStyle
 *
 * Example:
 *   <EthFaceAvatar address="0x742d35..." size={80} />
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { isAddress } from 'viem';
import { useEthFace } from '../hooks/useEthFace';

interface EthFaceAvatarProps {
  address: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function EthFaceAvatar({ address, size = 96, style }: EthFaceAvatarProps) {
  /* Only generate when the address passes the strict viem checksum test */
  const validAddress = isAddress(address) ? address : null;
  const { uri } = useEthFace(validAddress);

  /* Fade-in when the URI becomes ready */
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!uri) { opacity.setValue(0); return; }
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [uri]);

  if (!validAddress) return null;

  const radius = Math.round(size * 0.16);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width:        size,
          height:       size,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          resizeMode="stretch"   // PNG is already the exact right size
          fadeDuration={0}        // we handle our own fade
          accessibilityLabel={`Pixel avatar for address ${address.slice(0, 10)}…`}
        />
      ) : (
        /* Placeholder while computing (should be < 1 frame) */
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d1d5db',
    backgroundColor: '#f3f4f6',
  },
  placeholder: {
    backgroundColor: '#e5e7eb',
  },
});

/* =========================================================================
 * — INTEGRATION GUIDE FOR EthereumScreen.tsx —
 *
 * 1. Add this import at the top of the file:
 *
 *      import { EthFaceAvatar } from './EthFaceAvatar';
 *
 * 2. Replace the "Send native crypto" card with the version below.
 *    The only change is the <EthFaceAvatar> + its wrapper inserted between
 *    the "To" TextInput and the "Amount" label.
 * ========================================================================= */

/*
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

  {/* ↓ NEW: show recipient avatar as soon as the address is valid ↓ *\/}
  {isAddress(to) ? (
    <View style={styles.avatarRow}>
      <EthFaceAvatar address={to} size={80} />
      <View style={styles.avatarMeta}>
        <Text style={styles.avatarTitle}>Recipient</Text>
        <Text style={styles.avatarAddress} numberOfLines={1}>
          {to.slice(0, 6)}…{to.slice(-4)}
        </Text>
      </View>
    </View>
  ) : null}
  {/* ↑ END NEW ↑ *\/}

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
    {isSending ? (
      <ActivityIndicator color="#ffffff" />
    ) : (
      <Text style={styles.primaryButtonText}>Send</Text>
    )}
  </Pressable>

  {txHash ? (
    <>
      <Text style={styles.label}>Last transaction hash</Text>
      <Text selectable style={styles.hash}>{txHash}</Text>
    </>
  ) : null}
</View>
*/

/*
 * 3. Add these extra styles to your StyleSheet.create({…}):
 *
 *   avatarRow: {
 *     flexDirection: 'row',
 *     alignItems: 'center',
 *     gap: 12,
 *     paddingVertical: 4,
 *   },
 *   avatarMeta: {
 *     flex: 1,
 *     gap: 2,
 *   },
 *   avatarTitle: {
 *     fontSize: 13,
 *     fontWeight: '600',
 *     color: '#6b7280',
 *   },
 *   avatarAddress: {
 *     fontSize: 13,
 *     color: '#111827',
 *     fontFamily: 'monospace',   // or your mono font token
 *   },
 */
