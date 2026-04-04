import { createClient } from '@dynamic-labs/client';
import { ReactNativeExtension } from '@dynamic-labs/react-native-extension';
import { ViemExtension } from '@dynamic-labs/viem-extension';

const environmentId = process.env.EXPO_PUBLIC_CLIENT_ID;

if (!environmentId) {
  throw new Error('Missing EXPO_PUBLIC_CLIENT_ID');
}

export const dynamicClient = createClient({
  environmentId,
  appLogoUrl: 'https://demo.dynamic.xyz/favicon-32x32.png',
  appName: 'My App',

})
  .extend(ReactNativeExtension({ appOrigin: 'http://localhost:8081' }))
  .extend(ViemExtension());