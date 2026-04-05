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
  appName: 'Face Wallet',
  evmNetworks: [
    {
      chainId: 11155111,
      chainName: "Sepolia",
      iconUrls: ["https://app.dynamic.xyz/assets/networks/eth.svg"],
      name: "Sepolia",
      nativeCurrency: {
        decimals: 18,
        name: "Sepolia Ether",
        symbol: "ETH",
        iconUrl: "https://app.dynamic.xyz/assets/networks/eth.svg",
      },
      networkId: 11155111,
      rpcUrls: ["https://sepolia.drpc.org"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
      vanityName: "Sepolia",
    },
  ],
})
  .extend(ReactNativeExtension({ appOrigin: 'http://localhost:8081', }))
  .extend(ViemExtension());