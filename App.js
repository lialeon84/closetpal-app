import React, { useState, useEffect, useCallback } from 'react';
import { Text, View, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { supabase } from './lib/supabase';
import { initializeRevenueCat, loginRevenueCat, logoutRevenueCat } from './lib/revenuecat';
import { requestNotificationPermissions } from './lib/notifications';

import WelcomeScreen from './screens/WelcomeScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import HomeScreen from './screens/HomeScreen';
import WardrobeScreen from './screens/WardrobeScreen';
import StylistScreen from './screens/StylistScreen';
// import PetCompanionScreen from './screens/PetCompanionScreen'; // Temporarily disabled — re-enable with the Tab.Screen block below
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import PaywallScreen from './screens/PaywallScreen';
import SubscriptionScreen from './screens/SubscriptionScreen';
import AddItemScreen from './screens/AddItemScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import DeleteAccountScreen from './screens/DeleteAccountScreen';
import NotificationPreferencesScreen from './screens/NotificationPreferencesScreen';
import ExportDataScreen from './screens/ExportDataScreen';
import TripsScreen from './screens/TripsScreen';
import NewTripScreen from './screens/NewTripScreen';
import TripDetailScreen from './screens/TripDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const [userInitial, setUserInitial] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [hasOverdueItems, setHasOverdueItems] = useState(false);

  useEffect(() => {
    loadUserInfo();
    checkOverdueItems();
  }, []);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('username, profile_picture_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setUserInitial(data.username?.charAt(0).toUpperCase() || 'U');
        setProfilePicture(data.profile_picture_url);
      }
    }
  };

  const checkOverdueItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('clothing_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_lent', true)
        .not('expected_return_date', 'is', null)
        .lte('expected_return_date', todayStr);
      setHasOverdueItems((data || []).length > 0);
    } catch (_) {}
  };

  useFocusEffect(
    useCallback(() => {
      loadUserInfo();
      checkOverdueItems();
    }, [])
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#EDEAE4',
          borderTopColor: '#9b59b6',
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#9b59b6',
        tabBarInactiveTintColor: '#AAAAAA',
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '🏠' : '🏠'}</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Wardrobe"
        component={WardrobeScreen}
        listeners={{ tabPress: checkOverdueItems }}
        options={{
          tabBarIcon: () => (
            <View>
              <Text style={{ fontSize: 24 }}>👗</Text>
              {hasOverdueItems && (
                <View style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: '#e74c3c',
                  borderWidth: 1.5,
                  borderColor: '#EDEAE4',
                }} />
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Stylist"
        component={StylistScreen}
        options={{
          tabBarIcon: () => (
            <Text style={{ fontSize: 24 }}>✨</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Trips"
        component={TripsScreen}
        options={{
          tabBarIcon: () => (
            <Text style={{ fontSize: 24 }}>✈️</Text>
          ),
        }}
      />
      {/* Temporarily disabled — Pet Companion tab hidden for initial launch.
          To re-enable: uncomment this block and the PetCompanionScreen import above.
      <Tab.Screen
        name="Pet"
        component={PetCompanionScreen}
        options={{
          tabBarIcon: () => (
            <Text style={{ fontSize: 24 }}></Text>
          ),
        }}
      /> */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) =>
            profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: focused ? '#9b59b6' : '#666',
                }}
              />
            ) : (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: focused ? '#9b59b6' : '#CCCCCC',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: focused ? '#e1bee7' : '#BBBBBB',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                  {userInitial}
                </Text>
              </View>
            ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeRevenueCat();
    requestNotificationPermissions();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session) {
        await loginRevenueCat(session.user.id);
        checkProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        await loginRevenueCat(session.user.id);
        checkProfile(session.user.id);
      } else {
        await logoutRevenueCat();
        setHasProfile(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkProfile = async (userId) => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    setHasProfile(!!data);
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F7F5F0' }}>
        <ActivityIndicator size="large" color="#9b59b6" />
        <Text style={{ color: '#1C1C1C', marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          hasProfile ? (
            <>
              <Stack.Screen name="MainApp" component={MainTabs} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="EditProfile" component={EditProfileScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} />
              <Stack.Screen name="Subscription" component={SubscriptionScreen} />
              <Stack.Screen name="AddItem" component={AddItemScreen} />
              <Stack.Screen name="ItemDetail" component={ItemDetailScreen} />
              <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
              <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
              <Stack.Screen name="ExportData" component={ExportDataScreen} />
              <Stack.Screen name="NewTrip" component={NewTripScreen} />
              <Stack.Screen name="TripDetail" component={TripDetailScreen} />
            </>
          ) : (
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
          )
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
