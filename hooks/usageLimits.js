// Enforces free-tier usage caps for favorites, wardrobe size, outfit recommendations,
// AI clothing detection, trips, and AI swaps. Each check function either returns true
// (action allowed), prompts the RevenueCat paywall, or fails open on network error so
// users are never unexpectedly locked out.
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { supabase } from '../lib/supabase';

const FREE_LIMITS = {
  favorites:    5,
  wardrobe:    30,
  outfitRecs:   1,  // per day
  aiDetections: 3,  // per month
  trips:        2,  // per month
  aiSwaps:      2,  // per day
};

const todayStr  = () => new Date().toISOString().split('T')[0];   // YYYY-MM-DD
const monthStr  = () => new Date().toISOString().slice(0, 7);     // YYYY-MM

// Module-level userId cache — stable for the lifetime of the auth session
let _cachedUserId = null;

// Fetches the authenticated user's ID, caching it in module scope for the session lifetime.
async function getUserId() {
  if (_cachedUserId) return _cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  _cachedUserId = user?.id ?? null;
  return _cachedUserId;
}

// Retrieves the usage_tracking row for the given user. Returns an empty object if no row exists yet.
async function getUsage(userId) {
  const { data, error } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .single();
  // PGRST116 = no rows — normal for first-time users; other errors are unexpected
  if (error && error.code !== 'PGRST116') {
    console.warn('[usageLimits] getUsage error:', error.message);
  }
  return data ?? {};
}

