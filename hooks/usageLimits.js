import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { supabase } from '../lib/supabase';

const FREE_LIMITS = {
  favorites:    5,
  wardrobe:    30,
  outfitRecs:   1,  // per day
  aiDetections: 3,  // per month
  trips:        2,  // per month
};

const todayStr  = () => new Date().toISOString().split('T')[0];   // YYYY-MM-DD
const monthStr  = () => new Date().toISOString().slice(0, 7);     // YYYY-MM

// Module-level userId cache — stable for the lifetime of the auth session
let _cachedUserId = null;

async function getUserId() {
  if (_cachedUserId) return _cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  _cachedUserId = user?.id ?? null;
  return _cachedUserId;
}

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

async function showPaywall() {
  try {
    const result = await RevenueCatUI.presentPaywall();
    return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
  } catch (_) {
    return false;
  }
}

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
  };
}
