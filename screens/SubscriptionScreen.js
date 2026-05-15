// Subscription status and management screen. Shows the active premium plan (tier, renewal
// date, active/cancelled badge) or an upgrade prompt for free users. Delegates to RevenueCat
// for customer info, purchase restoration, and the Customer Center management flow.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ENTITLEMENT_ID,
  getCustomerInfo,
  restorePurchases,
  presentCustomerCenter,
} from '../lib/revenuecat';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

// Main screen component. Fetches subscription status on mount and renders the active-plan
// view or the free-tier upgrade prompt depending on whether an entitlement is found.
export default function SubscriptionScreen({ navigation }) {
  // RevenueCat customer info object, initial-load flag, and extracted entitlement details.
  const [loading, setLoading] = useState(true);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(null);

  // Fetch subscription status once on mount.
  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  // Fetches RevenueCat customer info and extracts the active entitlement details
  // (expiration date, renewal flag, product ID) if the premium entitlement is present.
  const loadSubscriptionInfo = async () => {
    try {
      setLoading(true);
      const info = await getCustomerInfo();
      setCustomerInfo(info);

      // Presence of this key means the premium entitlement is currently active.
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

  // Opens the RevenueCat Customer Center (cancel, upgrade, purchase history), then
  // re-fetches subscription info so the UI reflects any plan changes the user just made.
  const handleManageSubscription = async () => {
    try {
      await presentCustomerCenter();
      // Refresh subscription info after Customer Center closes
      await loadSubscriptionInfo();
    } catch (error) {
      Alert.alert('Error', 'Unable to open subscription management.');
    }
  };

  // Restores prior App Store / Play Store purchases via RevenueCat, then re-fetches
  // subscription status so the UI updates if a premium entitlement was found.
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

  // Navigates to the Paywall screen (RevenueCatUI wrapper) to initiate a new purchase.
  const handleUpgrade = () => {
    navigation.navigate('Paywall');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.brandSymbol}></Text>
            <Text style={styles.headerTitle}>Subscription</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content}>
          {activeSubscription ? (
            <>
              <View style={styles.subscriptionCard}>
                <Ionicons name="sparkles-outline" size={20} color={PRIMARY} style={styles.tierIcon} />
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
                    {/* Label switches based on whether auto-renewal is still enabled. */}
                  {activeSubscription.willRenew ? 'Renews on' : 'Expires on'}{' '}
                    {/* toLocaleDateString formats the ISO date in the device's locale. */}
                  {new Date(activeSubscription.expirationDate).toLocaleDateString()}
                  </Text>
                )}
              </View>

              <View style={styles.featuresCard}>
                <Text style={styles.featuresTitle}>Your Premium Benefits</Text>
                <View style={styles.feature}>
                  <Ionicons name="checkmark" size={16} color={PRIMARY} style={styles.featureBullet} />
                  <Text style={styles.featureText}>Unlimited outfit suggestions</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark" size={16} color={PRIMARY} style={styles.featureBullet} />
                  <Text style={styles.featureText}>AI personal stylist</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark" size={16} color={PRIMARY} style={styles.featureBullet} />
                  <Text style={styles.featureText}>Virtual wardrobe sync</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark" size={16} color={PRIMARY} style={styles.featureBullet} />
                  <Text style={styles.featureText}>Priority pet companion features</Text>
                </View>
                <View style={styles.feature}>
                  <Ionicons name="checkmark" size={16} color={PRIMARY} style={styles.featureBullet} />
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
                <Text style={styles.noSubIcon}></Text>
                <Text style={styles.noSubTitle}>Free Plan</Text>
                <Text style={styles.noSubText}>
                  Upgrade to Premium to unlock unlimited outfit suggestions, your AI stylist, and more
                </Text>
              </View>

              <Pressable style={styles.subscribeButton} onPress={handleUpgrade}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.subscribeButtonText}>View Premium Plans</Text>
                  <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />
                </View>
              </Pressable>
              <Text style={styles.autoRenewalText}>
                Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in Settings → Apple ID → Subscriptions.
              </Text>
            </>
          )}

          <Pressable style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </Pressable>

          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Need Help?</Text>
            <Text style={styles.supportText}>Contact us at</Text>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:support@ariscloset.app')}>
              <Text style={styles.supportText}>support@ariscloset.app</Text>
            </TouchableOpacity>
            <Text style={styles.supportText}>for any subscription-related questions.</Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// Styles for SubscriptionScreen — brand header, subscription status card (tier badge,
// active/cancelled pill, renewal date), premium features list, manage/restore buttons,
// free-plan upgrade prompt, auto-renewal disclosure text, and support card.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDEAE4',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F5F0',
  },
  header: {
    backgroundColor: '#EDEAE4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
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
    color: PRIMARY,
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
  brandSymbol: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
    fontFamily: FONTS.heading,
  },
  placeholder: {
    width: 28,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subscriptionCard: {
    backgroundColor: '#EDEAE4',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PRIMARY,
    marginBottom: 20,
  },
  tierIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  tierName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 16,
    fontFamily: FONTS.heading,
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
    fontFamily: FONTS.bodyMedium,
  },
  renewalText: {
    fontSize: 14,
    color: '#555555',
    fontFamily: FONTS.body,
  },
  featuresCard: {
    backgroundColor: '#EDEAE4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 16,
    fontFamily: FONTS.heading,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureBullet: {
    fontSize: 18,
    color: PRIMARY,
    marginRight: 12,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
  featureText: {
    fontSize: 16,
    color: '#1C1C1C',
    fontFamily: FONTS.body,
  },
  manageButton: {
    backgroundColor: '#F7F5F0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: PRIMARY,
  },
  manageButtonText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  noSubscriptionCard: {
    backgroundColor: '#EDEAE4',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D9D5CE',
    marginBottom: 20,
  },
  noSubIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noSubTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 12,
    fontFamily: FONTS.heading,
  },
  noSubText: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: FONTS.body,
  },
  subscribeButton: {
    backgroundColor: PRIMARY,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
  restoreButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreButtonText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  supportCard: {
    backgroundColor: '#EDEAE4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 8,
    fontFamily: FONTS.bodyMedium,
  },
  supportText: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  autoRenewalText: {
    fontSize: 11,
    color: '#999999',
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 16,
    lineHeight: 16,
    fontFamily: FONTS.body,
  },
  bottomSpacer: {
    height: 40,
  },
});
