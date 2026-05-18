// Home screen that generates AI-powered outfit recommendations from the user's wardrobe,
// current weather (via Open-Meteo), and a selected occasion. Supports saving favorites,
// per-item and per-outfit dislike feedback, and AI-powered item swapping.
import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Heart } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import RevenueCatUI from 'react-native-purchases-ui';
import { supabase } from '../lib/supabase';
import { PRIMARY, SECONDARY, CARD_BG } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { useSubscription } from '../hooks/useSubscription';
import { usageLimits } from '../hooks/usageLimits';

var ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
var OCCASIONS = ['Casual', 'Work', 'Date Night', 'Active', 'Formal'];

var { width: SCREEN_WIDTH } = Dimensions.get('window');
// card has 16px outer margin each side + 16px inner padding each side
// 32px outer margins + 32px inner padding + 8px gap between the two columns, divided by 2.
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

// Maps a WMO Open-Meteo weather code to a display label and emoji. Falls back to the closest
// known code when the exact code isn't in the map — the WMO spec can return codes not explicitly listed.
function decodeWeather(code) {
  if (WEATHER_CODES[code]) return WEATHER_CODES[code];
  var keys = Object.keys(WEATHER_CODES).map(Number).sort((a, b) => a - b);
  var closest = keys.reduce((p, c) => (Math.abs(c - code) < Math.abs(p - code) ? c : p));
  return WEATHER_CODES[closest] ?? { label: 'Clear', emoji: '🌡️' };
}

