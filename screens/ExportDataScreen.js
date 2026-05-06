import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';

export default function ExportDataScreen({ navigation }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [{ data: profile }, { data: clothingItems }, { data: favoriteOutfits }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('clothing_items').select('*').eq('user_id', user.id),
          supabase.from('favorite_outfits').select('*').eq('user_id', user.id),
        ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        profile,
        clothing_items: clothingItems ?? [],
        favorite_outfits: favoriteOutfits ?? [],
      };

      const filePath = FileSystem.documentDirectory + 'closetpal-export.json';
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(exportData, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available', 'Your device does not support file sharing.');
        return;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Save your ClosetPal data',
      });
    } catch (err) {
      Alert.alert('Export failed', err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} disabled={exporting}>
          <Text style={[styles.backButton, exporting && styles.disabled]}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Export My Data</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.icon}>📦</Text>
        <Text style={styles.title}>Your data, your way</Text>
        <Text style={styles.body}>
          Export a JSON file containing your profile, all clothing items (with image URLs), and your saved favorite outfits.
        </Text>

        <Pressable
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.exportButtonText}>Export My Data</Text>
          )}
        </Pressable>

        {exporting && (
          <Text style={styles.loadingNote}>Gathering your data…</Text>
        )}
      </View>
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
    borderBottomColor: '#9b59b6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 28,
    color: '#9b59b6',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1C',
  },
  headerSpacer: {
    width: 28,
  },
  disabled: {
    opacity: 0.3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  exportButton: {
    width: '100%',
    backgroundColor: '#9b59b6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loadingNote: {
    marginTop: 16,
    fontSize: 13,
    color: '#6B7280',
  },
});
