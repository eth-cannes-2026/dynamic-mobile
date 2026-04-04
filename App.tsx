import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { createClient } from "@dynamic-labs/client";
import { ReactNativeExtension } from "@dynamic-labs/react-native-extension";
import { ViemExtension } from "@dynamic-labs/viem-extension";

console.log("Client ID:", process.env.EXPO_PUBLIC_CLIENT_ID);
export const dynamicClient = createClient({
  environmentId: process.env.EXPO_PUBLIC_CLIENT_ID!,
  // Optional:
  appLogoUrl: "https://demo.dynamic.xyz/favicon-32x32.png",
  appName: "Face wallet",
})
  .extend(ReactNativeExtension())
  .extend(ViemExtension());

export function App() {
  return (
    <>
      <dynamicClient.reactNative.WebView />

      <SafeAreaView>
        <Text>Hello, world!</Text>
      </SafeAreaView>
    </>
  );
}
