import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RevenueCatUI from 'react-native-purchases-ui';
import { syncSubscriptionStatus } from '../lib/revenuecat';

export default function PaywallScreen({ navigation }) {
  const handlePurchaseCompleted = async () => {
    await syncSubscriptionStatus();
    navigation.goBack();
  };

  const handleRestoreCompleted = async () => {
    await syncSubscriptionStatus();
    navigation.goBack();
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
    backgroundColor: '#0a0a1a',
  },
});
