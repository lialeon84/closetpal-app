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

export default function SettingsScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

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
        <ActivityIndicator size="large" color="#9b59b6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container}>
        <View style={styles.brandHeader}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </Pressable>
          <Text style={styles.brandSymbol}>🐾</Text>
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
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>

          <Pressable
            style={styles.settingButton}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.settingButtonText}>Subscription</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Privacy Settings</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Blocked Users</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Notification Preferences</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Help & Support</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Terms of Service</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>

          <Pressable style={styles.settingButton}>
            <Text style={styles.settingButtonText}>Privacy Policy</Text>
            <Text style={styles.settingButtonArrow}>→</Text>
          </Pressable>
        </View>

        <View style={styles.logoutContainer}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
    borderBottomColor: '#9b59b6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    fontSize: 28,
    color: '#9b59b6',
    marginRight: 15,
    fontWeight: 'bold',
  },
  brandSymbol: {
    fontSize: 24,
    marginRight: 8,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
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
  },
  settingButtonArrow: {
    fontSize: 18,
    color: '#9b59b6',
    fontWeight: 'bold',
  },
  logoutContainer: {
    paddingHorizontal: 15,
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: '#ff6b6b',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
