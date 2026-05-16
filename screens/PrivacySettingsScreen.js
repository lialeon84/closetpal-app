// Privacy Settings screen. Central hub for all privacy controls: legal documents
// (Privacy Policy, Terms of Service), Camera / Photo Library permission statuses,
// Notification Preferences, and data management (Export My Data, Delete Account).
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

const PRIVACY_URL = 'https://ariscloset.app/privacy.html';
const TERMS_URL   = 'https://ariscloset.app/terms.html';

export default function PrivacySettingsScreen({ navigation }) {
  const [cameraStatus, setCameraStatus] = useState(null);
  const [libraryStatus, setLibraryStatus] = useState(null);

  // Re-check on every focus so the status reflects any changes the user
  // made in the iOS Settings app and returned from.
  const checkPermissions = async () => {
    const camera = await ImagePicker.getCameraPermissionsAsync();
    const library = await ImagePicker.getMediaLibraryPermissionsAsync();
    setCameraStatus(camera.status);
    setLibraryStatus(library.status);
  };

  useFocusEffect(useCallback(() => { checkPermissions(); }, []));

  const statusLabel = (status) => {
    if (status === 'granted') return 'Allowed';
    if (status === 'limited') return 'Limited Access'; // iOS 14+ partial photo library access
    if (status === 'denied') return 'Denied';
    if (status === 'undetermined') return 'Not Determined';
    return '—';
  };

  const statusColor = (status) => {
    if (status === 'granted') return '#4CAF50';
    if (status === 'limited') return '#F59E0B';
    if (status === 'denied') return '#E53935';
    return '#6B7280';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>

        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* 1 — Privacy Policy + Terms of Service, two rows in one card, no section title */}
        <View style={styles.section}>
          <Pressable
            style={styles.settingButton}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            <Text style={styles.settingButtonText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
          <Pressable
            style={styles.settingButton}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            <Text style={styles.settingButtonText}>Terms of Service</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* 2 — Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <Text style={styles.sectionNote}>
            To change a permission, tap "Open Settings" and update it in the iOS Settings app for Ari's Closet.
          </Text>

          {[
            { label: 'Camera', status: cameraStatus },
            { label: 'Photo Library', status: libraryStatus },
          ].map(({ label, status }) => (
            <View key={label} style={styles.permissionRow}>
              <View>
                <Text style={styles.settingButtonText}>{label}</Text>
                <Text style={[styles.statusText, { color: statusColor(status) }]}>
                  {statusLabel(status)}
                </Text>
              </View>
              <Pressable style={styles.openSettingsBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.openSettingsBtnText}>Open Settings</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* 3 — Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('NotificationPreferences')}
          >
            <Text style={styles.settingButtonText}>Notification Preferences</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* 4 — Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text style={styles.settingButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* 5 — Your Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Data</Text>
          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('ExportData')}
          >
            <Text style={styles.settingButtonText}>Export My Data</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('DeleteAccount')}
          >
            <Text style={[styles.settingButtonText, styles.dangerText]}>Delete Account</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F5F0' },
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
    backgroundColor: '#EDEAE4',
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
  sectionNote: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    fontFamily: FONTS.body,
    lineHeight: 18,
  },
  settingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D5CE',
  },
  settingButtonText: {
    fontSize: 16,
    color: '#1C1C1C',
    fontFamily: FONTS.body,
  },
  dangerText: { color: '#E53935' },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D5CE',
  },
  statusText: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: FONTS.body,
  },
  openSettingsBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openSettingsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  bottomSpacer: { height: 40 },
});
