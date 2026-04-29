import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const iosApiKey = 'CLOSETPAL_RC_IOS_KEY';
const androidApiKey = 'CLOSETPAL_RC_ANDROID_KEY';

let isInitialized = false;

export const initializeRevenueCat = async () => {
  if (isInitialized) {
    console.log('RevenueCat already initialized, skipping...');
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    if (Platform.OS === 'ios') {
      await Purchases.configure({ apiKey: iosApiKey });
    } else if (Platform.OS === 'android') {
      await Purchases.configure({ apiKey: androidApiKey });
    } else {
      console.error('Unsupported platform');
      return;
    }

    isInitialized = true;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await Purchases.logIn(user.id);
      console.log('RevenueCat initialized for user:', user.id);
    } else {
      console.log('RevenueCat initialized (no user logged in)');
    }
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
  }
};

export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;
    } else {
      console.log('No current offering configured');
      return null;
    }
  } catch (error) {
    console.error('Error getting offerings:', error);
    throw error;
  }
};

export const purchasePackage = async (packageToPurchase) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    if (customerInfo.entitlements.active.premium_access) {
      console.log('Purchase successful!');
      await updateSubscriptionInSupabase(customerInfo);
      return true;
    }
    return false;
  } catch (error) {
    if (error.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      console.log('User cancelled the purchase');
      return false;
    }
    console.error('Error purchasing package:', error);
    throw error;
  }
};

export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    await updateSubscriptionInSupabase(customerInfo);
    if (Object.keys(customerInfo.entitlements.active).length > 0) {
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
};

export const getCustomerInfo = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error getting customer info:', error);
    throw error;
  }
};

export const checkPremiumAccess = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    return customerInfo.entitlements.active.premium_access !== undefined;
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
};

const updateSubscriptionInSupabase = async (customerInfo) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tier = customerInfo.entitlements.active.premium_access ? 'premium' : 'free';
    const premiumEntitlement = customerInfo.entitlements.active.premium_access;
    const expirationDate = premiumEntitlement?.expirationDate || null;

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_expires_at: expirationDate,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating subscription in Supabase:', error);
    } else {
      console.log('Subscription updated in Supabase:', tier);
    }
  } catch (error) {
    console.error('Error in updateSubscriptionInSupabase:', error);
  }
};

export const logoutRevenueCat = async () => {
  try {
    await Purchases.logOut();
    console.log('User logged out from RevenueCat');
  } catch (error) {
    console.error('Error logging out from RevenueCat:', error);
  }
};

export const setUserAttributes = async (attributes) => {
  try {
    if (attributes.email) {
      await Purchases.setEmail(attributes.email);
    }
    if (attributes.displayName) {
      await Purchases.setDisplayName(attributes.displayName);
    }
  } catch (error) {
    console.error('Error setting user attributes:', error);
  }
};

export const syncSubscriptionStatus = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    await updateSubscriptionInSupabase(customerInfo);
    return customerInfo;
  } catch (error) {
    console.error('Error syncing subscription status:', error);
    throw error;
  }
};
