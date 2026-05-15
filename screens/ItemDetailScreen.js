// Detail view for a single wardrobe item. Supports read-only viewing, inline editing
// (name, category, subcategory, color, season, photo), lent-item tracking with optional
// push-notification reminders, and deletion.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import { scheduleLentNotifications, cancelLentNotifications } from '../lib/notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateForDisplay, formatDateForDB, parseDateFromDB } from '../lib/constants';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories', 'Dresses'];
const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter', 'All Season'];
const SUBCATEGORIES = {
  Tops: ['T-Shirt', 'Tank Top', 'Blouse', 'Button-Down', 'Sweater', 'Hoodie', 'Business Casual Top', 'Polo'],
  Bottoms: ['Jeans', 'Leggings', 'Shorts', 'Skirt', 'Dress Pants', 'Business Casual Pants', 'Sweatpants'],
  Shoes: ['Sneakers', 'Heels', 'Boots', 'Sandals', 'Flats', 'Loafers', 'Athletic'],
  Outerwear: ['Jacket', 'Coat', 'Blazer', 'Cardigan', 'Vest'],
  Dresses: ['Casual Dress', 'Business Casual Dress', 'Formal Dress', 'Sundress'],
  Accessories: ['Bag', 'Belt', 'Hat', 'Scarf', 'Jewelry', 'Sunglasses'],
};

