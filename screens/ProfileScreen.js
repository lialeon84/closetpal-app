import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image, TouchableOpacity } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Heart } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [favorites, setFavorites]   = useState([]);
  const [wardrobeMap, setWardrobeMap] = useState({});
  const [userTier, setUserTier]     = useState('free');
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const [{ data, error }, { data: favData }, { data: wardrobeData }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('favorite_outfits')
            .select('id, clothing_item_ids, styling_note, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('clothing_items').select('id, name, image_url').eq('user_id', user.id),
        ]);

        if (error) throw error;
        setProfile(data);
        setUserTier(data?.subscription_tier ?? 'free');
        if (favData) setFavorites(favData);
        if (wardrobeData) setWardrobeMap(Object.fromEntries(wardrobeData.map(i => [i.id, i])));
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const HEADER_MAX_HEIGHT = 200;
  const HEADER_MIN_HEIGHT = 80;
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: 'clamp',
  });

  const profileImageScale = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.5],
    extrapolate: 'clamp',
  });

  const profileImageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  const usernameSize = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [22, 16],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9b59b6" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.brandHeaderContainer}>
          <SafeAreaView edges={['top']}>
            <View style={styles.brandHeader}>
              <Text style={styles.brandText}>Profile</Text>
            </View>
          </SafeAreaView>
        </View>
        <View style={styles.container}>
          <Text style={styles.errorText}>Profile not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fullScreen}>
      <View style={styles.brandHeaderContainer}>
        <SafeAreaView edges={['top']}>
          <View style={styles.brandHeader}>
            <Text style={styles.brandSymbol}>ClosetPal 🐾</Text>
          </View>
        </SafeAreaView>
      </View>

      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={styles.settingsButtonInHeader}
        >
          <Text style={styles.settingsIconSmall}>&#9881;</Text>
        </Pressable>

        <Animated.View
          style={[
            styles.profileImageContainer,
            {
              transform: [{ scale: profileImageScale }],
              opacity: profileImageOpacity,
            },
          ]}
        >
          {profile.profile_picture_url ? (
            <Image
              source={{ uri: profile.profile_picture_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.Text style={[styles.username, { fontSize: usernameSize }]}>
          @{profile.username}
        </Animated.Text>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
       
        {/* Display name */}
        {/* {(profile.first_name || profile.last_name) ? (
          <View style={[styles.section, { marginTop: 40 }]}>
            <Text style={styles.fullName}>
              {[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
            </Text>
          </View>
        ) : null}  */}

        {/* Stats — followers/following stored for future social features */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{favorites.length}</Text>
            <Text style={styles.statLabel}>Favorite Outfits</Text>
          </View>
          {/* <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View> */}
        </View>



        {/* Subscription badge */}
        {/* <View style={styles.section}>
          <View style={styles.subscriptionRow}>
            <Text style={styles.subscriptionLabel}>Plan</Text>
            <Pressable onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.subscriptionValue}>
                {profile.subscription_tier === 'premium' ? '✨ Premium' : 'Free'}
              </Text>
            </Pressable>
          </View>
        </View> */}

        <View style={styles.favSection}>
          <View style={styles.favSectionHeader}>
            <Text style={styles.favSectionTitle}>Favorite Outfits</Text>
            <Text style={styles.favCount}>
              {favorites.length} of {(userTier && userTier !== 'free') ? 50 : 5} saved
            </Text>
          </View>
          {favorites.length === 0 ? (
            <Text style={styles.favEmpty}>
              No favorites yet — heart an outfit on the home screen.
            </Text>
          ) : (
            favorites.map(fav => (
              <FavoriteOutfitCard
                key={fav.id}
                favorite={fav}
                wardrobeMap={wardrobeMap}
                onUnfavorite={async () => {
                  await supabase.from('favorite_outfits').delete().eq('id', fav.id);
                  setFavorites(prev => prev.filter(f => f.id !== fav.id));
                }}
              />
            ))
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
    </View>
  );
}

function FavoriteOutfitCard({ favorite, wardrobeMap, onUnfavorite }) {
  var images = favorite.clothing_item_ids.slice(0, 4).map(id => wardrobeMap[id] ?? null);
  return (
    <View style={styles.favCard}>
      <View style={styles.favImageGrid}>
        {images.map((item, idx) =>
          item?.image_url ? (
            <Image key={idx} source={{ uri: item.image_url }} style={styles.favImage} resizeMode="cover" />
          ) : (
            <View key={idx} style={[styles.favImage, styles.favImagePlaceholder]}>
              <Text style={styles.favImagePlaceholderText}>?</Text>
            </View>
          )
        )}
      </View>
      {favorite.styling_note ? (
        <Text style={styles.favNote} numberOfLines={3}>{favorite.styling_note}</Text>
      ) : null}
      <TouchableOpacity onPress={onUnfavorite} style={styles.favUnfavBtn}>
        <Heart size={14} color="#E53935" fill="#E53935" />
        <Text style={styles.favUnfavText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  brandHeaderContainer: {
    // backgroundColor: '#EDEAE4',
    zIndex: 10,
  },
  brandHeader: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  brandSymbol: {
    fontSize: 24,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
  },
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F5F0',
  },
  header: {
    // backgroundColor: '#EDEAE4',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginHorizontal: 15,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 10,
  },
  settingsButtonInHeader: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 5,
    zIndex: 10,
  },
  settingsIconSmall: {
    fontSize: 20,
  },
  profileImageContainer: {
    marginBottom: 10,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#e1bee7',
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#9b59b6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e1bee7',
  },
  profileImageText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: 'bold',
  },
  username: {
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#EDEAE4',
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#9b59b6',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#EDEAE4',
    marginHorizontal: 15,
    marginBottom: 15,
    padding: 20,
    borderRadius: 15,
  },
  fullName: {
    fontSize: 18,
    color: '#1C1C1C',
    fontWeight: '600',
    textAlign: 'center',
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  subscriptionValue: {
    fontSize: 16,
    color: '#9b59b6',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 40,
  },
  bottomSpacer: {
    height: 100,
  },

  favSection: {
    marginHorizontal: 15,
    marginBottom: 15,
  },
  favSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  favSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1C',
  },
  favCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  favEmpty: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
    backgroundColor: '#EDEAE4',
    borderRadius: 15,
    paddingHorizontal: 20,
  },
  favCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  favImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  favImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#EDEAE4',
  },
  favImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  favImagePlaceholderText: {
    fontSize: 22,
    color: '#9CA3AF',
  },
  favNote: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    marginBottom: 10,
  },
  favUnfavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  favUnfavText: {
    fontSize: 12,
    color: '#E53935',
    fontWeight: '600',
  },
});
