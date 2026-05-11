import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';

const COLOR_OPTIONS = [
  'Black', 'White', 'Cream', 'Navy', 'Red', 'Pink',
  'Green', 'Yellow', 'Orange', 'Purple', 'Brown', 'Gray',
  'Neutrals', 'Bold/Brights',
];
const PATTERN_OPTIONS = [
  'Solid', 'Stripes', 'Floral', 'Plaid',
  'Animal Print', 'Geometric', 'Polka Dot', 'Abstract',
];
const LIFESTYLE_OPTIONS = ['Casual', 'Professional', 'Active', 'Eclectic', 'Minimalist'];
const SKIP_KEY = 'stylePrefsSkipped';
const QUESTIONS = [
  'What colors do you love?',
  'Any favorite patterns?',
  'Favorite brands?',
  'How would you describe your lifestyle?',
];

function buildStyleBio(colors, patterns, lifestyle) {
  const segments = [];
  if (colors.length > 0) {
    const top = colors.slice(0, 2);
    segments.push(`I love ${top.join(' and ')} tones`);
  }
  if (patterns.length > 0) {
    const top = patterns.slice(0, 2);
    const patStr = `${top.join(' and ')} pieces`;
    segments.length === 0
      ? segments.push(`I love ${patStr}`)
      : segments.push(patStr);
  }
  if (lifestyle) {
    const lifStr = `a ${lifestyle.toLowerCase()} aesthetic`;
    segments.length === 0
      ? segments.push(`I have ${lifStr}`)
      : segments.push(lifStr);
  }
  if (segments.length === 0) return '';
  const last = segments.pop();
  return segments.length === 0 ? `${last}.` : `${segments.join(', ')}, and ${last}.`;
}

function MultiChip({ options, selected, onToggle }) {
  return (
    <View style={styles.chipGrid}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, selected.includes(opt) && styles.chipSelected]}
          onPress={() => onToggle(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, selected.includes(opt) && styles.chipTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SingleChip({ options, selected, onSelect }) {
  return (
    <View style={styles.chipGrid}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, selected === opt && styles.chipSelected]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.chipText, selected === opt && styles.chipTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function StylePreferencesModal({ onDismiss }) {
  const [step, setStep] = useState(0);
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedPatterns, setSelectedPatterns] = useState([]);
  const [brandsText, setBrandsText] = useState('');
  const [lifestyle, setLifestyle] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleColor = c =>
    setSelectedColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const togglePattern = p =>
    setSelectedPatterns(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  const handleSkip = async () => {
    try { await AsyncStorage.setItem(SKIP_KEY, 'true'); } catch (_) {}
    onDismiss();
  };

  const handleNext = () => step < 3 ? setStep(s => s + 1) : handleComplete();
  const handleBack = () => step > 0 && setStep(s => s - 1);

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { onDismiss(); return; }
      const brands = brandsText.split(',').map(b => b.trim()).filter(Boolean);
      const style_bio = buildStyleBio(selectedColors, selectedPatterns, lifestyle);
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        favorite_colors:   selectedColors.length > 0   ? selectedColors   : null,
        favorite_patterns: selectedPatterns.length > 0  ? selectedPatterns  : null,
        favorite_brands:   brands.length > 0            ? brands            : null,
        lifestyle:         lifestyle || null,
        style_bio:         style_bio || null,
      }, { onConflict: 'id' });
      if (error) {
        console.error('[StylePrefs] upsert error:', error.message);
        Alert.alert('Error', 'Could not save your preferences. Please try again.');
        return;
      }
      onDismiss();
    } catch (e) {
      console.error('[StylePrefs] save error:', e.message);
      Alert.alert('Error', 'Could not save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={handleSkip}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kvContainer}
        >
          <View style={styles.card}>
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3].map(i => (
                <View key={i} style={[styles.dot, step === i && styles.dotActive]} />
              ))}
            </View>

            <Text style={styles.question}>{QUESTIONS[step]}</Text>

            <ScrollView
              style={styles.contentScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {step === 0 && (
                <MultiChip options={COLOR_OPTIONS} selected={selectedColors} onToggle={toggleColor} />
              )}
              {step === 1 && (
                <MultiChip options={PATTERN_OPTIONS} selected={selectedPatterns} onToggle={togglePattern} />
              )}
              {step === 2 && (
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Zara, ASOS, Levi's"
                  placeholderTextColor="#AAAAAA"
                  value={brandsText}
                  onChangeText={setBrandsText}
                  returnKeyType="done"
                  autoCapitalize="words"
                />
              )}
              {step === 3 && (
                <SingleChip options={LIFESTYLE_OPTIONS} selected={lifestyle} onSelect={setLifestyle} />
              )}
            </ScrollView>

            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={handleBack}
                style={[styles.navBtn, styles.navBtnSecondary, step === 0 && styles.navBtnHidden]}
                disabled={step === 0}
              >
                <Text style={styles.navBtnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleNext}
                style={[styles.navBtn, styles.navBtnPrimary]}
                disabled={saving}
              >
                <Text style={styles.navBtnPrimaryText}>
                  {step === 3 ? (saving ? 'Saving…' : 'Done') : 'Next'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  kvContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  dotActive: {
    backgroundColor: PRIMARY,
    width: 20,
  },
  question: {
    fontSize: 20,
    fontFamily: FONTS.heading,
    color: '#1C1C1C',
    marginBottom: 16,
    textAlign: 'center',
  },
  contentScroll: {
    maxHeight: 280,
    marginBottom: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  chipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    fontSize: 14,
    fontFamily: FONTS.body,
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: FONTS.body,
    color: '#1C1C1C',
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  navBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  navBtnPrimary:   { backgroundColor: PRIMARY },
  navBtnSecondary: { borderWidth: 1.5, borderColor: '#D1D5DB' },
  navBtnHidden:    { opacity: 0 },
  navBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  navBtnSecondaryText: {
    color: '#6B7280',
    fontSize: 15,
    fontFamily: FONTS.body,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontFamily: FONTS.body,
  },
});
