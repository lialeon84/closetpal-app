import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ENTITLEMENT_ID,
  getCustomerInfo,
  restorePurchases,
  presentCustomerCenter,
} from '../lib/revenuecat';

export default function SubscriptionScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);

  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  const loadSubscriptionInfo = async () => {
    try {
      setLoading(true);
      const info = await getCustomerInfo();
      setCustomerInfo(info);

      if (info.entitlements.active[ENTITLEMENT_ID]) {
        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        setActiveSubscription({
          expirationDate: entitlement.expirationDate,
          willRenew: entitlement.willRenew,
          productId: entitlement.productIdentifier,
        });
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
      Alert.alert('Error', 'Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await presentCustomerCenter();
      // Refresh subscription info after Customer Center closes
      await loadSubscriptionInfo();
    } catch (error) {
      Alert.alert('Error', 'Unable to open subscription management.');
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      await restorePurchases();
      await loadSubscriptionInfo();
      Alert.alert('Success', 'Purchases restored successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigation.navigate('Paywall');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9b59b6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.brandSymbol}>🐾</Text>
            <Text style={styles.headerTitle}>Subscription</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {activeSubscription ? (
            <>
              <View style={styles.subscriptionCard}>
                <Text style={styles.tierIcon}>✨</Text>
                <Text style={styles.tierName}>Premium</Text>

                <View style={styles.statusContainer}>
                  <View style={[
                    styles.statusBadge,
                    activeSubscription.willRenew ? styles.activeBadge : styles.cancelledBadge,
                  ]}>
                    <Text style={styles.statusText}>
                      {activeSubscription.willRenew ? 'Active' : 'Cancelled'}
                    </Text>
                  </View>
                </View>

                {activeSubscription.expirationDate && (
                  <Text style={styles.renewalText}>
                    {activeSubscription.willRenew ? 'Renews on' : 'Expires on'}{' '}
                    {new Date(activeSubscription.expirationDate).toLocaleDateString()}
                  </Text>
                )}
              </View>

              <View style={styles.featuresCard}>
                <Text style={styles.featuresTitle}>Your Premium Benefits</Text>
                <View style={styles.feature}>
                  <Text style={styles.featureBullet}>✓</Text>
                  <Text style={styles.featureText}>Unlimited outfit suggestions</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureBullet}>✓</Text>
                  <Text style={styles.featureText}>AI personal stylist</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureBullet}>✓</Text>
                  <Text style={styles.featureText}>Virtual wardrobe sync</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureBullet}>✓</Text>
                  <Text style={styles.featureText}>Priority pet companion features</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureBullet}>✓</Text>
                  <Text style={styles.featureText}>Ad-free experience</Text>
                </View>
              </View>

              <Pressable style={styles.manageButton} onPress={handleManageSubscription}>
                <Text style={styles.manageButtonText}>Manage Subscription</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.noSubscriptionCard}>
                <Text style={styles.noSubIcon}>🐾</Text>
                <Text style={styles.noSubTitle}>Free Plan</Text>
                <Text style={styles.noSubText}>
                  Upgrade to Premium to unlock unlimited outfit suggestions, your AI stylist, and more
                </Text>
              </View>

              <Pressable style={styles.subscribeButton} onPress={handleUpgrade}>
                <Text style={styles.subscribeButtonText}>View Premium Plans ✨</Text>
              </Pressable>
            </>
          )}

          <Pressable style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </Pressable>

          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Need Help?</Text>
            <Text style={styles.supportText}>
              Contact us at support@closetpal.app for any subscription-related questions.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a1a',
  },
  header: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#9b59b6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    fontSize: 24,
    color: '#9b59b6',
    fontWeight: 'bold',
  },
  brandSymbol: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 28,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subscriptionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9b59b6',
    marginBottom: 20,
  },
  tierIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  tierName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  statusContainer: {
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadge: {
    backgroundColor: '#27ae60',
  },
  cancelledBadge: {
    backgroundColor: '#e74c3c',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  renewalText: {
    fontSize: 14,
    color: '#ccc',
  },
  featuresCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureBullet: {
    fontSize: 18,
    color: '#9b59b6',
    marginRight: 12,
    fontWeight: '700',
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
  },
  manageButton: {
    backgroundColor: '#2a2a3e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#9b59b6',
  },
  manageButtonText: {
    color: '#9b59b6',
    fontSize: 16,
    fontWeight: '600',
  },
  noSubscriptionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    marginBottom: 20,
  },
  noSubIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noSubTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  noSubText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
  },
  subscribeButton: {
    backgroundColor: '#9b59b6',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreButtonText: {
    color: '#9b59b6',
    fontSize: 14,
    fontWeight: '600',
  },
  supportCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  supportText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