// Main screen component. Receives the item via route.params and keeps a local copy in
// currentItem so edits and lent-state changes update the UI without a full refetch.
export default function ItemDetailScreen({ route, navigation }) {
  const item = route?.params?.item ?? null;
  const [currentItem, setCurrentItem] = useState(item);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lent state — mirrors the item's lent fields and drives both the lent banner and the inline edit form.
  const [isLent, setIsLent] = useState(item?.is_lent ?? false);
  const [lentToName, setLentToName] = useState(item?.lent_to_name ?? '');
  const [lentDate, setLentDate] = useState(
    item?.lent_date ? parseDateFromDB(item.lent_date) : new Date()
  );
  const [expectedReturnDate, setExpectedReturnDate] = useState(
    item?.expected_return_date ? parseDateFromDB(item.expected_return_date) : null
  );
  const [showLentDatePicker, setShowLentDatePicker] = useState(false);
  const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);
  const [savingLent, setSavingLent] = useState(false);
  const [lentSaved, setLentSaved] = useState(false);
  const [lentFormOpen, setLentFormOpen] = useState(false);

  // Edit form state — isolated from currentItem so cancellation doesn't corrupt view-mode data.
  const [newPhoto, setNewPhoto] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [color, setColor] = useState('');
  const [season, setSeason] = useState('');

  // Copies currentItem values into the edit form fields and activates edit mode.
  const enterEditMode = () => {
    setNewPhoto(null);
    setName(currentItem.name);
    setCategory(currentItem.category);
    setSubcategory(currentItem.subcategory || SUBCATEGORIES[currentItem.category]?.[0] || '');
    setColor(currentItem.color);
    setSeason(currentItem.season);
    setEditing(true);
  };

  // Resets subcategory to the first valid option whenever the parent category changes.
  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    setSubcategory(SUBCATEGORIES[newCat][0]);
  };

  // ─── Photo picking ────────────────────────────────────────────────────────

  const pickPhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) launchCamera();
          if (buttonIndex === 2) launchLibrary();
        }
      );
    } else {
      Alert.alert('Change Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: launchCamera },
        { text: 'Choose from Library', onPress: launchLibrary },
      ]);
    }
  };

  // Requests camera permission then opens the camera. Sets newPhoto on success.
  const launchCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled) setNewPhoto(result.assets[0].uri);
  };

  // Requests media library permission then opens the photo picker. Sets newPhoto on success.
  const launchLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled) setNewPhoto(result.assets[0].uri);
  };

  // Shows a destructive confirmation before discarding any unsaved edits.
  const handleEditCancel = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to cancel? Any unsaved changes will be lost.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard Changes', style: 'destructive', onPress: () => setEditing(false) },
      ]
    );
  };

  // Toggles the is_lent flag. When turning off, clears all lent fields and cancels scheduled
  // notifications. When turning on, persists is_lent:true and opens the lent details form.
  const handleLentToggle = async () => {
    const newValue = !isLent;
    setIsLent(newValue);
    try {
      setSavingLent(true);
      if (!newValue) {
        await cancelLentNotifications(
          currentItem.notification_id_before,
          currentItem.notification_id_day_of,
        );
        const { error } = await supabase
          .from('clothing_items')
          .update({ is_lent: false, lent_to_name: null, lent_date: null, expected_return_date: null, notification_id_before: null, notification_id_day_of: null })
          .eq('id', currentItem.id);
        if (error) throw error;
        setCurrentItem(prev => ({ ...prev, is_lent: false, lent_to_name: null, lent_date: null, expected_return_date: null, notification_id_before: null, notification_id_day_of: null }));
        setLentToName('');
        setLentDate(new Date());
        setExpectedReturnDate(null);
        setLentFormOpen(false);
      } else {
        const { error } = await supabase
          .from('clothing_items')
          .update({ is_lent: true })
          .eq('id', currentItem.id);
        if (error) throw error;
        setCurrentItem(prev => ({ ...prev, is_lent: true }));
        setLentFormOpen(true);
      }
    } catch (err) {
      setIsLent(!newValue);
      Alert.alert('Error', err.message);
    } finally {
      setSavingLent(false);
    }
  };

  // Saves lent-to name, dates, and (re)schedules push notifications for the return date.
  // Cancels any previously scheduled notifications first to avoid duplicates.
  const handleSaveLentDetails = async () => {
    if (!lentToName.trim()) {
      Alert.alert('Missing info', 'Please enter the name of who you lent this to.');
      return;
    }
    try {
      setSavingLent(true);
      await cancelLentNotifications(
        currentItem.notification_id_before,
        currentItem.notification_id_day_of,
      );
      // Only schedule notifications if a return date was set; otherwise store nulls.
      const notifIds = expectedReturnDate
        ? await scheduleLentNotifications(currentItem.name, lentToName.trim(), expectedReturnDate)
        : { before: null, dayOf: null };
      const { error } = await supabase
        .from('clothing_items')
        .update({
          lent_to_name: lentToName.trim(),
          lent_date: formatDateForDB(lentDate),
          expected_return_date: expectedReturnDate ? formatDateForDB(expectedReturnDate) : null,
          notification_id_before: notifIds.before,
          notification_id_day_of: notifIds.dayOf,
        })
        .eq('id', currentItem.id);
      if (error) throw error;
      setCurrentItem(prev => ({
        ...prev,
        lent_to_name: lentToName.trim(),
        lent_date: formatDateForDB(lentDate),
        expected_return_date: expectedReturnDate ? formatDateForDB(expectedReturnDate) : null,
        notification_id_before: notifIds.before,
        notification_id_day_of: notifIds.dayOf,
      }));
      setLentSaved(true);
      setTimeout(() => setLentSaved(false), 2000); // briefly flash "Saved" confirmation then hide it
      setLentFormOpen(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingLent(false);
    }
  };

  // ─── Save edits ───────────────────────────────────────────────────────────

  // Validates required fields. If a new photo was picked, uploads it and deletes the old one
  // from storage. Then updates the clothing_items row and refreshes local state.
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a name for your item.');
      return;
    }
    if (!color.trim()) {
      Alert.alert('Missing color', 'Please enter the color of your item.');
      return;
    }
    try {
      setSaving(true);

      let imageUrl = currentItem.image_url;

      if (newPhoto) {
        const { data: { user } } = await supabase.auth.getUser();

        const fileExt = (newPhoto.split('.').pop().split('?')[0] || 'jpg').toLowerCase();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const response = await fetch(newPhoto);
        const arrayBuffer = await response.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('clothing-images')
          .upload(fileName, arrayBuffer, {
            contentType: `image/${fileExt}`,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('clothing-images')
          .getPublicUrl(fileName);

        imageUrl = publicData.publicUrl;

        // Delete old image from storage
        if (currentItem.image_url) {
          const urlParts = currentItem.image_url.split('clothing-images/');
          if (urlParts.length > 1) {
            await supabase.storage.from('clothing-images').remove([urlParts[1]]);
          }
        }
      }

      const { error: updateError } = await supabase
        .from('clothing_items')
        .update({
          name: name.trim(),
          category,
          subcategory,
          color: color.trim(),
          season,
          image_url: imageUrl,
        })
        .eq('id', currentItem.id);

      if (updateError) throw updateError;

      setCurrentItem((prev) => ({
        ...prev,
        name: name.trim(),
        category,
        subcategory,
        color: color.trim(),
        season,
        image_url: imageUrl,
      }));

      setEditing(false);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

  // Shows a destructive confirmation alert before proceeding to delete the item.
  const confirmDelete = () => {
    Alert.alert(
      'Remove Item',
      `Remove "${currentItem.name}" from your wardrobe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  // Deletes the clothing_items row and its image from Supabase storage, then navigates back.
  const handleDelete = async () => {
    try {
      setDeleting(true);

      const { error: dbError } = await supabase
        .from('clothing_items')
        .delete()
        .eq('id', currentItem.id);

      if (dbError) throw dbError;

      // Extract the bucket-relative path from the full public URL; remove() needs the path, not the URL.
      if (currentItem.image_url) {
        const urlParts = currentItem.image_url.split('clothing-images/');
        if (urlParts.length > 1) {
          await supabase.storage.from('clothing-images').remove([urlParts[1]]);
        }
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
      setDeleting(false);
    }
  };

  // ─── Mark returned ───────────────────────────────────────────────────────

  // Cancels any lent notifications and clears all lent fields, effectively marking the item returned.
  const handleMarkReturned = async () => {
    try {
      await cancelLentNotifications(
        currentItem.notification_id_before,
        currentItem.notification_id_day_of,
      );
      const { error } = await supabase
        .from('clothing_items')
        .update({ is_lent: false, lent_to_name: null, lent_date: null, expected_return_date: null, notification_id_before: null, notification_id_day_of: null })
        .eq('id', currentItem.id);
      if (error) throw error;
      setCurrentItem(prev => ({
        ...prev,
        is_lent: false,
        lent_to_name: null,
        lent_date: null,
        expected_return_date: null,
        notification_id_before: null,
        notification_id_day_of: null,
      }));
      setIsLent(false);
      setLentToName('');
      setLentDate(new Date());
      setExpectedReturnDate(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  // True if the item is lent and the expected return date has already passed.
  const isOverdue = currentItem.is_lent &&
    currentItem.expected_return_date &&
    currentItem.expected_return_date <= new Date().toISOString().split('T')[0];

  // Build the label/value rows for view mode; filter(Boolean) drops the subcategory row when absent.
  const detailRows = [
    { label: 'Category', value: currentItem.category },
    currentItem.subcategory ? { label: 'Subcategory', value: currentItem.subcategory } : null,
    { label: 'Color', value: currentItem.color },
    { label: 'Season', value: currentItem.season },
  ].filter(Boolean);

  if (!currentItem) {
    navigation.goBack();
    return null;
  }

  // In edit mode, show the newly-picked photo immediately; fall back to the saved URL.
  const displayPhoto = newPhoto || currentItem.image_url;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {editing ? (
          <Pressable onPress={handleEditCancel} disabled={saving}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
          </Pressable>
        )}

        <Text style={styles.headerTitle} numberOfLines={1}>
          {editing ? 'Edit Item' : `${currentItem.subcategory || currentItem.category} Detail`}
        </Text>

        {editing ? (
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text style={styles.headerAction}>Save</Text>
            )}
          </Pressable>
        ) : (
          <Pressable onPress={enterEditMode}>
            <Text style={styles.headerAction}>Edit</Text>
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo */}
          {editing ? (
            <View style={styles.photoSection}>
              <Pressable onPress={pickPhoto} style={styles.photoPicker}>
                {displayPhoto ? (
                  <Image source={{ uri: displayPhoto }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera-outline" size={48} color="#9B9B9B" />
                    <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={pickPhoto} style={styles.changePhotoButton}>
                <Text style={styles.changePhotoText}>
                  {displayPhoto ? 'Change Photo' : 'Add Photo'}
                </Text>
              </Pressable>
            </View>
          ) : (
            currentItem.image_url ? (
              <Image source={{ uri: currentItem.image_url }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="shirt-outline" size={48} color="#9B9B9B" />
              </View>
            )
          )}

          {/* View mode: detail card + delete */}
          {!editing && (
            <>
            
              <View style={styles.detailCard}>
                <Text style={styles.itemName}>{currentItem.name}</Text>

                {currentItem.is_lent && currentItem.lent_to_name && (
                  <View style={styles.lentBanner}>
                    {isOverdue && (
                      <View style={styles.lentBannerOverdueBadge}>
                        <Text style={styles.lentBannerOverdueBadgeText}>!</Text>
                      </View>
                    )}
                    <View style={styles.lentBannerRow}>
                      <Ionicons name="people-outline" size={20} color={PRIMARY} style={styles.lentBannerIcon} />
                      <View style={styles.lentBannerInfo}>
                        <Text style={styles.lentBannerTitle}>
                          Lent to {currentItem.lent_to_name}
                        </Text>
                        {currentItem.lent_date && (
                          <Text style={styles.lentBannerSub}>
                            Since {formatDateForDisplay(parseDateFromDB(currentItem.lent_date))}
                            {currentItem.expected_return_date
                              ? ` · Return by ${formatDateForDisplay(parseDateFromDB(currentItem.expected_return_date))}`
                              : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Pressable style={styles.returnedButton} onPress={handleMarkReturned}>
                      <Text style={styles.returnedButtonText}>Mark as Returned</Text>
                    </Pressable>
                  </View>
                )}

                {detailRows.map(({ label, value }) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}

                {/* Lent toggle row */}
                <View style={styles.detailRow}>
                  <View style={styles.lentLabelWithCheckbox}>
                    <Text style={styles.detailLabel}>Lent to friend</Text>
                    <Pressable onPress={handleLentToggle} disabled={savingLent}>
                      {savingLent ? (
                        <ActivityIndicator size="small" color={PRIMARY} />
                      ) : (
                        <View style={[styles.lendCheckbox, isLent && styles.lendCheckboxChecked]}>
                          {isLent && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        </View>
                      )}
                    </Pressable>
                  </View>
                  {isLent && !lentFormOpen && (
                    <Pressable onPress={() => setLentFormOpen(true)}>
                      <Text style={styles.lentEditLink}>Edit</Text>
                    </Pressable>
                  )}
                </View>

                {/* Lent details section */}
                {isLent && lentFormOpen && (
                  <View style={styles.lentSection}>
                    <Text style={styles.lentFieldLabel}>Lent to</Text>
                    <TextInput
                      style={styles.lentInput}
                      value={lentToName}
                      onChangeText={setLentToName}
                      placeholder="Friend's name"
                      placeholderTextColor="#9B9B9B"
                    />

                    <Text style={styles.lentFieldLabel}>Date lent</Text>
                    <Pressable style={styles.dateButton} onPress={() => setShowLentDatePicker(true)}>
                      <Text style={styles.dateButtonText}>{formatDateForDisplay(lentDate)}</Text>
                      <Ionicons name="calendar-outline" size={20} color={PRIMARY} />
                    </Pressable>
                    {showLentDatePicker && (
                      <DateTimePicker
                        value={lentDate}
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={(_, date) => {
                          setShowLentDatePicker(Platform.OS === 'ios');
                          if (date) setLentDate(date);
                        }}
                      />
                    )}

                    <Text style={styles.lentFieldLabel}>
                      Expected return <Text style={styles.labelOptional}>(optional)</Text>
                    </Text>
                    <Pressable style={styles.dateButton} onPress={() => setShowReturnDatePicker(true)}>
                      <Text style={styles.dateButtonText}>
                        {expectedReturnDate ? formatDateForDisplay(expectedReturnDate) : 'Not set'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color={PRIMARY} />
                    </Pressable>
                    {expectedReturnDate && (
                      <Pressable onPress={() => setExpectedReturnDate(null)}>
                        <Text style={styles.clearDate}>Clear return date</Text>
                      </Pressable>
                    )}
                    {showReturnDatePicker && (
                      <DateTimePicker
                        value={expectedReturnDate || new Date()}
                        mode="date"
                        display="default"
                        minimumDate={lentDate}
                        onChange={(_, date) => {
                          setShowReturnDatePicker(Platform.OS === 'ios');
                          if (date) setExpectedReturnDate(date);
                        }}
                      />
                    )}

                    <View style={styles.lentFormActions}>
                      <Pressable
                        style={[styles.saveLentButton, savingLent && styles.buttonDisabled]}
                        onPress={handleSaveLentDetails}
                        disabled={savingLent}
                      >
                        {savingLent ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.saveLentButtonText}>Save</Text>
                        )}
                      </Pressable>
                      <Pressable onPress={() => setLentFormOpen(false)} disabled={savingLent}>
                        <Text style={styles.lentEditLink}>Cancel</Text>
                      </Pressable>
                    </View>
                    {lentSaved && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, gap: 4 }}>
                        <Text style={[styles.lentSavedText, { marginTop: 0 }]}>Saved</Text>
                        <Ionicons name="checkmark" size={16} color={PRIMARY} />
                      </View>
                    )}
                  </View>
                )}
              </View>

              <Pressable
                style={[styles.deleteButton, deleting && styles.buttonDisabled]}
                onPress={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.deleteButtonText}>Remove from Wardrobe</Text>
                )}
              </Pressable>
            </>
          )}

          {/* Edit mode: form */}
          {editing && (
            <View style={styles.form}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Item name"
                placeholderTextColor="#9B9B9B"
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={category}
                  onValueChange={handleCategoryChange}
                  style={styles.picker}
                  dropdownIconColor={PRIMARY}
                >
                  {CATEGORIES.map((cat) => (
                    <Picker.Item key={cat} label={cat} value={cat} color="#1C1C1C" />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Subcategory</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={subcategory}
                  onValueChange={setSubcategory}
                  style={styles.picker}
                  dropdownIconColor={PRIMARY}
                >
                  {(SUBCATEGORIES[category] || []).map((sub) => (
                    <Picker.Item key={sub} label={sub} value={sub} color="#1C1C1C" />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>Color</Text>
              <TextInput
                style={styles.input}
                value={color}
                onChangeText={setColor}
                placeholder="e.g. Navy Blue"
                placeholderTextColor="#9B9B9B"
              />

              <Text style={styles.label}>Season</Text>
              <View style={styles.chipRow}>
                {SEASONS.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.chip, season === s && styles.chipSelected]}
                    onPress={() => setSeason(s)}
                  >
                    <Text style={[styles.chipText, season === s && styles.chipTextSelected]}>
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>

            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Styles for ItemDetailScreen — header, full-width image, detail card, lent banner,
// lent form, edit form, and delete button.
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDEAE4',
  },
  flex: {
    flex: 1,
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
    width: 44,
    fontFamily: FONTS.bodyBold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1C',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    fontFamily: FONTS.heading,
  },
  headerAction: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '600',
    width: 44,
    textAlign: 'right',
    fontFamily: FONTS.bodyMedium,
  },
  headerActionDisabled: {
    opacity: 0.4,
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  content: {
    paddingBottom: 50,
  },
  // ── View mode ──
  image: {
    width: '100%',
    height: 420,
  },
  imagePlaceholder: {
    width: '100%',
    height: 420,
    backgroundColor: '#EDEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 80,
  },
  detailCard: {
    backgroundColor: '#EDEAE4',
    margin: 15,
    padding: 20,
    borderRadius: 15,
  },
  itemName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 16,
    fontFamily: FONTS.heading,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#D9D5CE',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  detailValue: {
    fontSize: 14,
    color: '#1C1C1C',
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    marginHorizontal: 15,
    marginTop: 5,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  // ── Edit mode ──
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#EDEAE4',
  },
  photoPicker: {
    width: 180,
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#D9D5CE',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderIcon: {
    fontSize: 40,
  },
  photoPlaceholderText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  changePhotoButton: {
    marginTop: 12,
  },
  changePhotoText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  form: {
    padding: 20,
  },
  label: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 15,
    fontFamily: FONTS.bodyMedium,
  },
  input: {
    backgroundColor: '#EDEAE4',
    color: '#1C1C1C',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    fontFamily: FONTS.bodyMedium,
  },
  pickerContainer: {
    backgroundColor: '#EDEAE4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    overflow: 'hidden',
  },
  picker: {
    color: '#1C1C1C',
    backgroundColor: '#EDEAE4',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EDEAE4',
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  chipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  chipTextSelected: {
    color: '#fff',
  },
  // ── Lend (view mode) ──
  lentBanner: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  lentBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  lentBannerIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  lentBannerInfo: {
    flex: 1,
  },
  lentBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
    fontFamily: FONTS.bodyBold,
  },
  lentBannerSub: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  lentBannerOverdueBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e74c3c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lentBannerOverdueBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
    fontFamily: FONTS.bodyBold,
  },
  returnedButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  returnedButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    fontFamily: FONTS.bodyBold,
  },
  // ── Lend (edit mode) ──
  lendToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  lendCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D9D5CE',
    backgroundColor: '#EDEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lendCheckboxChecked: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  lendCheckboxMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
  lendToggleLabel: {
    fontSize: 15,
    color: '#1C1C1C',
    fontWeight: '500',
  },
  dateButton: {
    backgroundColor: '#EDEAE4',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1C1C1C',
    fontFamily: FONTS.bodyMedium,
  },
  labelOptional: {
    fontWeight: '400',
    color: '#6B7280',
  },
  clearDate: {
    color: PRIMARY,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  lentToggleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lentLabelWithCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lentEditLink: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  lentSection: {
    marginTop: 12,
  },
  lentFieldLabel: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
    fontFamily: FONTS.bodyMedium,
  },
  lentInput: {
    backgroundColor: '#F7F5F0',
    color: '#1C1C1C',
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    fontFamily: FONTS.bodyMedium,
  },
  lentFormActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 16,
  },
  saveLentButton: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 36,
    alignItems: 'center',
  },
  saveLentButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  lentSavedText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: FONTS.bodyMedium,
  },
});
