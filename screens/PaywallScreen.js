import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getOfferings, purchasePackage, restorePurchases } from '../lib/revenuecat';

const FeatureItem = ({ icon, text }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

export default function PaywallScreen({ navigation }) {
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    setLoading(true);
    const availableOfferings = await getOfferings();
    if (availableOfferings) {
      setOfferings(availableOfferings);
      if (availableOfferings.availablePackages.length > 0) {
        setSelectedPackage(availableOfferings.availablePackages[0]);
      }
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setPurchasing(true);
    const success = await purchasePackage(selectedPackage);
    setPurchasing(false);

    if (success) {
      Alert.alert(
        'Welcome to Premium! 🐾',
        'You now have access to all ClosetPal features.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    const success = await restorePurchases();
    setPurchasing(false);

    if (success) {
      Alert.alert(
        'Restored!',
        'Your premium access has been restored.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9b59b6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Unlock Premium 🐾</Text>
        <Text style={styles.subtitle}>
          Get the most out of your AI wardrobe companion
        </Text>
      </View>

      <View style={styles.featuresContainer}>
        <FeatureItem icon="👗" text="Unlimited outfit suggestions" />
        <FeatureItem icon="✨" text="AI personal stylist" />
        <FeatureItem icon="👔" text="Virtual wardrobe sync" />
        <FeatureItem icon="🎨" text="Exclusive style profiles" />
        <FeatureItem icon="🐾" text="Priority pet companion features" />
        <FeatureItem icon="🚫" text="Ad-free experience" />
      </View>

      {offerings && offerings.availablePackages.length > 0 && (
        <View style={styles.packagesContainer}>
          {offerings.availablePackages.map((pkg) => (
            <TouchableOpacity
              key={pkg.identifier}
              style={[
                styles.packageCard,
                selectedPackage?.identifier === pkg.identifier && styles.selectedPackage,
              ]}
              onPress={() => setSelectedPackage(pkg)}
            >
              <View style={styles.packageHeader}>
                <Text style={styles.packageTitle}>{pkg.product.title}</Text>
                {pkg.packageType === 'ANNUAL' && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>Best Value</Text>
                  </View>
                )}
              </View>
              <Text style={styles.packageDescription}>{pkg.product.description}</Text>
              <Text style={styles.packagePrice}>
                {pkg.product.priceString}
                {pkg.packageType === 'ANNUAL'
                  ? '/year'
                  : pkg.packageType === 'MONTHLY'
                  ? '/month'
                  : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
        onPress={handlePurchase}
        disabled={purchasing || !selectedPackage}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.purchaseButtonText}>Subscribe Now</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
        <Text style={styles.restoreButtonText}>Restore Purchases</Text>
      </TouchableOpacity>

      <Text style={styles.termsText}>
        Subscriptions auto-renew. Cancel anytime in account settings.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  featuresContainer: {
    padding: 24,
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  packagesContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  packageCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPackage: {
    borderColor: '#9b59b6',
    backgroundColor: '#2a2a3e',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  bestValueBadge: {
    backgroundColor: '#9b59b6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  packageDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9b59b6',
  },
  purchaseButton: {
    backgroundColor: '#9b59b6',
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  purchaseButtonDisabled: {
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  restoreButton: {
    marginHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  restoreButtonText: {
    color: '#9b59b6',
    fontSize: 16,
  },
  termsText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 12,
    paddingHorizontal: 32,
    marginBottom: 32,
  },
});