// Presents the RevenueCat paywall and returns true if the user purchased or restored a subscription.
async function showPaywall() {
  try {
    const result = await RevenueCatUI.presentPaywall();
    Purchases.getCustomerInfo().catch(e =>
      console.warn('[usageLimits] post-paywall getCustomerInfo error:', e.message)
    );
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (e) {
    console.error('[usageLimits] showPaywall error:', e.message);
    return false;
  }
}

// Factory that returns all check/increment helpers bound to the caller's isPaid status.
// Paid users bypass every limit; free users are subject to the caps in FREE_LIMITS.
export function usageLimits(isPaid) {
  // ── Favorites (total count, passed in by caller) ────────────────────────────
  const checkFavorites = async (currentCount) => {
    if (isPaid) return true;
    if (currentCount < FREE_LIMITS.favorites) return true;
    return showPaywall();
  };

  // ── Wardrobe items (total count in clothing_items table) ────────────────────
  const checkWardrobe = async () => {
    if (isPaid) return true;
    try {
      const uid = await getUserId();
      if (!uid) return true;
      const { count } = await supabase
        .from('clothing_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid);
      if ((count ?? 0) < FREE_LIMITS.wardrobe) return true;
    } catch (_) {
      return true; // fail open — don't lock user out on network error
    }
    return showPaywall();
  };

  // ── Outfit recommendations (daily, tracked in usage_tracking) ───────────────
  const checkOutfitRecs = async () => {
    if (isPaid) return true;
    try {
      const uid = await getUserId();
      if (!uid) return true;
      const usage = await getUsage(uid);
      const count = usage.outfit_recs_date === todayStr()
        ? (usage.outfit_recs_count ?? 0)
        : 0;
      if (count < FREE_LIMITS.outfitRecs) return true;
    } catch (_) {
      return true;
    }
    return showPaywall();
  };

  // Returns true if the daily outfit rec cap has been hit — used to disable UI without
  // showing the paywall (the paywall fires on the generate attempt, not on render).
  const isOutfitRecsLocked = async () => {
    if (isPaid) return false;
    try {
      const uid = await getUserId();
      if (!uid) return false;
      const usage = await getUsage(uid);
      const count = usage.outfit_recs_date === todayStr()
        ? (usage.outfit_recs_count ?? 0)
        : 0;
      return count >= FREE_LIMITS.outfitRecs;
    } catch (_) {
      return false;
    }
  };

  // Increments today's outfit rec counter, resetting to 1 if the stored date is no longer today.
  const incrementOutfitRecs = async () => {
    try {
      const uid = await getUserId();
      if (!uid) return;
      const usage = await getUsage(uid);
      const today = todayStr();
      const count = usage.outfit_recs_date === today
        ? (usage.outfit_recs_count ?? 0)
        : 0;
      await supabase.from('usage_tracking').upsert(
        { user_id: uid, outfit_recs_date: today, outfit_recs_count: count + 1 },
        { onConflict: 'user_id' }
      );
    } catch (e) {
      console.warn('[usageLimits] incrementOutfitRecs error:', e.message);
    }
  };

  // ── AI clothing detection (monthly, tracked in usage_tracking) ──────────────
  const checkAiDetection = async () => {
    if (isPaid) return true;
    try {
      const uid = await getUserId();
      if (!uid) return true;
      const usage = await getUsage(uid);
      const month = monthStr();
      const count = usage.ai_detections_month === month
        ? (usage.ai_detections_count ?? 0)
        : 0;
      if (count < FREE_LIMITS.aiDetections) return true;
    } catch (_) {
      return true;
    }
    return showPaywall();
  };

  // Increments this month's AI detection counter, resetting to 1 if the stored month has rolled over.
  const incrementAiDetection = async () => {
    try {
      const uid = await getUserId();
      if (!uid) return;
      const usage = await getUsage(uid);
      const month = monthStr();
      const count = usage.ai_detections_month === month
        ? (usage.ai_detections_count ?? 0)
        : 0;
      await supabase.from('usage_tracking').upsert(
        { user_id: uid, ai_detections_month: month, ai_detections_count: count + 1 },
        { onConflict: 'user_id' }
      );
    } catch (e) {
      console.warn('[usageLimits] incrementAiDetection error:', e.message);
    }
  };

  // ── Trips (monthly, tracked in usage_tracking) ──────────────────────────────
  const checkTrips = async () => {
    if (isPaid) return true;
    try {
      const uid = await getUserId();
      if (!uid) return true;
      const usage = await getUsage(uid);
      const month = monthStr();
      const count = usage.trips_month === month
        ? (usage.trips_count ?? 0)
        : 0;
      if (count < FREE_LIMITS.trips) return true;
    } catch (_) {
      return true;
    }
    return showPaywall();
  };

  // Increments this month's trip creation counter, resetting to 1 if the stored month has rolled over.
  const incrementTrips = async () => {
    try {
      const uid = await getUserId();
      if (!uid) return;
      const usage = await getUsage(uid);
      const month = monthStr();
      const count = usage.trips_month === month
        ? (usage.trips_count ?? 0)
        : 0;
      await supabase.from('usage_tracking').upsert(
        { user_id: uid, trips_month: month, trips_count: count + 1 },
        { onConflict: 'user_id' }
      );
    } catch (e) {
      console.warn('[usageLimits] incrementTrips error:', e.message);
    }
  };

  // ── AI swaps (daily) ────────────────────────────────────────────────────────
  // Returns true/false without showing the paywall — callers use this to gate the swap UI
  // and surface their own messaging; the paywall can be raised separately if desired.
  const canDoAISwap = async () => {
    if (isPaid) return true;
    try {
      const uid = await getUserId();
      if (!uid) return true;
      const usage = await getUsage(uid);
      const count = usage.ai_swaps_date === todayStr()
        ? (usage.ai_swaps_count ?? 0)
        : 0;
      return count < FREE_LIMITS.aiSwaps;
    } catch (_) {
      return true;
    }
  };

  // Increments today's AI swap counter, resetting to 1 if the stored date is no longer today.
  const incrementAISwap = async () => {
    try {
      const uid = await getUserId();
      if (!uid) return;
      const usage = await getUsage(uid);
      const today = todayStr();
      const count = usage.ai_swaps_date === today
        ? (usage.ai_swaps_count ?? 0)
        : 0;
      await supabase.from('usage_tracking').upsert(
        { user_id: uid, ai_swaps_date: today, ai_swaps_count: count + 1 },
        { onConflict: 'user_id' }
      );
    } catch (e) {
      console.warn('[usageLimits] incrementAISwap error:', e.message);
    }
  };

  return {
    checkFavorites,
    checkWardrobe,
    checkOutfitRecs,
    isOutfitRecsLocked,
    checkAiDetection,
    checkTrips,
    incrementOutfitRecs,
    incrementAiDetection,
    incrementTrips,
    canDoAISwap,
    incrementAISwap,
  };
}
