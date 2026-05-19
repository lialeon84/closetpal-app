// Detail view for a saved trip. Shows a summary card (destination, dates, weather vibe,
// AI packing notes), a packing progress bar, and an interactive checklist. Items can be
// toggled packed/unpacked with optimistic updates that revert on DB failure. Wardrobe data
// is re-fetched on every screen focus so deleted items are handled gracefully.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { parseDateFromDB, formatDateForDisplay } from '../lib/constants';
import { PRIMARY, SECONDARY, CARD_BG } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

// Emoji lookup keyed by weather vibe string for the trip summary and progress header.
const VIBE_EMOJI = { Warm: '☀️', Cold: '❄️', Mixed: '🌤️', Tropical: '🌴', Snow: '🌨️' };

// Main screen component. Renders the trip summary card, packing progress bar, and the
// interactive packing checklist. Refreshes from the DB on every screen focus.
export default function TripDetailScreen({ route, navigation }) {
  // Trip row (refreshed from DB on focus), packing items array, wardrobe id→item map,
  // initial-load flag, and the clothing_item_id currently being saved (null when idle).
  const tripParam = route?.params?.trip ?? null;
  const [trip, setTrip] = useState(tripParam);
  const [packingItems, setPackingItems] = useState(tripParam?.packing_items ?? []);
  const [wardrobeMap, setWardrobeMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  // Re-fetch on every screen focus so wardrobe edits (renamed items, new photos,
  // deletions) are reflected when the user navigates back from another screen.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Fetches the latest trip row and the user's wardrobe in parallel. Builds a wardrobe
  // id→item map so each packing list row can look up name and image in O(1).
  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: freshTrip }, { data: wardrobe }] = await Promise.all([
        supabase.from('trips').select('*').eq('id', trip.id).single(),
        supabase.from('clothing_items')
          .select('id, name, category, image_url')
          .eq('user_id', user.id),
      ]);

      if (freshTrip) {
        setTrip(freshTrip);
        setPackingItems(freshTrip.packing_items || []);
      }
      if (wardrobe) {
        // Build id→item map for O(1) lookups in the packing list render.
        setWardrobeMap(Object.fromEntries(wardrobe.map(i => [i.id, i])));
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Optimistically flips the packed state for one packing list item and persists the full
  // updated array to Supabase. Reverts to the previous state if the write fails.
  // `saving` holds the clothing_item_id currently being written to prevent concurrent saves.
  const togglePacked = async (clothingItemId) => {
    if (saving) return; // prevent concurrent saves while any item is being written
    setSaving(clothingItemId); // track which item is saving so its row shows a spinner

    const previous = packingItems; // capture pre-toggle state for rollback on DB failure
    const updated = packingItems.map(item =>
      item.clothing_item_id === clothingItemId
        ? { ...item, packed: !item.packed }
        : item
    );
    setPackingItems(updated);

    const { error } = await supabase
      .from('trips')
      .update({ packing_items: updated })
      .eq('id', trip.id);

    if (error) {
      setPackingItems(previous);
      Alert.alert('Error', 'Failed to save. Please try again.');
    }
    setSaving(null);
  };

  // Confirms deletion before removing the trip row from Supabase, then navigates back
  // to the trips list on success.
  const deleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      `Delete your trip to ${trip.destination}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('trips').delete().eq('id', trip.id);
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  // Derived display values — packing progress stats and formatted date/vibe strings.
  const packedCount = packingItems.filter(i => i.packed).length;
  const totalCount = packingItems.length;
  const progressPct = totalCount > 0 ? packedCount / totalCount : 0; // guard against NaN when list is empty

  if (!trip) {
    navigation.goBack();
    return null;
  }

  const startDate = formatDateForDisplay(parseDateFromDB(trip.start_date));
  const endDate = formatDateForDisplay(parseDateFromDB(trip.end_date));
  const vibeEmoji = VIBE_EMOJI[trip.weather_vibe] || '🌡️'; // fallback for any unrecognized vibe string

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back-outline" size={24} color="#1C1C1C" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{trip.destination}</Text>
        <Pressable onPress={deleteTrip} style={styles.deleteBtn} hitSlop={8}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Trip summary card */}
        <View style={styles.infoCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="airplane-outline" size={24} color={PRIMARY} />
            <Text style={[styles.destination, { marginBottom: 0 }]}>{trip.destination}</Text>
          </View>
          <Text style={styles.dates}>{startDate} → {endDate}</Text>
          <View style={styles.tagsRow}>
            {trip.weather_vibe ? (
              <View style={[styles.tag, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Text style={styles.tagText}>{vibeEmoji}</Text>
                <Text style={styles.tagText}>{trip.weather_vibe}</Text>
              </View>
            ) : null}
            {trip.trip_purpose ? (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{trip.trip_purpose}</Text>
              </View>
            ) : null}
          </View>
          {trip.ai_notes ? (
            <View style={styles.notesBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Ionicons name="sparkles-outline" size={20} color={PRIMARY} />
                <Text style={[styles.notesLabel, { marginBottom: 0 }]}>Stylist's Notes</Text>
              </View>
              <Text style={styles.notesText}>{trip.ai_notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Packing progress */}
        {totalCount > 0 && (
          <View style={styles.progressCard}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressTitle}>Packing Progress</Text>
              <Text style={styles.progressCount}>{packedCount} of {totalCount} packed</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
            </View>
          </View>
        )}

        {/* Packing checklist */}
        <Text style={styles.sectionTitle}>Packing List</Text>

        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 24 }} />
        ) : totalCount === 0 ? (
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>No items in this packing list.</Text>
          </View>
        ) : (
          packingItems.map(item => {
            const wardrobeItem = wardrobeMap[item.clothing_item_id];
            const isPacked = item.packed;
            const isSaving = saving === item.clothing_item_id;

            return (
              <Pressable
                key={item.clothing_item_id}
                style={[styles.listItem, isPacked && styles.listItemPacked]}
                onPress={() => togglePacked(item.clothing_item_id)}
                disabled={!!saving} // !!clothingItemId string → true; disables all rows while any save is in flight
              >
                {wardrobeItem?.image_url ? (
                  <Image
                    source={{ uri: wardrobeItem.image_url }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    {wardrobeItem
                      ? <Ionicons name="shirt-outline" size={48} color="#9B9B9B" />
                      : <Ionicons name="close-circle-outline" size={48} color="#9B9B9B" />}
                  </View>
                )}

                <View style={styles.itemInfo}>
                  {wardrobeItem ? (
                    <>
                      <Text
                        style={[styles.itemName, isPacked && styles.itemNamePacked]}
                        numberOfLines={1}
                      >
                        {wardrobeItem.name}
                      </Text>
                      <Text style={styles.itemCategory}>{wardrobeItem.category}</Text>
                    </>
                  ) : (
                    <Text style={styles.itemRemoved}>Item removed from wardrobe</Text>
                  )}
                </View>

                <View style={[styles.checkbox, isPacked && styles.checkboxChecked]}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color={isPacked ? '#fff' : PRIMARY} />
                  ) : isPacked ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles for TripDetailScreen — header (back + destination title + delete), trip summary
// info card (destination, dates, weather/purpose tags, AI notes box), packing progress
// bar, and the interactive packing checklist rows (thumbnail, item info, packed checkbox).
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
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1C',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
    fontFamily: FONTS.heading,
  },
  deleteBtn: {
    width: 60,
    alignItems: 'flex-end',
  },
  deleteText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
  content: {
    padding: 16,
    paddingBottom: 60,
  },

  // ── Info card ────────────────────────────────────────────────────────────────
  infoCard: {
    backgroundColor: '#EDEAE4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  destination: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 4,
    fontFamily: FONTS.heading,
  },
  dates: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
    fontFamily: FONTS.body,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: SECONDARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  notesBox: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    marginBottom: 4,
    fontFamily: FONTS.bodyMedium,
  },
  notesText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    fontFamily: FONTS.body,
  },

  // ── Progress ─────────────────────────────────────────────────────────────────
  progressCard: {
    backgroundColor: '#EDEAE4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1C',
    fontFamily: FONTS.bodyMedium,
  },
  progressCount: {
    fontSize: 14,
    color: PRIMARY,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  progressBg: {
    height: 8,
    backgroundColor: '#D9D5CE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },

  // ── Checklist ────────────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 12,
    fontFamily: FONTS.heading,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyListText: {
    color: '#6B7280',
    fontSize: 14,
    fontFamily: FONTS.body,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  listItemPacked: {
    opacity: 0.6,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#EDEAE4',
  },
  imagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#EDEAE4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 2,
    fontFamily: FONTS.bodyMedium,
  },
  itemNamePacked: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  itemCategory: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 3,
    fontFamily: FONTS.body,
  },
  itemRemoved: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
    fontFamily: FONTS.body,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#D9D5CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
});
