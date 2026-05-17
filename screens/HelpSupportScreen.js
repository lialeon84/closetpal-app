// Help & Support screen. Groups support links (FAQ, Contact Us), legal documents
// (Terms of Service, Privacy Policy), and app info (Store Review, App Version).
// All web links open in the in-app browser via expo-web-browser.
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as StoreReview from 'expo-store-review';
import Constants from 'expo-constants';
import { PRIMARY, CARD_BG } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

const CONTACT_URL = 'https://ariscloset.app/contact.html';
const TERMS_URL   = 'https://ariscloset.app/terms.html';
const PRIVACY_URL = 'https://ariscloset.app/privacy.html';

export default function HelpSupportScreen({ navigation }) {
  const version = Constants.expoConfig?.version;
  const build   = Constants.expoConfig?.ios?.buildNumber;
  const versionLabel = version
    ? (build ? `Version ${version} (${build})` : `Version ${version}`)
    : '—';

  // Apple rate-limits the native review prompt to 3 times per year per user.
  // Silent no-op is expected behavior when the prompt is unavailable.
  const handleRateApp = async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      } else {
        const url = StoreReview.storeUrl();
        if (url) await WebBrowser.openBrowserAsync(url);
      }
    } catch (_) {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>

        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Get Help */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Help</Text>
          <Pressable
            style={styles.row}
            onPress={() => WebBrowser.openBrowserAsync(CONTACT_URL)}
          >
            <Text style={styles.rowText}>FAQ</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => WebBrowser.openBrowserAsync(CONTACT_URL)}
          >
            <Text style={styles.rowText}>Contact Us</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Pressable
            style={styles.row}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            <Text style={styles.rowText}>Terms of Service</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
          <Pressable
            style={styles.row}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            <Text style={styles.rowText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Pressable style={styles.row} onPress={handleRateApp}>
            <Text style={styles.rowText}>Rate Ari's Closet</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
          <View style={styles.row}>
            <Text style={styles.rowText}>App Version</Text>
            <Text style={styles.versionText}>{versionLabel}</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#F7F5F0' },
  container: { flex: 1, backgroundColor: '#F7F5F0' },
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
    fontFamily: FONTS.heading,
  },
  headerSpacer: { width: 24 },
  section: {
    backgroundColor: CARD_BG,
    margin: 15,
    padding: 20,
    borderRadius: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 15,
    fontFamily: FONTS.heading,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D5CE',
  },
  rowText: {
    fontSize: 16,
    color: '#1C1C1C',
    fontFamily: FONTS.body,
  },
  versionText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: FONTS.body,
  },
  bottomSpacer: { height: 40 },
});
