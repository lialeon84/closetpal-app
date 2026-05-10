import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { parseDateFromDB, formatDateForDisplay } from '../lib/constants';

export default function TripsScreen({ navigation }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [])
  );

  const loadTrips = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false });
      if (error) throw error;
      setTrips(data || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTrip = ({ item }) => {
    const startDate = formatDateForDisplay(parseDateFromDB(item.start_date));
    const endDate = formatDateForDisplay(parseDateFromDB(item.end_date));
    const items = item.packing_items || [];
    const packed = items.filter(i => i.packed).length;
    const total = items.length;

    return (
      <Pressable
        style={styles.card}
        onPress={() => navigation.navigate('TripDetail', { trip: item })}
      >
        <View style={styles.cardRow}>
          <Text style={styles.cardDestination} numberOfLines={1}>✈️  {item.destination}</Text>
          {item.weather_vibe ? (
            <View style={styles.vibeBadge}>
              <Text style={styles.vibeBadgeText}>{item.weather_vibe}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardDates}>{startDate} → {endDate}</Text>
        {total > 0 && (
          <View style={styles.progressRow}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${(packed / total) * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{packed}/{total} packed</Text>
          </View>
        )}
        {item.trip_purpose ? (
          <Text style={styles.cardPurpose}>{item.trip_purpose}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.fullScreen}>
      <View style={styles.headerContainer}>
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}> My Trips</Text>
          </View>
        </SafeAreaView>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#9b59b6" />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>🌍</Text>
          <Text style={styles.emptyTitle}>No trips yet</Text>
          <Text style={styles.emptySubtitle}>Tap + to plan your first trip</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTrip}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable style={styles.fab} onPress={() => navigation.navigate('NewTrip')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  headerContainer: {
    zIndex: 10,
    flexShrink: 0,
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  list: {
    padding: 15,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#EDEAE4',
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardDestination: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1C',
    flex: 1,
  },
  vibeBadge: {
    backgroundColor: '#F3E8FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 8,
  },
  vibeBadgeText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '600',
  },
  cardDates: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#D9D5CE',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: '#9b59b6',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    minWidth: 60,
  },
  cardPurpose: {
    fontSize: 12,
    color: '#9b59b6',
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#9b59b6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
  },
});
