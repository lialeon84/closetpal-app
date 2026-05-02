import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image } from 'react-native';
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
import { supabase } from '../lib/supabase';

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
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
        {(profile.first_name || profile.last_name) ? (
          <View style={styles.section}>
            <Text style={styles.fullName}>
              {[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
            </Text>
          </View>
        ) : null} 

        {/* Stats — followers/following stored for future social features */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.outfits_count || 0}</Text>
            <Text style={styles.statLabel}>Outfits</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{profile.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>



        {/* Subscription badge */}
        <View style={styles.section}>
          <View style={styles.subscriptionRow}>
            <Text style={styles.subscriptionLabel}>Plan</Text>
            <Pressable onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.subscriptionValue}>
                {profile.subscription_tier === 'premium' ? '✨ Premium' : 'Free'}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
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
    backgroundColor: '#EDEAE4',
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
});
