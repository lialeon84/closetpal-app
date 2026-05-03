import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';

const REMOVE_BG_API_KEY = 'cxoCqM6GMUgspjtjgQzKwRr7';
const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';
const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

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

const COLORS = [
  { name: 'Black', hex: '#1A1A1A' },
  { name: 'White', hex: '#F0F0F0' },
  { name: 'Gray', hex: '#9E9E9E' },
  { name: 'Charcoal', hex: '#36454F' },
  { name: 'Beige', hex: '#D4B896' },
  { name: 'Cream', hex: '#EEE8D5' },
  { name: 'Brown', hex: '#795548' },
  { name: 'Tan', hex: '#C4A882' },
  { name: 'Navy', hex: '#1B2A4A' },
  { name: 'Blue', hex: '#2196F3' },
  { name: 'Light Blue', hex: '#87CEEB' },
  { name: 'Royal Blue', hex: '#4169E1' },
  { name: 'Red', hex: '#E53935' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Pink', hex: '#F48FB1' },
  { name: 'Hot Pink', hex: '#E91E63' },
  { name: 'Green', hex: '#4CAF50' },
  { name: 'Olive', hex: '#6B7C2A' },
  { name: 'Mint', hex: '#98D9C2' },
  { name: 'Yellow', hex: '#FFEB3B' },
  { name: 'Orange', hex: '#FF9800' },
  { name: 'Purple', hex: '#9C27B0' },
  { name: 'Lavender', hex: '#C9B1E8' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Silver', hex: '#C0C0C0' },
  { name: 'Multicolor', hex: null },
  { name: 'Other', hex: null },
];

function isLightColor(hex) {
  if (!hex) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 190;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 1024;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default function AddItemScreen({ navigation }) {
  const [photo, setPhoto] = useState(null);
  const [processingBg, setProcessingBg] = useState(false);
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [aiAutoFilled, setAiAutoFilled] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tops');
  const [subcategory, setSubcategory] = useState(SUBCATEGORIES['Tops'][0]);
  const [color, setColor] = useState('');
  const [isOtherColor, setIsOtherColor] = useState(false);
  const [season, setSeason] = useState('All Season');
  const [saving, setSaving] = useState(false);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    setSubcategory(SUBCATEGORIES[newCat][0]);
  };

  const selectColor = (colorName) => {
    if (colorName === 'Other') {
      setIsOtherColor(true);
      setColor('');
    } else {
      setIsOtherColor(false);
      setColor(colorName);
    }
  };

  // ─── Photo picking ────────────────────────────────────────────────────────

  const pickImage = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) launchCamera();
          if (buttonIndex === 2) launchLibrary();
        }
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
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
    if (!result.canceled) processBackground(result.assets[0].uri);
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
    if (!result.canceled) processBackground(result.assets[0].uri);
  };

  // ─── AI analysis ─────────────────────────────────────────────────────────

  const analyzeWithAI = async (imageUri) => {
    if (!ANTHROPIC_API_KEY) {
      console.log('[AI] No EXPO_PUBLIC_ANTHROPIC_API_KEY set — skipping analysis');
      return;
    }
    setAnalyzingAI(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: base64 },
              },
              {
                type: 'text',
                text: `Analyze this clothing item. Return ONLY a valid JSON object with no markdown or extra text:
{"name":"concise descriptive name","category":"Tops|Bottoms|Shoes|Outerwear|Accessories|Dresses","subcategory":"matching option for category (Tops→T-Shirt|Tank Top|Blouse|Button-Down|Sweater|Hoodie|Business Casual Top|Polo) (Bottoms→Jeans|Leggings|Shorts|Skirt|Dress Pants|Business Casual Pants|Sweatpants) (Shoes→Sneakers|Heels|Boots|Sandals|Flats|Loafers|Athletic) (Outerwear→Jacket|Coat|Blazer|Cardigan|Vest) (Dresses→Casual Dress|Business Casual Dress|Formal Dress|Sundress) (Accessories→Bag|Belt|Hat|Scarf|Jewelry|Sunglasses)","color":"Black|White|Gray|Charcoal|Beige|Cream|Brown|Tan|Navy|Blue|Light Blue|Royal Blue|Red|Burgundy|Pink|Hot Pink|Green|Olive|Mint|Yellow|Orange|Purple|Lavender|Gold|Silver|Multicolor|Other","season":"Spring|Summer|Fall|Winter|All Season"}`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        console.log('[AI] API error', response.status, await response.text());
        return;
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text?.trim() ?? '';
      const jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      const result = JSON.parse(jsonStr);

      if (result.name) setName(result.name);

      if (CATEGORIES.includes(result.category)) {
        setCategory(result.category);
        const validSub = SUBCATEGORIES[result.category]?.includes(result.subcategory)
          ? result.subcategory
          : SUBCATEGORIES[result.category][0];
        setSubcategory(validSub);
      }

      const colorMatch = COLORS.find((c) => c.name === result.color);
      if (colorMatch) {
        if (colorMatch.name === 'Other') {
          setIsOtherColor(true);
          setColor('');
        } else {
          setIsOtherColor(false);
          setColor(colorMatch.name);
        }
      }

      if (SEASONS.includes(result.season)) setSeason(result.season);
      setAiAutoFilled(true);
    } catch (err) {
      console.log('[AI] Analysis failed:', err.message);
    } finally {
      setAnalyzingAI(false);
    }
  };

  // ─── Background removal ───────────────────────────────────────────────────

  const processBackground = async (uri) => {
    setPhoto(uri);
    setProcessingBg(true);

    try {
      console.log('[RemoveBg] Starting background removal');
      console.log('[RemoveBg] Photo URI:', uri);
      console.log('[RemoveBg] API key (first 6 chars):', REMOVE_BG_API_KEY.slice(0, 6));

      const formData = new FormData();
      formData.append('image_file', { uri, type: 'image/jpeg', name: 'photo.jpg' });
      formData.append('size', 'auto');

      console.log('[RemoveBg] Sending request to:', REMOVE_BG_URL);

      const response = await fetch(REMOVE_BG_URL, {
        method: 'POST',
        headers: { 'X-Api-Key': REMOVE_BG_API_KEY },
        body: formData,
      });

      console.log('[RemoveBg] Response status:', response.status, response.statusText);

      const headers = {};
      response.headers.forEach((value, key) => { headers[key] = value; });
      console.log('[RemoveBg] Response headers:', JSON.stringify(headers, null, 2));

      if (!response.ok) {
        const rawBody = await response.text();
        console.log('[RemoveBg] Error response body (raw):', rawBody);
        let message = `Remove.bg error (${response.status})`;
        try {
          const json = JSON.parse(rawBody);
          console.log('[RemoveBg] Error response body (parsed):', JSON.stringify(json, null, 2));
          message = json.errors?.[0]?.title || message;
        } catch (parseErr) {
          console.log('[RemoveBg] Body is not JSON:', parseErr.message);
        }
        throw new Error(message);
      }

      console.log('[RemoveBg] Success — reading response body');
      const arrayBuffer = await response.arrayBuffer();
      console.log('[RemoveBg] Response body size (bytes):', arrayBuffer.byteLength);

      const base64 = arrayBufferToBase64(arrayBuffer);
      const tempUri = `${FileSystem.cacheDirectory}item_${Date.now()}.png`;
      console.log('[RemoveBg] Writing processed image to:', tempUri);

      await FileSystem.writeAsStringAsync(tempUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log('[RemoveBg] Done — photo updated to processed URI');
      setPhoto(tempUri);
      analyzeWithAI(tempUri); // fire and forget — manages its own loading state
    } catch (error) {
      console.error('[RemoveBg] Caught error:', error.message);
      console.error('[RemoveBg] Full error:', error);
      Alert.alert(
        'Background Removal Failed',
        `${error.message}\n\nThe original photo will be used instead.`,
      );
    } finally {
      setProcessingBg(false);
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!photo) {
      Alert.alert('Missing photo', 'Please add a photo of your item.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Missing name', 'Please enter a name for your item.');
      return;
    }
    if (!color.trim()) {
      Alert.alert('Missing color', 'Please select or enter a color.');
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();

      const fileExt = (photo.split('.').pop().split('?')[0] || 'jpg').toLowerCase();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const response = await fetch(photo);
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

      const { error: insertError } = await supabase
        .from('clothing_items')
        .insert({
          user_id: user.id,
          name: name.trim(),
          category,
          subcategory,
          color: color.trim(),
          season,
          image_url: publicData.publicUrl,
        });
      if (insertError) throw insertError;

      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const busy = processingBg || saving || analyzingAI;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} disabled={busy}>
            <Text style={[styles.backButton, busy && styles.disabledText]}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.brandSymbol}>👗</Text>
            <Text style={styles.headerTitle}>Add Item</Text>
          </View>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.photoSection}>
            <Pressable onPress={busy ? undefined : pickImage} style={styles.photoPicker}>
              {photo ? (
                <>
                  <View style={styles.photoWhiteBg} />
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderIcon}>📷</Text>
                  <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                </View>
              )}
              {(processingBg || analyzingAI) && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.processingText}>
                    {processingBg ? 'Removing background…' : 'Analyzing with AI…'}
                  </Text>
                </View>
              )}
            </Pressable>

            {photo && !processingBg && !analyzingAI && (
              <Pressable onPress={pickImage} style={styles.changePhotoButton}>
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </Pressable>
            )}
            {(processingBg || analyzingAI) && (
              <Text style={styles.processingSubtext}>
                {processingBg ? 'This may take a few seconds' : 'Auto-filling your details…'}
              </Text>
            )}
          </View>

          {aiAutoFilled && !analyzingAI && (
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✨ Auto-filled by AI</Text>
              <Text style={styles.aiBadgeSubtext}>Review and edit as needed</Text>
            </View>
          )}

          <View style={styles.form}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. White Linen Shirt"
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
                {SUBCATEGORIES[category].map((sub) => (
                  <Picker.Item key={sub} label={sub} value={sub} color="#1C1C1C" />
                ))}
              </Picker>
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.swatchGrid}>
              {COLORS.map((c) => {
                const selected = c.name === 'Other'
                  ? isOtherColor
                  : (!isOtherColor && color === c.name);
                return (
                  <Pressable
                    key={c.name}
                    style={styles.swatchItem}
                    onPress={() => selectColor(c.name)}
                  >
                    {c.name === 'Multicolor' ? (
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: '#fff' },
                          styles.swatchLightBorder,
                          selected && styles.swatchSelected,
                        ]}
                      >
                        <Text style={styles.swatchEmoji}>🌈</Text>
                      </View>
                    ) : c.name === 'Other' ? (
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: '#EDEAE4' },
                          styles.swatchLightBorder,
                          selected && styles.swatchSelected,
                        ]}
                      >
                        <Text style={styles.swatchOtherDots}>···</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: c.hex },
                          isLightColor(c.hex) && styles.swatchLightBorder,
                          selected && styles.swatchSelected,
                        ]}
                      />
                    )}
                    <Text
                      style={[styles.swatchLabel, selected && styles.swatchLabelSelected]}
                      numberOfLines={1}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isOtherColor && (
              <TextInput
                style={[styles.input, styles.colorOtherInput]}
                value={color}
                onChangeText={setColor}
                placeholder="Describe the color…"
                placeholderTextColor="#9B9B9B"
              />
            )}

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

          <Pressable
            style={[styles.saveButton, busy && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={busy}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>
                {processingBg ? 'Processing photo…' : analyzingAI ? 'Analyzing…' : 'Add to Wardrobe'}
              </Text>
            )}
          </Pressable>
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
  container: {
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
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backButton: {
    fontSize: 28,
    color: '#9b59b6',
    fontWeight: 'bold',
  },
  disabledText: {
    opacity: 0.3,
  },
  brandSymbol: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  placeholder: {
    width: 28,
  },
  content: {
    flex: 1,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#EDEAE4',
    marginBottom: 20,
  },
  photoPicker: {
    width: 180,
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#D9D5CE',
  },
  photoWhiteBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
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
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  processingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  changePhotoButton: {
    marginTop: 12,
  },
  changePhotoText: {
    color: '#9b59b6',
    fontSize: 16,
    fontWeight: '600',
  },
  processingSubtext: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 13,
  },
  aiBadge: {
    marginHorizontal: 20,
    marginBottom: 4,
    backgroundColor: '#F3E8FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  aiBadgeText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '600',
  },
  aiBadgeSubtext: {
    color: '#9b59b6',
    fontSize: 12,
    marginTop: 2,
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
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  swatchItem: {
    width: '20%',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLightBorder: {
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  swatchSelected: {
    borderWidth: 3,
    borderColor: '#9b59b6',
  },
  swatchEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  swatchOtherDots: {
    fontSize: 14,
    color: '#6B7280',
    letterSpacing: 2,
    lineHeight: 16,
  },
  swatchLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  swatchLabelSelected: {
    color: '#9b59b6',
    fontWeight: '600',
  },
  colorOtherInput: {
    marginTop: 10,
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
  saveButton: {
    backgroundColor: '#9b59b6',
    margin: 20,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
