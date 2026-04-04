// useOpenPeepsAvatar.ts
import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';
import { useMemo } from 'react';

/**
 * Generates a deterministic Open Peeps SVG string from an Ethereum address.
 * DiceBear uses the address as seed → same address always gives same avatar.
 */
export function useOpenPeepsAvatar(address: string | null | undefined) {
  const svg = useMemo(() => {
    if (!address) return null;
    return createAvatar(lorelei, {
      seed: address,
      size: 256,
      backgroundColor: ['f9fafb'],
      backgroundType: ['solid'],
    }).toString();
  }, [address]);

  return { svg };
}
