import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

var ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
var OCCASIONS = ['Casual', 'Work', 'Date Night', 'Active', 'Formal'];

var { width: SCREEN_WIDTH } = Dimensions.get('window');
// card has 16px outer margin each side + 16px inner padding each side
var IMAGE_SIZE = (SCREEN_WIDTH - 32 - 32 - 8) / 2;

var WEATHER_CODES = {
  0:  { label: 'Sunny',           emoji: '☀️'  },
  1:  { label: 'Mostly Clear',    emoji: '🌤️'  },
  2:  { label: 'Partly Cloudy',   emoji: '⛅'  },
  3:  { label: 'Cloudy',          emoji: '☁️'  },
  45: { label: 'Foggy',           emoji: '🌫️'  },
  48: { label: 'Foggy',           emoji: '🌫️'  },
  51: { label: 'Light Drizzle',   emoji: '🌦️'  },
  53: { label: 'Drizzle',         emoji: '🌦️'  },
  55: { label: 'Heavy Drizzle',   emoji: '🌧️'  },
  61: { label: 'Light Rain',      emoji: '🌧️'  },
  63: { label: 'Rain',            emoji: '🌧️'  },
  65: { label: 'Heavy Rain',      emoji: '🌧️'  },
  71: { label: 'Light Snow',      emoji: '🌨️'  },
  73: { label: 'Snow',            emoji: '❄️'  },
  75: { label: 'Heavy Snow',      emoji: '❄️'  },
  80: { label: 'Showers',         emoji: '🌦️'  },
  81: { label: 'Showers',         emoji: '🌧️'  },
  82: { label: 'Heavy Showers',   emoji: '🌧️'  },
  95: { label: 'Thunderstorm',    emoji: '⛈️'  },
  96: { label: 'Thunderstorm',    emoji: '⛈️'  },
  99: { label: 'Thunderstorm',    emoji: '⛈️'  },
};

function decodeWeather(code) {
  if (WEATHER_CODES[code]) return WEATHER_CODES[code];
  var keys = Object.keys(WEATHER_CODES).map(Number).sort((a, b) => a - b);
  var closest = keys.reduce((p, c) => (Math.abs(c - code) < Math.abs(p - code) ? c : p));
  return WEATHER_CODES[closest] ?? { label: 'Clear', emoji: '🌡️' };
}

