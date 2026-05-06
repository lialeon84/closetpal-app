import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Outerwear', 'Accessories', 'Dresses'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 15 * 2 - 10) / 2;

export default function WardrobeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  const loadItems = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems =
    selectedCategory === 'All'
      ? items
      : items.filter((item) => item.category === selectedCategory);

  const renderItem = ({ item }) => (
    <Pressable
      style={styles.card}
      onPress={() => navigation.navigate('ItemDetail', { item })}
    >
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.cardImage} />
      ) : (
        <View style={styles.cardImagePlaceholder}>
          <Text style={styles.cardImagePlaceholderIcon}>👗</Text>
        </View>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardCategory}>{item.category}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.fullScreen}>
      <View style={styles.brandHeaderContainer}>
        <SafeAreaView edges={['top']}>
          <View style={styles.brandHeader}>
            <Text style={styles.brandSymbol}>👗</Text>
            <Text style={styles.brandText}>My Wardrobe</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filterBarContent}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipSelected]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedCategory === cat && styles.filterChipTextSelected,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.gridContainer}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#9b59b6" />
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyIcon}>👗</Text>
            <Text style={styles.emptyTitle}>
              {selectedCategory === 'All' ? 'Your wardrobe is empty' : `No ${selectedCategory} yet`}
            </Text>
            <Text style={styles.emptySubtitle}>Tap + to add your first item</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <Pressable style={styles.fab} onPress={() => navigation.navigate('AddItem')}>
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
  brandHeaderContainer: {
    zIndex: 10,
    flexShrink: 0,
  },
  brandHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  brandSymbol: {
    fontSize: 24,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  filterBar: {
    maxHeight: 52,
    flexShrink: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#EDEAE4',
  },
  gridContainer: {
    flex: 1,
  },
  filterBarContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EDEAE4',
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  filterChipSelected: {
    backgroundColor: '#9b59b6',
    borderColor: '#9b59b6',
  },
  filterChipText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#fff',
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
  grid: {
    padding: 15,
    paddingBottom: 100,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#EDEAE4',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
    backgroundColor: '#D9D5CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImagePlaceholderIcon: {
    fontSize: 40,
  },
  cardFooter: {
    padding: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 2,
  },
  cardCategory: {
    fontSize: 12,
    color: '#6B7280',
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
