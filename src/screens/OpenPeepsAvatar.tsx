// OpenPeepsAvatar.tsx
import RNShare from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import { SvgXml } from 'react-native-svg';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { isAddress } from 'viem';
import { useOpenPeepsAvatar } from '../hooks/useOpenPeepsAvatar';

interface OpenPeepsAvatarProps {
  address: string;
  size?:   number;
  style?:  StyleProp<ViewStyle>;
}

export function OpenPeepsAvatar({ address, size = 80, style }: OpenPeepsAvatarProps) {
  const validAddress     = isAddress(address, { strict: false }) ? address : null;
  const { svg }          = useOpenPeepsAvatar(validAddress);
  const avatarRef        = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!svg || !validAddress || sharing) return;
    try {
      setSharing(true);

      // Capture the rendered SVG view as a PNG file
      const uri = await captureRef(avatarRef, {
        format:  'png',
        quality: 1,
      });

      await RNShare.open({
        url:     uri,          // PNG image
        message: validAddress, // address text shown below the image
        type:    'image/png',
      });
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        Alert.alert('Share failed', err?.message ?? 'Unable to share.');
      }
    } finally {
      setSharing(false);
    }
  }, [svg, validAddress, sharing]);

  if (!validAddress || !svg) return null;

  return (
    <View style={[styles.wrapper, style]}>

      {/* Avatar — ref used by captureRef to snapshot the SVG as PNG */}
      <View
        ref={avatarRef}
        style={[styles.avatarFrame, { width: size, height: size, borderRadius: size * 0.16 }]}
        collapsable={false}   // required on Android for captureRef to work
      >
        <SvgXml xml={svg} width={size} height={size} />
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        <Text style={styles.metaLabel}>My address</Text>
        <Text style={styles.metaAddress} numberOfLines={1}>
          {validAddress.slice(0, 8)}…{validAddress.slice(-6)}
        </Text>

        <Pressable
          onPress={handleShare}
          disabled={sharing}
          style={({ pressed }) => [
            styles.shareButton,
            pressed  && styles.shareButtonPressed,
            sharing  && styles.shareButtonDisabled,
          ]}
          accessibilityLabel="Share my address"
          accessibilityRole="button"
        >
          {sharing
            ? <ActivityIndicator size="small" color="#ffffff" />
            : <Text style={styles.shareButtonText}>↑ Share</Text>
          }
        </Pressable>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           12,
  },
  avatarFrame: {
    overflow:        'hidden',
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     '#d1d5db',
    backgroundColor: '#f9fafb',
    flexShrink:      0,
  },
  meta: {
    flex: 1,
    gap:  4,
  },
  metaLabel: {
    fontSize:      12,
    fontWeight:    '600',
    color:         '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaAddress: {
    fontSize:   13,
    color:      '#111827',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  shareButton: {
    alignSelf:         'flex-start',
    marginTop:         4,
    paddingVertical:   6,
    paddingHorizontal: 14,
    borderRadius:      10,
    backgroundColor:   '#111827',
    minWidth:          72,
    minHeight:         32,
    alignItems:        'center',
    justifyContent:    'center',
  },
  shareButtonPressed: {
    backgroundColor: '#374151',
  },
  shareButtonDisabled: {
    opacity: 0.55,
  },
  shareButtonText: {
    color:      '#ffffff',
    fontSize:   13,
    fontWeight: '600',
  },
});
