import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export const ENTITLEMENT_ID = 'closetpal_pro';

const IOS_API_KEY = 'CLOSETPAL_RC_IOS_KEY';
const ANDROID_API_KEY = 'CLOSETPAL_RC_ANDROID_KEY';

let isInitialized = false;

// Call once at app startup — synchronous, no user required
export const initializeRevenueCat = () => {
  if (isInitialized) return;

  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    const apiKey = Platform.OS === 'ios' ? IOS_API_KEY : ANDROID_API_KEY;
    Purchases.configure({ apiKey });
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing RevenueCat:', error);
  }
};

// Call after Supabase login to associate purchases with the user
export const loginRevenueCat = async (userId) => {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (error) {
    console.error('Error logging in to RevenueCat:', error);
  }
};

export const logoutRevenueCat = async () => {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Error logging out from RevenueCat:', error);
  }
};

export const setUserAttributes = async ({ email, displayName } = {}) => {
  try {
    if (email) await Purchases.setEmail(email);
    if (displayName) await Purchases.setDisplayName(displayName);
  } catch (error) {
    console.error('Error setting user attributes:', error);
  }
};

export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (error) {
    console.error('Error getting offerings:', error);
    throw error;
  }
};

export const getCustomerInfo = async () => {
  try {
    return await Purchases.getCustomerInfo();
  } catch (error) {
    console.error('Error getting customer info:', error);
    throw error;
  }
};

export const checkPremiumAccess = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
};

export const purchasePackage = async (packageToPurchase) => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    const hasEntitlement = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    if (hasEntitlement) {
      await syncSubscriptionToSupabase(customerInfo);
    }
    return { success: hasEntitlement, customerInfo };
  } catch (error) {
    if (error.userCancelled) {
      return { success: false, cancelled: true };
    }
    console.error('Error purchasing package:', error);
    throw error;
  }
};

export const restorePurchases = async () => {
  try {
    const customerInfo = await Purchases.restorePurchases();
    await syncSubscriptionToSupabase(customerInfo);
    return {
      success: !!customerInfo.entitlements.active[ENTITLEMENT_ID],
      customerInfo,
    };
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
};

// Present the RC paywall only if the user lacks the entitlement.
// Returns true if the user ends up with access (purchased or restored).
export const presentPaywallIfNeeded = async () => {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
    });
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await syncSubscriptionStatus();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error presenting paywall:', error);
    return false;
  }
};

// Present the RC Customer Center modal for subscription management
export const presentCustomerCenter = async () => {
  try {
    await RevenueCatUI.presentCustomerCenter();
  } catch (error) {
    console.error('Error presenting Customer Center:', error);
    throw error;
  }
};

export const syncSubscriptionStatus = async () => {
  try {
    const customerInfo = await getCustomerInfo();
    await syncSubscriptionToSupabase(customerInfo);
    return customerInfo;
  } catch (error) {
    console.error('Error syncing subscription status:', error);
    throw error;
  }
};

const syncSubscriptionToSupabase = async (customerInfo) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    const tier = entitlement ? 'premium' : 'free';
    const expirationDate = entitlement?.expirationDate ?? null;

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tier,
        subscription_expires_at: expirationDate,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error syncing subscription to Supabase:', error);
    }
  } catch (error) {
    console.error('Error in syncSubscriptionToSupabase:', error);
  }
};
