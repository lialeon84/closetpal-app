// Settings hub screen. Provides navigation rows for account management (edit profile,
// subscription), privacy and data controls (delete account, export data, notification
// prefs, legal links), and a sign-out action.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

const PRIVACY_URL = 'https://closetpal.app/privacy';
const TERMS_URL   = 'https://closetpal.app/terms';

// Main screen component. Fetches the user's profile on mount and renders grouped
// setting rows organized into Account, Privacy, About, and Privacy & Data sections.
export default function SettingsScreen({ navigation }) {
  // Profile data (used for display) and initial-load flag.
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch profile once on mount.
  useEffect(() => {
    loadProfile();
  }, []);

  // Fetches the signed-in user's profile row once on mount for display purposes.
  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Prompts the user before signing out. The auth listener in the root navigator
  // detects the cleared session and redirects to the login screen automatically.
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) Alert.alert('Error', error.message);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.brandHeader}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
          <Text style={styles.brandSymbol}></Text>
          <Text style={styles.brandText}>Settings</Text>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.settingButtonText}>Edit Profile</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.settingButtonText}>Subscription</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          {/* Temporarily disabled — Blocked Users entry point hidden for launch.
              Re-enable by uncommenting this block.
          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Blocked Users</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable> */}
        </View>

        {/* Temporarily disabled — Notifications section hidden for launch.
            Re-enable by uncommenting this block.
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Notification Preferences</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View> */}

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Help & Support</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        {/* Privacy & Data */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Data</Text>

          <Pressable style={styles.settingButton} onPress={() => navigation.navigate('DeleteAccount')}>
            <Text style={[styles.settingButtonText, styles.dangerText]}>Delete Account</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          <Pressable style={styles.settingButton} onPress={() => navigation.navigate('ExportData')}>
            <Text style={styles.settingButtonText}>Export My Data</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          <Pressable style={styles.settingButton} onPress={() => navigation.navigate('NotificationPreferences')}>
            <Text style={styles.settingButtonText}>Notification Preferences</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          <Pressable style={styles.settingButton} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
            <Text style={styles.settingButtonText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          <Pressable style={styles.settingButton} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
            <Text style={styles.settingButtonText}>Terms of Service</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>

          <View style={styles.sectionDivider} />

          <Pressable style={styles.settingButton} onPress={handleLogout}>
            <Text style={styles.settingButtonText}>Sign Out</Text>
            <Ionicons name="chevron-forward-outline" size={20} color="#1C1C1C" />
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles for SettingsScreen — brand header, grouped section cards, setting rows,
// danger text color, divider, and bottom spacer.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F5F0',
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
  brandHeader: {
    backgroundColor: '#EDEAE4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 28,
    color: PRIMARY,
    marginRight: 15,
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
  brandSymbol: {
    fontSize: 24,
    marginRight: 8,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
    fontFamily: FONTS.heading,
  },
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
  settingButtonArrow: {
    fontSize: 18,
    color: PRIMARY,
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
  dangerText: {
    color: '#E53935',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#D9D5CE',
    marginVertical: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
