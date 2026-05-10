import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RevenueCatUI from 'react-native-purchases-ui';
import { syncSubscriptionStatus, ENTITLEMENT_ID } from '../lib/revenuecat';

export default function PaywallScreen({ navigation }) {
  const handlePurchaseCompleted = async () => {
    await syncSubscriptionStatus();
    Alert.alert(
      'Welcome to Premium!',
      "You now have full access to all Ari's Closet features.",
      [{ text: 'Continue', onPress: () => navigation.goBack() }]
    );
  };

  const handleRestoreCompleted = async ({ customerInfo }) => {
    await syncSubscriptionStatus();
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
});