export default function HomeScreen() {
  var [outfits, setOutfits]     = useState([]);
  var [weather, setWeather]     = useState(null);
  var [occasion, setOccasion]   = useState(null);
  var [loading, setLoading]     = useState(false);
  var [error, setError]         = useState(null);
  var [showPicker, setShowPicker] = useState(false);

  var handleGetOutfits = () => {
    setOutfits([]);
    setError(null);
    setShowPicker(true);
  };

  var handleSelectOccasion = async (selected) => {
    setOccasion(selected);
    setShowPicker(false);
    await generateOutfits(selected);
  };

  var generateOutfits = async (selectedOccasion) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch wardrobe
      var { data: { user } } = await supabase.auth.getUser();
      var { data: wardrobe, error: wErr } = await supabase
        .from('clothing_items')
        .select('id, name, category, subcategory, color, season, image_url')
        .eq('user_id', user.id);

      if (wErr) throw wErr;

      if (!wardrobe || wardrobe.length === 0) {
        setError('empty_wardrobe');
        return;
      }

      // 2. Get location permission + coords
      var { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('location_denied');
        return;
      }

      var loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      var { latitude, longitude } = loc.coords;

      // 3. Fetch weather from Open-Meteo
      var weatherResp = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&temperature_unit=fahrenheit`
      );
      var weatherJson = await weatherResp.json();
      var temp = Math.round(weatherJson.current.temperature_2m);
      var { label, emoji } = decodeWeather(weatherJson.current.weathercode);
      var weatherData = { temp, condition: label, emoji };
      setWeather(weatherData);

      // 4. Call Anthropic
      var wardrobeList = wardrobe
        .map(i => `id:${i.id} | name:${i.name} | category:${i.category} | color:${i.color} | season:${i.season}`)
        .join('\n');

      var userPrompt =
        `Wardrobe items:\n${wardrobeList}\n\nWeather: ${weatherData.temp}°F, ${weatherData.condition}\nOccasion: ${selectedOccasion}`;

      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: "You are an expert personal stylist with a strong eye for color theory and pattern coordination. Given a user's wardrobe, current weather, and occasion, suggest 3 complete outfits. STYLING RULES: - Avoid clashing colors. Stick to complementary, analogous, or neutral color palettes within each outfit. - Limit patterns to one statement piece per outfit. Pair patterns with solids, not other patterns (unless intentionally coordinated like stripes + floral's in matching tones). - Match the formality level across all items in an outfit (don't pair athletic wear with formal pieces). - Consider the weather — don't suggest shorts in cold weather or heavy sweaters in hot weather. - Each outfit should feel cohesive and intentional, like something a stylish person would actually wear. Each outfit must only use items from the provided wardrobe list. Return ONLY a raw JSON array (starting with [ and ending with ]). No object wrapper, no markdown, no explanation.",
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);

      var aiData = await aiResp.json();
      var rawText = aiData.content?.[0]?.text?.trim() ?? '';
      var jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      var parsed = JSON.parse(jsonStr);

      // Handle if AI wrapped it in an object like { outfits: [...] }
      if (!Array.isArray(parsed)) {
        parsed = parsed.outfits || parsed.recommendations || parsed.items || Object.values(parsed)[0];
      }

      if (!Array.isArray(parsed)) {
        console.error('[OutfitRec] Unexpected AI response shape:', rawText);
        throw new Error('AI did not return an array of outfits');
      }

      // Enrich items with image_url from wardrobe
      var wardrobeMap = Object.fromEntries(wardrobe.map(i => [i.id, i]));
      var enriched = parsed.map(outfit => ({
        ...outfit,
        items: outfit.items.map(item => ({
          ...item,
          image_url: wardrobeMap[item.id]?.image_url ?? null,
        })),
      }));

      setOutfits(enriched);
    } catch (err) {
      console.error('[OutfitRec]', err.message);
      setError('generic');
    } finally {
      setLoading(false);
    }
  };

  var hasContent = loading || outfits.length > 0 || error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>ClosetPal</Text>
          <Text style={styles.subtitle}>Your personal stylist</Text>
        </View>

        {/* CTA card — shown when idle */}
        {!hasContent && (
          <TouchableOpacity style={styles.ctaCard} onPress={handleGetOutfits} activeOpacity={0.85}>
            <Text style={styles.ctaEmoji}>✨</Text>
            <Text style={styles.ctaTitle}>Get Today's Outfits</Text>
            <Text style={styles.ctaSub}>AI picks based on your wardrobe & weather</Text>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color="#9b59b6" style={{ marginBottom: 16 }} />
            <Text style={styles.stateTitle}>Styling your outfits…</Text>
            <Text style={styles.stateSub}>Checking your wardrobe & weather</Text>
          </View>
        )}

        {/* Empty wardrobe */}
        {error === 'empty_wardrobe' && (
          <View style={styles.stateBox}>
            <Text style={styles.stateEmoji}>👗</Text>
            <Text style={styles.stateTitle}>Your wardrobe is empty</Text>
            <Text style={styles.stateSub}>Add some clothes first to get outfit ideas!</Text>
          </View>
        )}

        {/* Location denied */}
        {error === 'location_denied' && (
          <View style={styles.stateBox}>
            <Text style={styles.stateEmoji}>📍</Text>
            <Text style={styles.stateTitle}>Location Access Needed</Text>
            <Text style={styles.stateSub}>
              Enable location permissions in your device settings to get weather-based outfit recommendations.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleGetOutfits}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Generic error */}
        {error === 'generic' && (
          <View style={styles.stateBox}>
            <Text style={styles.stateEmoji}>😕</Text>
            <Text style={styles.stateTitle}>Something went wrong</Text>
            <Text style={styles.stateSub}>Couldn't generate outfit recommendations. Please try again.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleGetOutfits}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Outfit cards */}
        {outfits.length > 0 && (
          <>
            {outfits.map(outfit => (
              <OutfitCard key={outfit.outfit_number} outfit={outfit} weather={weather} occasion={occasion} />
            ))}
            <TouchableOpacity style={styles.refreshBtn} onPress={handleGetOutfits} activeOpacity={0.85}>
              <Text style={styles.refreshBtnText}>🔄  Regenerate Outfits</Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {/* Occasion picker bottom sheet */}
      <Modal
        visible={showPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>What's the occasion?</Text>
            {OCCASIONS.map(occ => (
              <TouchableOpacity
                key={occ}
                style={styles.occasionRow}
                onPress={() => handleSelectOccasion(occ)}
                activeOpacity={0.7}
              >
                <Text style={styles.occasionText}>{occ}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function OutfitCard({ outfit, weather, occasion }) {
  var displayImages = outfit.items.filter(i => i.image_url).slice(0, 4);

  return (
    <View style={styles.card}>
      {/* Top row: weather+occasion tag + outfit number */}
      <View style={styles.cardTopRow}>
        {weather && occasion && (
          <View style={styles.cardTag}>
            <Text style={styles.cardTagText}>
              {weather.emoji} {weather.temp}° · {occasion}
            </Text>
          </View>
        )}
        <Text style={styles.outfitLabel}>Outfit {outfit.outfit_number}</Text>
      </View>

      {/* Photo grid */}
      {displayImages.length > 0 ? (
        <View style={styles.photoGrid}>
          {displayImages.map((item, idx) => (
          <Image
            key={`${outfit.outfit_number}-${item.id}-${idx}`}
            source={{ uri: item.image_url }}
            style={styles.photoCell}
            resizeMode="cover"
          />
        ))}
        </View>
      ) : (
        <View style={styles.noPhotos}>
          <Text style={styles.noPhotosText}>No photos available</Text>
        </View>
      )}

      {/* Item names */}
      <View style={styles.itemList}>
        {outfit.items.map((item, idx) => (
          <Text key={`${outfit.outfit_number}-${item.id}-${idx}`} style={styles.itemName}>• {item.name}</Text>
        ))}
      </View>

      {/* Styling note */}
      {outfit.styling_note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>✨ Stylist's Note</Text>
          <Text style={styles.noteText}>{outfit.styling_note}</Text>
        </View>
      ) : null}
    </View>
  );
}

var styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1C',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
  },

  // ── CTA card ────────────────────────────────────────────────────────────────
  ctaCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#9b59b6',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#9b59b6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  ctaSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },

  // ── State boxes (loading / errors) ─────────────────────────────────────────
  stateBox: {
    marginHorizontal: 16,
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  stateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#9b59b6',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // ── Outfit card ─────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTag: {
    backgroundColor: '#F3E8FF',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  cardTagText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '500',
  },
  outfitLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },

  // ── Photo grid ──────────────────────────────────────────────────────────────
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  photoCell: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 10,
    backgroundColor: '#EDEAE4',
  },
  noPhotos: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F5F0',
    borderRadius: 10,
    marginBottom: 12,
  },
  noPhotosText: {
    color: '#6B7280',
    fontSize: 13,
  },

  // ── Item list ───────────────────────────────────────────────────────────────
  itemList: {
    marginBottom: 10,
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },

  // ── Styling note ────────────────────────────────────────────────────────────
  noteBox: {
    backgroundColor: '#F9F5FF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#9b59b6',
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9b59b6',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
  },

  // ── Regenerate button ───────────────────────────────────────────────────────
  refreshBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: '#9b59b6',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: '#9b59b6',
    fontWeight: '600',
    fontSize: 15,
  },

  // ── Occasion picker modal ───────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 16,
    textAlign: 'center',
  },
  occasionRow: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  occasionText: {
    fontSize: 16,
    color: '#1C1C1C',
    textAlign: 'center',
  },
});
