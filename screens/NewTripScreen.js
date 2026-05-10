import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { formatDateForDisplay, formatDateForDB } from '../lib/constants';
import { useSubscription } from '../hooks/useSubscription';
import { usageLimits } from '../hooks/usageLimits';
import { PRIMARY, SECONDARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';

const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;

const TRIP_PURPOSES = ['Business', 'Vacation', 'Wedding', 'Beach', 'City Trip', 'Outdoor'];
const WEATHER_VIBES = ['Warm', 'Cold', 'Mixed', 'Tropical', 'Snow'];

export default function NewTripScreen({ navigation }) {
  const { isPaid } = useSubscription();
  const { checkTrips, incrementTrips } = usageLimits(isPaid);

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const [tripPurpose, setTripPurpose] = useState('');
  const [weatherSource, setWeatherSource] = useState('auto');
  const [weatherVibe, setWeatherVibe] = useState('');
  const [loading, setLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const durationDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000) + 1);

  const validate = () => {
    if (!destination.trim()) {
      Alert.alert('Missing Info', 'Please enter a destination.');
      return false;
    }
    if (endDate < startDate) {
      Alert.alert('Invalid Dates', 'End date must be on or after the start date.');
      return false;
    }
    if (weatherSource === 'manual' && !weatherVibe) {
      Alert.alert('Missing Info', 'Please select a weather vibe.');
      return false;
    }
    return true;
  };

  const geocodeDestination = async (dest) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const results = await Location.geocodeAsync(dest);
      if (results.length > 0) {
        return { lat: results[0].latitude, lng: results[0].longitude };
      }
    } catch (e) {
      console.warn('[Trips] Geocode failed:', e.message);
    }
    return null;
  };

  const fetchWeather = async (lat, lng) => {
    try {
      const resp = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=imperial&cnt=40`
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      const list = data.list || [];
      if (list.length === 0) return null;
      const avgTemp = Math.round(list.reduce((s, e) => s + e.main.temp, 0) / list.length);
      const freq = {};
      list.forEach(e => {
        const c = e.weather[0].main;
        freq[c] = (freq[c] || 0) + 1;
      });
      const dominant = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0];
      return { avgTemp, dominant };
    } catch (e) {
      console.warn('[Trips] Weather fetch failed:', e.message);
      return null;
    }
  };

  const vibeFromWeather = (weather) => {
    if (!weather) return 'Mixed';
    const { avgTemp, dominant = '' } = weather;
    const cond = dominant.toLowerCase();
    if (cond.includes('snow')) return 'Snow';
    if (avgTemp >= 80) return 'Warm';
    if (avgTemp <= 40) return 'Cold';
    if (cond.includes('rain') || cond.includes('cloud')) return 'Mixed';
    return 'Warm';
  };

  const handleGenerate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const tripsOk = await checkTrips();
      if (!tripsOk) return;

      // Wardrobe check — need at least 5 items to generate a meaningful list
      const { data: wardrobe } = await supabase
        .from('clothing_items')
        .select('id, name, category, subcategory, color, season, formality')
        .eq('user_id', user.id)
        .eq('is_lent', false);

      if (!wardrobe || wardrobe.length < 5) {
        Alert.alert(
          'Wardrobe Too Small',
          'Please add at least 5 clothing items to your wardrobe before planning a trip.',
          [
            { text: 'Add Clothes', onPress: () => navigation.navigate('Wardrobe') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      // Geocode destination and optionally fetch weather
      let coords = null;
      let resolvedVibe = weatherVibe;

      if (weatherSource === 'auto') {
        coords = await geocodeDestination(destination);
        if (coords) {
          const weather = await fetchWeather(coords.lat, coords.lng);
          resolvedVibe = vibeFromWeather(weather);
        } else {
          resolvedVibe = 'Mixed';
        }
      }

      // Build Claude prompt with full wardrobe
      const wardrobeList = wardrobe
        .map(i =>
          `ID:${i.id} | ${i.name} | ${i.category}${i.subcategory ? '/' + i.subcategory : ''} | ${i.color} | ${i.season}${i.formality ? ' | ' + i.formality : ''}`
        )
        .join('\n');

      const tripInfo = [
        `Destination: ${destination}`,
        `Dates: ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)} (${durationDays} days)`,
        `Purpose: ${tripPurpose || 'General travel'}`,
        `Weather vibe: ${resolvedVibe}`,
      ].join('\n');

      const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: `You are a personal stylist helping pack for a specific trip. Select items from the user's wardrobe appropriate for the trip duration, purpose, and weather. Return ONLY valid JSON in this exact format, no markdown, no explanation:
{"items":[{"clothing_item_id":"<exact id from wardrobe>","reason":"<1 sentence why>"}],"ai_notes":"<1-2 sentences of overall packing advice>"}
Rules: Pick 8-15 items depending on trip length. Use exact item IDs from the wardrobe list. Mix categories (tops, bottoms, shoes, outerwear, accessories). Match weather vibe and trip purpose formality.`,
          messages: [
            {
              role: 'user',
              content: `My wardrobe:\n${wardrobeList}\n\nTrip details:\n${tripInfo}`,
            },
          ],
        }),
      });

      if (!aiResp.ok) throw new Error(`Claude API error ${aiResp.status}`);
      const aiData = await aiResp.json();
      let rawText = aiData.content?.[0]?.text?.trim() ?? '';
      rawText = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(rawText);

      const packingItems = (parsed.items || []).map(item => ({
        clothing_item_id: item.clothing_item_id,
        reason: item.reason,
        packed: false,
      }));

      const { data: newTrip, error: saveError } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: destination.trim(),
          destination_lat: coords?.lat ?? null,
          destination_lng: coords?.lng ?? null,
          start_date: formatDateForDB(startDate),
          end_date: formatDateForDB(endDate),
          weather_source: weatherSource,
          weather_vibe: resolvedVibe || null,
          trip_purpose: tripPurpose || null,
          packing_items: packingItems,
          ai_notes: parsed.ai_notes ?? null,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      await incrementTrips();
      navigation.replace('TripDetail', { trip: newTrip });
    } catch (err) {
      console.error('[NewTrip]', err);
      Alert.alert('Error', 'Failed to generate packing list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>New Trip</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>Destination</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Paris, France"
          placeholderTextColor="#9CA3AF"
          value={destination}
          onChangeText={setDestination}
        />

        <Text style={styles.label}>Start Date</Text>
        <Pressable style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
          <Text style={styles.dateBtnText}>{formatDateForDisplay(startDate)}</Text>
          <Text>📅</Text>
        </Pressable>
        {showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={(_, date) => {
              setShowStartPicker(Platform.OS === 'ios');
              if (date) setStartDate(date);
            }}
          />
        )}

        <Text style={styles.label}>End Date</Text>
        <Pressable style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
          <Text style={styles.dateBtnText}>{formatDateForDisplay(endDate)}</Text>
          <Text>📅</Text>
        </Pressable>
        {showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            minimumDate={startDate}
            onChange={(_, date) => {
              setShowEndPicker(Platform.OS === 'ios');
              if (date) setEndDate(date);
            }}
          />
        )}

        <Text style={styles.label}>
          Trip Purpose <Text style={styles.optional}>(optional)</Text>
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
        >
          {TRIP_PURPOSES.map(p => (
            <Pressable
              key={p}
              style={[styles.chip, tripPurpose === p && styles.chipSelected]}
              onPress={() => setTripPurpose(tripPurpose === p ? '' : p)}
            >
              <Text style={[styles.chipText, tripPurpose === p && styles.chipTextSelected]}>
                {p}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Weather</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, weatherSource === 'auto' && styles.toggleActive]}
            onPress={() => setWeatherSource('auto')}
          >
            <Text style={[styles.toggleText, weatherSource === 'auto' && styles.toggleTextActive]}>
              🌤️  Auto-fetch
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, weatherSource === 'manual' && styles.toggleActive]}
            onPress={() => setWeatherSource('manual')}
          >
            <Text style={[styles.toggleText, weatherSource === 'manual' && styles.toggleTextActive]}>
              🎛️  I'll choose
            </Text>
          </Pressable>
        </View>

        {weatherSource === 'auto' && (
          <Text style={styles.hint}>
            We'll fetch the forecast for {destination.trim() || 'your destination'} and pick the right vibe automatically. Falls back to Mixed if unavailable.
          </Text>
        )}

        {weatherSource === 'manual' && (
          <>
            <Text style={[styles.label, { marginTop: 16 }]}>Weather Vibe</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContent}
            >
              {WEATHER_VIBES.map(v => (
                <Pressable
                  key={v}
                  style={[styles.chip, weatherVibe === v && styles.chipSelected]}
                  onPress={() => setWeatherVibe(v)}
                >
                  <Text style={[styles.chipText, weatherVibe === v && styles.chipTextSelected]}>
                    {v}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <Pressable
          style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.generateBtnText}>Generating packing list…</Text>
            </View>
          ) : (
            <Text style={styles.generateBtnText}>✈️  Generate Packing List</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEAE4',
  },
  backBtn: {
    width: 60,
  },
  backText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1C',
    fontFamily: FONTS.heading,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 8,
    marginTop: 20,
    fontFamily: FONTS.bodyMedium,
  },
  optional: {
    fontWeight: '400',
    color: '#6B7280',
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
  dateBtn: {
    backgroundColor: '#EDEAE4',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateBtnText: {
    fontSize: 16,
    color: '#1C1C1C',
    fontFamily: FONTS.bodyMedium,
  },
  chipsContent: {
    gap: 8,
    paddingRight: 4,
    paddingBottom: 2,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: FONTS.bodyMedium,
  },
  chipTextSelected: {
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D9D5CE',
    alignItems: 'center',
    backgroundColor: '#EDEAE4',
  },
  toggleActive: {
    borderColor: PRIMARY,
    backgroundColor: SECONDARY,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: FONTS.bodyMedium,
  },
  toggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
    lineHeight: 18,
    fontFamily: FONTS.body,
  },
  generateBtn: {
    marginTop: 36,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
});
