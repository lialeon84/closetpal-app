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
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDateForDisplay, formatDateForDB, parseDateFromDB } from '../lib/constants';

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

export default function ItemDetailScreen({ route, navigation }) {
  const [currentItem, setCurrentItem] = useState(route.params.item);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lend state (edit mode)
  const [isLent, setIsLent] = useState(false);
  const [lentToName, setLentToName] = useState('');
  const [lentDate, setLentDate] = useState(new Date());
  const [expectedReturnDate, setExpectedReturnDate] = useState(null);
  const [showLentDatePicker, setShowLentDatePicker] = useState(false);
  const [showReturnDatePicker, setShowReturnDatePicker] = useState(false);

  // Edit form state
  const [newPhoto, setNewPhoto] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [color, setColor] = useState('');
  const [season, setSeason] = useState('');

  const enterEditMode = () => {
    setNewPhoto(null);
    setName(currentItem.name);
    setCategory(currentItem.category);
    setSubcategory(currentItem.subcategory || SUBCATEGORIES[currentItem.category]?.[0] || '');
    setColor(currentItem.color);
    setSeason(currentItem.season);
    setIsLent(currentItem.is_lent ?? false);
    setLentToName(currentItem.lent_to_name ?? '');
    setLentDate(currentItem.lent_date ? parseDateFromDB(currentItem.lent_date) : new Date());
    setExpectedReturnDate(currentItem.expected_return_date ? parseDateFromDB(currentItem.expected_return_date) : null);
    setEditing(true);
  };

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

  // ─── Save edits ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a name for your item.');
      return;
    }
    if (!color.trim()) {
      Alert.alert('Missing color', 'Please enter the color of your item.');
      return;
    }
    if (isLent && !lentToName.trim()) {
      Alert.alert('Missing info', 'Please enter the name of who you lent this to.');
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
          is_lent: isLent,
          lent_to_name: isLent ? lentToName.trim() : null,
          lent_date: isLent ? formatDateForDB(lentDate) : null,
          expected_return_date: isLent && expectedReturnDate ? formatDateForDB(expectedReturnDate) : null,
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
        is_lent: isLent,
        lent_to_name: isLent ? lentToName.trim() : null,
        lent_date: isLent ? formatDateForDB(lentDate) : null,
        expected_return_date: isLent && expectedReturnDate ? formatDateForDB(expectedReturnDate) : null,
      }));

      setEditing(false);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────

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

  const handleDelete = async () => {
    try {
      setDeleting(true);

      const { error: dbError } = await supabase
        .from('clothing_items')
        .delete()
        .eq('id', currentItem.id);

      if (dbError) throw dbError;

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

  const handleMarkReturned = async () => {
    try {
      const { error } = await supabase
        .from('clothing_items')
        .update({ is_lent: false, lent_to_name: null, lent_date: null, expected_return_date: null })
        .eq('id', currentItem.id);
      if (error) throw error;
      setCurrentItem(prev => ({
        ...prev,
        is_lent: false,
        lent_to_name: null,
        lent_date: null,
        expected_return_date: null,
      }));
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const detailRows = [
    { label: 'Category', value: currentItem.category },
    currentItem.subcategory ? { label: 'Subcategory', value: currentItem.subcategory } : null,
    { label: 'Color', value: currentItem.color },
    { label: 'Season', value: currentItem.season },
  ].filter(Boolean);

  const displayPhoto = newPhoto || currentItem.image_url;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        {editing ? (
          <Pressable onPress={() => setEditing(false)} disabled={saving}>
            <Text style={[styles.headerAction, saving && styles.headerActionDisabled]}>Cancel</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </Pressable>
        )}

        <Text style={styles.headerTitle} numberOfLines={1}>
          {editing ? 'Edit Item' : currentItem.name}
        </Text>

        {editing ? (
          <Pressable onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#9b59b6" />
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
                    <Text style={styles.photoPlaceholderIcon}>📷</Text>
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
                <Text style={styles.imagePlaceholderIcon}>👗</Text>
              </View>
            )
          )}

          {/* View mode: detail card + delete */}
          {!editing && (
            <>
              {currentItem.is_lent && (
                <View style={styles.lentBanner}>
                  <View style={styles.lentBannerRow}>
                    <Text style={styles.lentBannerIcon}>🤝</Text>
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

              <View style={styles.detailCard}>
                <Text style={styles.itemName}>{currentItem.name}</Text>
                {detailRows.map(({ label, value }) => (
                  <View key={label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text style={styles.detailValue}>{value}</Text>
                  </View>
                ))}
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
                  dropdownIconColor="#9b59b6"
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
                  dropdownIconColor="#9b59b6"
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

              <Pressable
                style={styles.lendToggleRow}
                onPress={() => setIsLent(v => !v)}
              >
                <View style={[styles.lendCheckbox, isLent && styles.lendCheckboxChecked]}>
                  {isLent && <Text style={styles.lendCheckboxMark}>✓</Text>}
                </View>
                <Text style={styles.lendToggleLabel}>Lent to a friend</Text>
              </Pressable>

              {isLent && (
                <>
                  <Text style={styles.label}>Lent to</Text>
                  <TextInput
                    style={styles.input}
                    value={lentToName}
                    onChangeText={setLentToName}
                    placeholder="Friend's name"
                    placeholderTextColor="#9B9B9B"
                  />

                  <Text style={styles.label}>Date lent</Text>
                  <Pressable
                    style={styles.dateButton}
                    onPress={() => setShowLentDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>{formatDateForDisplay(lentDate)}</Text>
                    <Text>📅</Text>
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

                  <Text style={styles.label}>
                    Expected return{' '}
                    <Text style={styles.labelOptional}>(optional)</Text>
                  </Text>
                  <Pressable
                    style={styles.dateButton}
                    onPress={() => setShowReturnDatePicker(true)}
                  >
                    <Text style={styles.dateButtonText}>
                      {expectedReturnDate
                        ? formatDateForDisplay(expectedReturnDate)
                        : 'Not set'}
                    </Text>
                    <Text>📅</Text>
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
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    borderBottomColor: '#9b59b6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    fontSize: 28,
    color: '#9b59b6',
    fontWeight: 'bold',
    width: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1C',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerAction: {
    fontSize: 16,
    color: '#9b59b6',
    fontWeight: '600',
    width: 44,
    textAlign: 'right',
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
  },
  detailValue: {
    fontSize: 14,
    color: '#1C1C1C',
    fontWeight: '600',
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
  },
  changePhotoButton: {
    marginTop: 12,
  },
  changePhotoText: {
    color: '#9b59b6',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 20,
  },
  label: {
    color: '#9b59b6',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#EDEAE4',
    color: '#1C1C1C',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D9D5CE',
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
    backgroundColor: '#9b59b6',
    borderColor: '#9b59b6',
  },
  chipText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#fff',
  },
  // ── Lend (view mode) ──
  lentBanner: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    margin: 15,
    borderRadius: 12,
    padding: 14,
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
  },
  lentBannerSub: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 18,
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
    backgroundColor: '#9b59b6',
    borderColor: '#9b59b6',
  },
  lendCheckboxMark: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  },
  labelOptional: {
    fontWeight: '400',
    color: '#6B7280',
  },
  clearDate: {
    color: '#9b59b6',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
  },
});
