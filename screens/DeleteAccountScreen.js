// Screen that permanently deletes the user's account and all associated data.
// The user must type "DELETE" to unlock the confirmation button. Deletion removes
// database rows, storage files, and the auth user (via an Edge Function), then signs out.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

// Full-page confirmation flow for irreversible account deletion.
export default function DeleteAccountScreen({ navigation }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Only true when the user has typed the exact string "DELETE" — gates the delete button.
  const confirmed = confirmText === 'DELETE';

  // Executes the full account deletion sequence:
  // 1. Delete clothing_items and favorite_outfits rows in parallel.
  // 2. Delete the profile row.
  // 3. Remove all storage files (clothing images and profile pictures).
  // 4. Invoke the delete-user Edge Function to remove the auth user from Supabase Auth.
  // 5. Sign out — the auth state change listener handles navigation away from the app.
  const handleDelete = async () => {
    if (!confirmed) return;
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Delete user data rows
      await Promise.all([
        supabase.from('clothing_items').delete().eq('user_id', user.id),
        supabase.from('favorite_outfits').delete().eq('user_id', user.id),
      ]);
      await supabase.from('profiles').delete().eq('id', user.id);

      // Delete clothing images
      const { data: clothingFiles } = await supabase.storage
        .from('clothing-images')
        .list(user.id);
      if (clothingFiles?.length) {
        await supabase.storage
          .from('clothing-images')
          .remove(clothingFiles.map(f => `${user.id}/${f.name}`));
      }

      // Delete profile pictures
      const { data: profileFiles } = await supabase.storage
        .from('profile-pictures')
        .list(user.id);
      if (profileFiles?.length) {
        await supabase.storage
          .from('profile-pictures')
          .remove(profileFiles.map(f => `${user.id}/${f.name}`));
      }

      // Delete auth user via Edge Function
      const { error: fnError } = await supabase.functions.invoke('delete-user');
      if (fnError) throw fnError;

      await supabase.auth.signOut();
    } catch (err) {
      setDeleting(false);
      Alert.alert('Error', `Could not delete account: ${err.message}\n\nPlease try again or contact support.`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} disabled={deleting}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Ionicons name="warning-outline" size={24} color="#FF9500" style={styles.warningIcon} />

          <Text style={styles.title}>Are you sure?</Text>

          <Text style={styles.body}>
            Deleting your account will permanently remove your wardrobe, saved outfits, profile, and all associated data. This cannot be undone.
          </Text>

          <View style={styles.confirmBox}>
            <Text style={styles.confirmLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.input}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="DELETE"
              placeholderTextColor="#C0A0A0"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
          </View>

          <Pressable
            style={[styles.deleteButton, !confirmed && styles.deleteButtonDisabled]}
            onPress={handleDelete}
            disabled={!confirmed || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.deleteButtonText}>Permanently Delete Account</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={deleting}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles for DeleteAccountScreen — header, warning content, confirmation input, and action buttons.
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
    borderBottomColor: '#E53935',
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
  disabled: {
    opacity: 0.3,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 56,
    marginBottom: 16,
    marginTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: FONTS.heading,
  },
  body: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
    fontFamily: FONTS.body,
  },
  confirmBox: {
    width: '100%',
    marginBottom: 24,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: FONTS.bodyMedium,
  },
  input: {
    backgroundColor: '#EDEAE4',
    borderWidth: 1.5,
    borderColor: '#E53935',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1C1C1C',
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
  deleteButton: {
    width: '100%',
    backgroundColor: '#E53935',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    backgroundColor: '#F5A5A5',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
  cancelButton: {
    width: '100%',
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
});
