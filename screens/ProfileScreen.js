// User profile screen. Shows an animated collapsing header (profile photo + name),
// a stat counter for saved outfits, a subscription upgrade/status banner, and a
// scrollable list of favorited outfits with item thumbnails and a remove action.
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
import { PRIMARY, SECONDARY, CARD_BG } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';

// Main screen component. Loads profile, favorites, and wardrobe data; drives
// the animated collapsing header; and renders the subscription banner and favorites list.
export default function ProfileScreen({ navigation }) {
  // Profile data, async flags, favorite outfits, item lookup map, and subscription tier.
  const [profile, setProfile]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [favorites, setFavorites]   = useState([]);
  const [wardrobeMap, setWardrobeMap] = useState({});
  const [userTier, setUserTier]     = useState('free');
  // Animated value tracking scroll position — drives header height and image opacity.
  const scrollY = useRef(new Animated.Value(0)).current;

  // Load profile data once on initial mount.
  useEffect(() => {
    loadProfile();
  }, []);

  // Re-fetch every time the screen comes into focus so that edits made in EditProfile
  // or changes to favorites are reflected immediately on return.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  // Fetches the user's profile, saved favorite outfits, and wardrobe items in parallel.
  // Builds wardrobeMap (id → item) for O(1) image lookups inside FavoriteOutfitCard.
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
        // Build an id→item map for O(1) lookups inside FavoriteOutfitCard.
        if (wardrobeData) setWardrobeMap(Object.fromEntries(wardrobeData.map(i => [i.id, i])));
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Animated header shrinks from 200 → 80 px as the user scrolls, and the profile
  // image scales down and fades out so the content takes centre stage.
  const HEADER_MAX_HEIGHT = 200;
  const HEADER_MIN_HEIGHT = 80;
  const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  // Header height collapses proportionally to scroll distance, clamped so it never
  // goes below HEADER_MIN_HEIGHT even if the user overscrolls.
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

  // Opacity fades from fully visible → invisible across the scroll range, with a
  // mid-point keyframe at half the distance to make the fade feel non-linear.
  const profileImageOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE / 2, HEADER_SCROLL_DISTANCE],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
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
            <Text style={styles.brandSymbol}>Profile </Text>
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              style={styles.settingsButtonInHeader}
            >
              <Ionicons name="settings-outline" size={20} color="#1C1C1C" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>

      <Animated.View style={[styles.header, { height: headerHeight }]}>
        <View style={styles.profileRow}>
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
                  {/* Fallback initial when username is null; toUpperCase for consistent display. */}
                  {(profile.username ?? 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>
          <View style={styles.profileNameColumn}>
            <Animated.Text
              style={[
                styles.profileFirstName,
                {
                  opacity: profileImageOpacity,
                  transform: [{ scale: profileImageScale }],
                },
              ]}
            >
              {profile.first_name}
            </Animated.Text>
            {profile.style_bio ? (
              <Text style={styles.styleBio}>{profile.style_bio}</Text>
            ) : null}
          </View>
        </View>
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

        {/* Subscription banner — upgrades free users, shows status for premium */}
        {userTier !== 'Premium' ? (
          <Pressable
            style={styles.premiumBanner}
            onPress={() => navigation.navigate('Subscription')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />
              <Text style={styles.premiumBannerTitle}>Upgrade to Premium</Text>
            </View>
            <Text style={styles.premiumBannerSub}>
              Unlimited outfits · Unlimited trips · AI stylist
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.premiumBadge}
            onPress={() => navigation.navigate('Subscription')}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />
              <Text style={styles.premiumBadgeText}>Premium Member</Text>
            </View>
          </Pressable>
        )}

        <View style={styles.favSection}>
          <View style={styles.favSectionHeader}>
            <Text style={styles.favSectionTitle}>Favorite Outfits</Text>
            <Text style={styles.favCount}>
              {/* Show the cap only for free-tier users; truthy+non-'free' covers 'Premium' from the DB. */}
          {(userTier && userTier !== 'free')
                ? `${favorites.length} saved`
                : `${favorites.length} of 5 saved`}
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

// Card component for a single saved outfit. Renders up to four item thumbnails in a
// grid, an optional styling note, and a remove button that calls onUnfavorite.
function FavoriteOutfitCard({ favorite, wardrobeMap, onUnfavorite }) {
  // Cap at 4 images for the 2×2 grid; wardrobeMap[id] ?? null gracefully handles
  // items that have been deleted from the wardrobe since the outfit was saved.
  var images = (favorite.clothing_item_ids ?? []).slice(0, 4).map(id => wardrobeMap[id] ?? null);
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
        <Heart size={14} color={PRIMARY} fill={PRIMARY} />
        <Text style={styles.favUnfavText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );
}

// Styles for ProfileScreen and FavoriteOutfitCard — brand header, animated collapsing
// header, profile image (photo and initial placeholder), stats bar, subscription
// banners (upgrade prompt and premium badge), favorites section, and card grid.
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
    // justifyContent: 'space-between',
    justifyContent: 'center',
  },
  brandSymbol: {
    fontSize: 24,
    fontFamily: FONTS.heading,
  },
  brandText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1C',
    fontFamily: FONTS.heading,
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
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
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
    marginRight: 14,
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
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e1bee7',
  },
  profileImageText: {
    fontSize: 36,
    color: '#fff',
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  profileFirstName: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: FONTS.heading,
    color: '#1C1C1C',
  },
  profileNameColumn: {
    flexDirection: 'column',
    flexShrink: 1,
  },
  styleBio: {
    fontSize: 14,
    color: '#666666',
    fontFamily: FONTS.body,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  username: {
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 5,
    fontFamily: FONTS.heading,
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
    color: PRIMARY,
    marginBottom: 5,
    fontFamily: FONTS.bodyBold,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: FONTS.body,
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
    fontFamily: FONTS.bodyMedium,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subscriptionLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: FONTS.body,
  },
  subscriptionValue: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  errorText: {
    fontSize: 16,
    color: '#ff6b6b',
    textAlign: 'center',
    marginTop: 40,
    fontFamily: FONTS.body,
  },
  bottomSpacer: {
    height: 100,
  },

  premiumBanner: {
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  premiumBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: FONTS.bodyBold,
  },
  premiumBannerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: FONTS.body,
  },
  premiumBadge: {
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: SECONDARY,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  premiumBadgeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: FONTS.bodyMedium,
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
    fontFamily: FONTS.heading,
  },
  favCount: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: FONTS.body,
  },
  favEmpty: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
    backgroundColor: '#EDEAE4',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontFamily: FONTS.body,
  },
  favCard: {
    backgroundColor: CARD_BG,
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
    fontFamily: FONTS.body,
  },
  favNote: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    marginBottom: 10,
    fontFamily: FONTS.body,
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
    fontFamily: FONTS.bodyMedium,
  },
});
