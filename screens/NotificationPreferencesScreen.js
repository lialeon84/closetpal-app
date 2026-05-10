import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';

const DEFAULTS = {
  outfit_reminders: false,
  style_tips: false,
  new_features: false,
};

const PREFS_META = [
  { key: 'outfit_reminders', label: 'Outfit Reminders',  desc: 'Daily nudges to plan your look' },
  { key: 'style_tips',       label: 'Style Tips',        desc: 'Seasonal advice from your AI stylist' },
  { key: 'new_features',     label: 'New Features',      desc: 'Be the first to hear about updates' },
];

export default function NotificationPreferencesScreen({ navigation }) {
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();
      if (data?.notification_preferences) {
        setPrefs({ ...DEFAULTS, ...data.notification_preferences });
      }
    } catch {
      // Column may not exist yet — use defaults silently
    } finally {
      setLoading(false);
    }
  };

  const togglePref = async (key) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: updated })
        .eq('id', user.id);
      if (error) throw error;
    } catch (err) {
      // Revert optimistic update on failure
      setPrefs(prefs);
      Alert.alert('Could not save', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView style={styles.container}>
          <Text style={styles.sectionNote}>
            Push notification delivery coming soon. Your preferences are saved and will take effect when enabled.
          </Text>

          <View style={styles.section}>
            {PREFS_META.map(({ key, label, desc }, idx) => (
              <View
                key={key}
                style={[styles.row, idx < PREFS_META.length - 1 && styles.rowBorder]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{label}</Text>
                  <Text style={styles.rowDesc}>{desc}</Text>
                </View>
                <Switch
                  value={prefs[key]}
                  onValueChange={() => togglePref(key)}
                  disabled={saving}
                  trackColor={{ false: '#D1D5DB', true: '#C084FC' }}
                  thumbColor={prefs[key] ? PRIMARY : '#F3F4F6'}
                />
              </View>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
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
  backButton: {
    fontSize: 28,
    color: PRIMARY,
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1C',
    fontFamily: FONTS.heading,
  },
  headerSpacer: {
    width: 28,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
  sectionNote: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    margin: 15,
    marginBottom: 8,
    fontFamily: FONTS.body,
  },
  section: {
    backgroundColor: '#EDEAE4',
    margin: 15,
    borderRadius: 15,
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#D9D5CE',
  },
  rowText: {
    flex: 1,
    marginRight: 16,
  },
  rowLabel: {
    fontSize: 16,
    color: '#1C1C1C',
    fontWeight: '500',
    marginBottom: 2,
    fontFamily: FONTS.bodyMedium,
  },
  rowDesc: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: FONTS.body,
  },
  bottomSpacer: {
    height: 40,
  },
});