// Main screen component. Manages outfit generation state, favorites, and the occasion picker modal.
export default function HomeScreen() {
  var navigation = useNavigation();
  var { isPaid } = useSubscription();
  var { checkFavorites, checkOutfitRecs, incrementOutfitRecs, isOutfitRecsLocked, canDoAISwap, incrementAISwap } = usageLimits(isPaid);
  var [isLocked, setIsLocked] = useState(false);

  // Sync the lock state whenever isPaid changes (e.g. immediately after a purchase).
  useEffect(() => {
    if (isPaid) return;
    isOutfitRecsLocked().then(setIsLocked).catch(() => {});
  }, [isPaid]);

  // Re-check the lock state when the app returns to the foreground — covers purchases completed
  // inside the paywall before the customer info listener has fired.
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active' && !isPaid) {
        isOutfitRecsLocked().then(setIsLocked).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [isPaid]);

  // Outfit generation results, UI state, and per-session data.
  var [outfits, setOutfits]         = useState([]);
  var [weather, setWeather]         = useState(null);
  var [occasion, setOccasion]       = useState(null);
  var [loading, setLoading]         = useState(false);
  var [error, setError]             = useState(null);
  var [showPicker, setShowPicker]   = useState(false);
  var [favorites, setFavorites]     = useState([]);
  var [togglingKey, setTogglingKey] = useState(null);
  var [wardrobeItems, setWardrobeItems] = useState([]);
  var [currentUserId, setCurrentUserId] = useState(null);
  var togglingKeysRef = useRef(new Set());

  // Opens the occasion picker, or prompts the paywall if the free-tier daily limit has been hit.
  var handleGetOutfits = async () => {
    if (!isPaid && isLocked) {
      await RevenueCatUI.presentPaywall();
      return;
    }
    setOutfits([]);
    setError(null);
    setShowPicker(true);
  };

  // Closes the picker, verifies the outfitRecs usage cap, then kicks off outfit generation.
  var handleSelectOccasion = async (selected) => {
    setOccasion(selected);
    setShowPicker(false);
    const ok = await checkOutfitRecs();
    if (!ok) return;
    await generateOutfits(selected);
  };

  // Produces a stable, order-independent string key from an outfit's item IDs for deduplication and toggling.
  var outfitKey = (outfit) => (outfit?.items ?? []).map(i => i.id).sort().join(',');

  // Returns the saved favorite_outfits row matching this outfit, or undefined if not favorited.
  var findFavorite = (outfit) =>
    favorites.find(f => [...f.clothing_item_ids].sort().join(',') === outfitKey(outfit));

  // Fetches all saved favorite outfits for the user and stores them in local state.
  var loadFavorites = async (userId) => {
    var { data: favData } = await supabase
      .from('favorite_outfits')
      .select('id, clothing_item_ids, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (favData) setFavorites(favData);
  };

  // Adds or removes an outfit from favorites. Uses displayItems (currentItems) rather than
  // outfit.items to capture any swaps the user made after generation. Checks the free-tier cap before inserting.
  var toggleFavorite = async (outfit, currentItems) => {
    var items = currentItems ?? outfit.items;
    var key = items.map(i => i.id).sort().join(',');
    if (togglingKeysRef.current.has(key)) return;
    togglingKeysRef.current.add(key);
    setTogglingKey(key);
    try {
      var { data: { user } } = await supabase.auth.getUser();
      var existing = favorites.find(f => [...f.clothing_item_ids].sort().join(',') === key);

      if (existing) {
        await supabase.from('favorite_outfits').delete().eq('id', existing.id);
        setFavorites(prev => prev.filter(f => f.id !== existing.id));
        return;
      }

      // Safety valve for paid users
      if (isPaid && favorites.length >= 1000) {
        Alert.alert('Limit Reached', 'You have too many saved favorites. Please remove some.');
        return;
      }

      const ok = await checkFavorites(favorites.length);
      if (!ok) return;

      // Pre-insert sync: re-query in case a previous in-flight insert (offline -> online race)
      // already created this favorite server-side. Prevents 23505 unique violation alerts.
      var sortedIds = items.map(i => i.id).sort();
      var { data: existingServer } = await supabase
        .from('favorite_outfits')
        .select('id, clothing_item_ids, created_at')
        .eq('user_id', user.id)
        .eq('clothing_item_ids', sortedIds)
        .maybeSingle();

      if (existingServer) {
        setFavorites(prev => {
          if (prev.some(f => f.id === existingServer.id)) return prev;
          return [...prev, existingServer];
        });
        return;
      }

      var { data: inserted } = await supabase
        .from('favorite_outfits')
        .insert({
          user_id: user.id,
          clothing_item_ids: items.map(i => i.id).sort(),
          styling_note: outfit.styling_note ?? null,
        })
        .select()
        .single();
      if (inserted) setFavorites(prev => [...prev, inserted]);
    } catch (err) {
      // Silently swallow unique-constraint violations — they mean the favorite already exists,
      // not a real error. Other errors still surface to the user.
      if (err?.code === '23505') {
        console.warn('[toggleFavorite] unique violation (already favorited)', err.message);
      } else {
        console.error('[toggleFavorite]', err.message);
        Alert.alert('Something went wrong', 'Could not update favorites. Please try again.');
      }
    } finally {
      togglingKeysRef.current.delete(key);
      setTogglingKey(null);
    }
  };

  // Full outfit generation pipeline:
  // 1. Fetch wardrobe and dislike feedback, filter out disliked items.
  // 2. Get device location and fetch current weather from Open-Meteo.
  // 3. Call Claude with the filtered wardrobe, weather, and occasion to get 3 outfit suggestions.
  // 4. Filter out disliked combos, enrich items with image URLs, and update state.
  var generateOutfits = async (selectedOccasion) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch wardrobe
      var { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user.id);

      var { data: feedbackRows, error: feedbackErr } = await supabase
        .from('outfit_feedback')
        .select('clothing_item_id, outfit_combo_key, feedback_type')
        .eq('user_id', user.id);
      if (feedbackErr) console.warn('[OutfitFeedback]', feedbackErr.message);
      // Use Sets for O(1) lookup when filtering the wardrobe and outfit combo lists.
      var dislikedItemIds = new Set(
        (feedbackRows ?? [])
          .filter(r => r.feedback_type === 'dislike_item' && r.clothing_item_id)
          .map(r => r.clothing_item_id)
      );
      var dislikedComboKeys = new Set(
        (feedbackRows ?? [])
          .filter(r => r.feedback_type === 'dislike_outfit' && r.outfit_combo_key)
          .map(r => r.outfit_combo_key)
      );

      var { data: wardrobe, error: wErr } = await supabase
        .from('clothing_items')
        .select('id, name, category, subcategory, color, season, image_url')
        .eq('user_id', user.id)
        .eq('is_lent', false);

      if (wErr) throw wErr;

      if (!wardrobe || wardrobe.length === 0) {
        setError('empty_wardrobe');
        return;
      }

      var filteredWardrobe = wardrobe.filter(item => !dislikedItemIds.has(item.id));
      setWardrobeItems(filteredWardrobe);

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
      var wardrobeList = filteredWardrobe
        .map(i => `id:${i.id} | name:${i.name ?? 'unnamed'} | category:${i.category ?? 'uncategorized'} | color:${i.color ?? 'unspecified'} | season:${i.season ?? 'all'}`)
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

      // Claude sometimes wraps the array in an object — try common wrapper keys before giving up.
      if (!Array.isArray(parsed)) {
        parsed = parsed.outfits || parsed.recommendations || parsed.items || Object.values(parsed)[0];
      }

      if (!Array.isArray(parsed)) {
        console.error('[OutfitRec] Unexpected AI response shape:', rawText);
        throw new Error('AI did not return an array of outfits');
      }

      // Enrich items with image_url from wardrobe
      // Build an id→item index so image_url enrichment is O(1) instead of O(n) per item.
      var wardrobeMap = Object.fromEntries(wardrobe.map(i => [i.id, i]));
      var enriched = parsed.map(outfit => ({
        ...outfit,
        items: outfit.items.map(item => ({
          ...item,
          image_url: wardrobeMap[item.id]?.image_url ?? null,
        })),
      }));

      var outfitComboKey = o => o.items.map(i => i.id).sort().join('_');
      var filtered = enriched.filter(o => !dislikedComboKeys.has(outfitComboKey(o)));

      setOutfits(filtered);
      await loadFavorites(user.id);
      // Lock the button immediately so free users see the lock icon without a round-trip refetch.
      incrementOutfitRecs()
        .then(() => { if (!isPaid) setIsLocked(true); })
        .catch(() => {});
    } catch (err) {
      console.error('[OutfitRec]', err.message);
      setError('generic');
    } finally {
      setLoading(false);
    }
  };

  // Removes the disliked outfit card from local display (the DB feedback row is written by OutfitCard).
  var handleDislikeOutfit = (outfitIdx) => {
    setOutfits(prev => prev.filter((_, i) => i !== outfitIdx));
  };

  // True whenever there is something to show in the main area — hides the idle CTA card.
  var hasContent = loading || outfits.length > 0 || error;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <Text style={styles.title}>Ari's Closet</Text>
          <Text style={styles.subtitle}>Your personal stylist</Text>
        </View>

        {/* CTA card — shown when idle */}
        {!hasContent && (
          <TouchableOpacity style={styles.ctaCard} onPress={handleGetOutfits} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" style={styles.ctaEmoji} />
            <View style={styles.ctaTitleRow}>
              {!isPaid && isLocked && (
                <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.ctaTitle}>Get Today's Outfits</Text>
            </View>
            <Text style={styles.ctaSub}>AI picks based on your wardrobe & weather</Text>
          </TouchableOpacity>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={PRIMARY} style={{ marginBottom: 16 }} />
            <Text style={styles.stateTitle}>Styling your outfits…</Text>
            <Text style={styles.stateSub}>Checking your wardrobe & weather</Text>
          </View>
        )}

        {/* Empty wardrobe */}
        {error === 'empty_wardrobe' && (
          <View style={styles.stateBox}>
            <Ionicons name="shirt-outline" size={48} color="#9B9B9B" style={styles.stateEmoji} />
            <Text style={styles.stateTitle}>Your wardrobe is empty</Text>
            <Text style={styles.stateSub}>Add some clothes first to get outfit ideas!</Text>
          </View>
        )}

        {/* Location denied */}
        {error === 'location_denied' && (
          <View style={styles.stateBox}>
            <Ionicons name="location-outline" size={24} color={PRIMARY} style={styles.stateEmoji} />
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
            <Ionicons name="sad-outline" size={48} color="#9B9B9B" style={styles.stateEmoji} />
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
            {outfits.map((outfit, idx) => (
              <OutfitCard
                key={outfitKey(outfit)}
                outfit={outfit}
                outfitIdx={idx}
                index={idx + 1}
                weather={weather}
                occasion={occasion}
                findFavoriteForItems={(items) => favorites.find(f => [...f.clothing_item_ids].sort().join(',') === items.map(i => i.id).sort().join(','))}
                togglingKey={togglingKey}
                onToggleFavorite={(items) => toggleFavorite(outfit, items)}
                wardrobe={wardrobeItems}
                currentUserId={currentUserId}
                onDislikeOutfit={() => handleDislikeOutfit(idx)}
                canDoAISwap={canDoAISwap}
                incrementAISwap={incrementAISwap}
              />
            ))}
            <TouchableOpacity style={styles.refreshBtn} onPress={handleGetOutfits} activeOpacity={0.85}>
              <Text style={styles.refreshBtnText}>Regenerate Outfits</Text>
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

// Renders a single outfit recommendation card with a photo grid, item list, styling note,
// and controls for favoriting, disliking (item or whole outfit), and AI-powered item swapping.
function OutfitCard({
  outfit, index, weather, occasion,
  findFavoriteForItems, togglingKey, onToggleFavorite,
  wardrobe, currentUserId, onDislikeOutfit,
  canDoAISwap, incrementAISwap,
}) {
  var [displayItems, setDisplayItems] = useState(outfit.items);
  var isFavorited = !!findFavoriteForItems(displayItems);
  var displayItemsKey = displayItems.map(i => i.id).sort().join(',');
  var isToggling = togglingKey === displayItemsKey;
  var [swapModal, setSwapModal]       = useState(null);
  var [swapLoading, setSwapLoading]   = useState(null);
  var [redIconIds, setRedIconIds]     = useState(new Set());

  // Only show items that have a photo; cap at 4 to keep the grid balanced in a 2×2 layout.
  var displayImages = displayItems.filter(i => i.image_url).slice(0, 4);

  // Records a dislike_outfit feedback row in Supabase, then removes this card from the parent list.
  var handleDislikeWholeOutfit = async () => {
    try {
      var comboKey = outfit.items.map(i => i.id).sort().join('_');
      await supabase.from('outfit_feedback').insert({
        user_id: currentUserId,
        outfit_combo_key: comboKey,
        feedback_type: 'dislike_outfit',
      });
    } catch (err) {
      console.error('[DislikeOutfit]', err.message);
    }
    onDislikeOutfit();
  };

  // Records a dislike_item feedback row and briefly turns the thumbs-down icon red as confirmation.
  var handleDislikeItem = async (item) => {
    try {
      await supabase.from('outfit_feedback').insert({
        user_id: currentUserId,
        clothing_item_id: item.id,
        feedback_type: 'dislike_item',
      });
    } catch (err) {
      // Silent fail — DB unique index prevents dupes; tap retries are safe.
    }
    setRedIconIds(prev => new Set([...prev, item.id]));
  };

  // Opens the swap options modal (AI pick or manual wardrobe browse) for the given item index.
  var handleOpenSwap = (itemIdx) => {
    setSwapModal({ itemIdx, mode: 'options' });
  };

  // Switches the swap modal from the options view to the manual wardrobe picker view.
  var handlePickFromWardrobe = () => {
    setSwapModal(prev => ({ ...prev, mode: 'wardrobe' }));
  };

  // Applies the manually-chosen wardrobe item as a replacement and closes the swap modal.
  var handleSelectReplacement = (replacement) => {
    setDisplayItems(prev => prev.map((item, i) =>
      i === swapModal.itemIdx ? { ...replacement } : item
    ));
    setSwapModal(null);
  };

  // Checks the AI swap daily limit, then calls Claude to pick the best same-category replacement.
  // Falls back to the manual picker if the limit is hit, no candidates exist, or the AI returns
  // an ID that isn't in the wardrobe.
  var handleAISwap = async (itemIdx) => {
    setSwapModal(null);

    var allowed = await canDoAISwap();
    if (!allowed) {
      await RevenueCatUI.presentPaywall();
      return;
    }

    setSwapLoading(itemIdx);
    try {
      var itemBeingSwapped = displayItems[itemIdx];
      var availableItems = wardrobe.filter(w =>
        w.category === itemBeingSwapped.category &&
        !displayItems.some(d => d.id === w.id)
      );

      if (availableItems.length === 0) {
        setSwapModal({ itemIdx, mode: 'wardrobe' });
        return;
      }

      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: 'You are a personal stylist assistant. Return ONLY valid JSON with no markdown, no explanation.',
          messages: [{
            role: 'user',
            content: `Here is a current outfit: ${JSON.stringify(displayItems)}. The item being replaced is: ${JSON.stringify(itemBeingSwapped)}. Pick the single best replacement from this wardrobe list: ${JSON.stringify(availableItems)}. Consider color coordination, occasion, and style consistency. Return ONLY: { "item_id": "<id>" }`,
          }],
        }),
      });

      if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);

      var aiData = await aiResp.json();
      var rawText = aiData.content?.[0]?.text?.trim() ?? '';
      var jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      var result = JSON.parse(jsonStr);
      var found = wardrobe.find(w => w.id === result.item_id);

      if (found) {
        setDisplayItems(prev => prev.map((item, i) => i === itemIdx ? { ...found } : item));
        await incrementAISwap();
      } else {
        setSwapModal({ itemIdx, mode: 'wardrobe' });
      }
    } catch (err) {
      console.error('[AISwap]', err.message);
      setSwapModal({ itemIdx, mode: 'wardrobe' });
    } finally {
      setSwapLoading(null);
    }
  };

  // Derive which wardrobe items are valid swap candidates for the currently open modal.
  var swapItemIdx = swapModal?.itemIdx ?? null;
  var swapCategory = swapItemIdx != null ? displayItems[swapItemIdx]?.category : null;
  var swapCandidates = swapCategory
    ? wardrobe.filter(w =>
        w.category === swapCategory &&
        !displayItems.some(d => d.id === w.id)
      )
    : [];

  return (
    <View style={styles.card}>

      {/* ── Top row ──────────────────────────────────────────────────────── */}
      <View style={styles.cardTopRow}>
        {weather && occasion && (
          <View style={styles.cardTag}>
            <Text style={styles.cardTagText}>
              {weather.emoji} {weather.temp}° · {occasion}
            </Text>
          </View>
        )}
        <Text style={styles.outfitLabel}>Outfit {index}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={handleDislikeWholeOutfit}
            style={styles.actionIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="thumbs-down-outline" size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onToggleFavorite(displayItems)}
            disabled={isToggling}
            style={styles.heartBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart size={20} color={PRIMARY} fill={isFavorited ? PRIMARY : 'transparent'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Photo grid ───────────────────────────────────────────────────── */}
      {displayImages.length > 0 ? (
        <View style={styles.photoGrid}>
          {displayImages.map((item, i) => (
            <Image
              key={item.id ?? i}
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

      {/* ── Item list with per-item dislike + swap ────────────────────────── */}
      <View style={styles.itemList}>
        {displayItems.map((item, i) => (
          <View key={item.id ?? i} style={styles.itemRow}>
            {item.image_url ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.itemThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.itemThumb, styles.itemThumbPlaceholder]}>
                <Ionicons name="shirt-outline" size={14} color="#9CA3AF" />
              </View>
            )}
            <Text style={styles.itemRowName} numberOfLines={1}>{item.name ?? ''}</Text>
            <View style={styles.itemActions}>
              {swapLoading === i ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => handleDislikeItem(item)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.itemActionBtn}
                  >
                    <Ionicons
                      name="thumbs-down-outline"
                      size={16}
                      color={redIconIds.has(item.id) ? '#EF4444' : '#6B7280'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleOpenSwap(i)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.itemActionBtn}
                  >
                    <Ionicons name="swap-horizontal-outline" size={16} color={PRIMARY} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* ── Styling note ─────────────────────────────────────────────────── */}
      {outfit.styling_note ? (
        <View style={styles.noteBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="sparkles-outline" size={20} color={PRIMARY} />
            <Text style={styles.noteLabel}>Stylist's Note</Text>
          </View>
          <Text style={styles.noteText}>{outfit.styling_note}</Text>
        </View>
      ) : null}

      {/* ── Swap options sheet ────────────────────────────────────────────── */}
      <Modal
        visible={swapModal?.mode === 'options'}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSwapModal(null)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Swap {swapModal != null ? (displayItems[swapModal.itemIdx]?.name ?? '') : ''}
            </Text>
            <TouchableOpacity
              style={styles.swapOptionRow}
              onPress={handlePickFromWardrobe}
              activeOpacity={0.7}
            >
              <Ionicons name="shirt-outline" size={20} color={PRIMARY} style={{ marginRight: 12 }} />
              <Text style={styles.swapOptionText}>Pick from my wardrobe</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.swapOptionRow}
              onPress={() => handleAISwap(swapModal.itemIdx)}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles-outline" size={20} color={PRIMARY} style={{ marginRight: 12 }} />
              <Text style={styles.swapOptionText}>Let AI choose</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.swapCancelBtn}
              onPress={() => setSwapModal(null)}
            >
              <Text style={styles.swapCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Swap wardrobe picker sheet ────────────────────────────────────── */}
      <Modal
        visible={swapModal?.mode === 'wardrobe'}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSwapModal(null)}>
          <Pressable style={styles.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Pick a replacement</Text>
            {swapCandidates.length === 0 ? (
              <Text style={styles.swapEmptyText}>No other items in this category</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {swapCandidates.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={styles.swapCandidateRow}
                    onPress={() => handleSelectReplacement(w)}
                    activeOpacity={0.7}
                  >
                    {w.image_url ? (
                      <Image
                        source={{ uri: w.image_url }}
                        style={styles.swapCandidateThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.swapCandidateThumb, styles.swapCandidateThumbPlaceholder]}>
                        <Ionicons name="shirt-outline" size={18} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={styles.swapCandidateName} numberOfLines={1}>
                      {w.name ?? 'Unnamed'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.swapCancelBtn}
              onPress={() => setSwapModal(null)}
            >
              <Text style={styles.swapCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// Styles for HomeScreen and OutfitCard — header, CTA card, state boxes, outfit card, photo grid,
// item list, styling note, swap sheets, occasion picker modal, and the regenerate button.
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
    fontFamily: FONTS.heading,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: FONTS.body,
  },

  // ── CTA card ────────────────────────────────────────────────────────────────
  ctaCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: PRIMARY,
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#e0d4e7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  ctaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONTS.heading,
  },
  ctaSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontFamily: FONTS.body,
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
    fontFamily: FONTS.headingRegular,
  },
  stateSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FONTS.bodyMedium,
  },

  // ── Outfit card ─────────────────────────────────────────────────────────────
  card: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: CARD_BG,
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
    backgroundColor: SECONDARY,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  cardTagText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  outfitLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    marginLeft: -20,
    fontFamily: FONTS.bodyMedium,
  },
  heartBtn: {
    padding: 4,
    marginLeft: 8,
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
    fontFamily: FONTS.body,
  },

  // ── Item list ───────────────────────────────────────────────────────────────
  itemList: {
    marginBottom: 10,
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
    fontFamily: FONTS.body,
  },

  // ── Styling note ────────────────────────────────────────────────────────────
  noteBox: {
    backgroundColor: '#F9F5FF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    marginBottom: 4,
    fontFamily: FONTS.bodyMedium,
  },
  noteText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    fontFamily: FONTS.body,
  },

  // ── Regenerate button ───────────────────────────────────────────────────────
  refreshBtn: {
    marginHorizontal: 16,
    marginTop: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  refreshBtnText: {
    color: PRIMARY,
    fontWeight: '600',
    fontSize: 15,
    fontFamily: FONTS.bodyMedium,
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
    fontFamily: FONTS.heading,
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
    fontFamily: FONTS.body,
  },

  // ── Card action buttons (top-right) ─────────────────────────────────────────
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 4,
  },

  // ── Per-item rows ────────────────────────────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  itemThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#EDEAE4',
  },
  itemThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRowName: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    fontFamily: FONTS.body,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemActionBtn: {
    padding: 3,
  },

  // ── Swap option sheet ────────────────────────────────────────────────────────
  swapOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  swapOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1C',
    fontFamily: FONTS.body,
  },
  swapEmptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginVertical: 20,
    fontFamily: FONTS.body,
  },

  // ── Swap wardrobe picker sheet ───────────────────────────────────────────────
  swapCandidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  swapCandidateThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EDEAE4',
  },
  swapCandidateThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapCandidateName: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1C',
    fontFamily: FONTS.body,
  },
  swapCancelBtn: {
    marginTop: 16,
    paddingVertical: 13,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    alignItems: 'center',
  },
  swapCancelBtnText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
});
