// Thin wrapper around the RevenueCatUI paywall component. Handles purchase completion,
// restore, and dismissal callbacks — syncs local subscription status and shows confirmation
// alerts before navigating back to the calling screen.
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RevenueCatUI from 'react-native-purchases-ui';
import { syncSubscriptionStatus, ENTITLEMENT_ID } from '../lib/revenuecat';

// Main screen component. Renders the full RevenueCatUI paywall and wires up all outcome callbacks.
export default function PaywallScreen({ navigation }) {
  // Syncs the RevenueCat customer info cache after a successful purchase, then shows
  // a welcome alert and navigates back.
  const handlePurchaseCompleted = async () => {
    // Forces a customer info refresh so useSubscription sees the new entitlement without waiting for the listener.
    await syncSubscriptionStatus();
    Alert.alert(
      'Welcome to Premium!',
      "You now have full access to all Ari's Closet features.",
      [{ text: 'Continue', onPress: () => navigation.goBack() }]
    );
  };

  // Syncs customer info after a restore attempt, then shows a contextual message:
  // success if the Premium entitlement is now active, otherwise "nothing to restore".
  const handleRestoreCompleted = async ({ customerInfo }) => {
    await syncSubscriptionStatus();
    // Double-bang converts to boolean; the entitlement may be absent even after a successful
    // restore call if the account had no prior purchases associated with it.
    const restored = !!customerInfo?.entitlements?.active[ENTITLEMENT_ID];
    Alert.alert(
      restored ? 'Purchases Restored' : 'Nothing to Restore',
      restored
        ? 'Your premium subscription is active again.'
        : 'No previous purchases were found for this account.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <RevenueCatUI.Paywall
        onPurchaseCompleted={handlePurchaseCompleted}
        onPurchaseCancelled={() => navigation.goBack()}
        onPurchaseError={({ error }) => console.error('Purchase error:', error)}
        onRestoreCompleted={handleRestoreCompleted}
        onRestoreError={({ error }) => console.error('Restore error:', error)}
        onDismiss={() => navigation.goBack()}
      />
    </SafeAreaView>
  );
}

// Styles for PaywallScreen — full-screen container for the RevenueCatUI paywall component.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
});
