// Premium-only AI Stylist screen. Fetches the user's wardrobe, calls Claude to identify
// gap items and generate prioritized suggestions, then caches results in AsyncStorage keyed
// by wardrobe count so the API is skipped when nothing has changed. Free users see a
// paywall gate (LockedStylistView) instead of the analysis.
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { supabase } from '../lib/supabase';
import { PRIMARY, SECONDARY, CARD_BG } from '../constants/colors';
import { FONTS } from '../constants/fonts';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../hooks/useSubscription';
import { syncSubscriptionStatus } from '../lib/revenuecat';

var ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
var CACHE_KEY_PREFIX = 'stylist_suggestions_';

// Display configuration for each priority level — badge label, text color, and background.
var PRIORITY_CONFIG = {
  high:   { label: 'High Priority',   color: '#FFFFFF', bg: SECONDARY },
  medium: { label: 'Medium Priority', color: '#D97706', bg: '#FEF3C7' },
  low:    { label: 'Low Priority',    color: '#059669', bg: '#D1FAE5' },
};

// Numeric sort keys used by sortSuggestions — lower number = shown first.
var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Gate component shown to free-tier users. Presents the RevenueCatUI paywall inline and
// syncs subscription status after a confirmed purchase or restore so StylistScreen
// re-renders immediately as paid without waiting for the RevenueCat listener tick.
function LockedStylistView() {
  // Presents the full-screen paywall; calls syncSubscriptionStatus on purchase/restore
  // so the useSubscription hook reflects the new entitlement right away.
  const handleUpgrade = async () => {
    try {
      const result = await RevenueCatUI.presentPaywall();
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        await syncSubscriptionStatus();
      }
    } catch (err) {
      console.error('[Purchase] handleUpgrade error:', err);
    }
  };

  return (
    <View style={styles.lockedContainer}>
      <Ionicons name="lock-closed-outline" size={20} color={PRIMARY} style={styles.lockedIcon} />
      <Text style={styles.lockedTitle}>AI Stylist</Text>
      <Text style={styles.lockedSub}>
        Get personalized wardrobe gap analysis and smart styling suggestions — Premium only.
      </Text>
      <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} activeOpacity={0.85}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
          <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
      <View style={styles.lockedFeatures}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark" size={16} color={PRIMARY} />
          <Text style={styles.lockedFeatureItem}>Wardrobe gap analysis</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark" size={16} color={PRIMARY} />
          <Text style={styles.lockedFeatureItem}>Personalized styling tips</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="checkmark" size={16} color={PRIMARY} />
          <Text style={styles.lockedFeatureItem}>Priority item suggestions</Text>
        </View>
      </View>
    </View>
  );
}

// Main screen component. Gates on isPaid — shows LockedStylistView for free users,
// otherwise loads wardrobe gap analysis from cache or Claude and renders suggestion cards.
export default function StylistScreen() {
  const { isPaid, isLoading: subLoading } = useSubscription();

  // AI analysis results, async state flags, and error discriminant ('too_few' | 'generic' | null).
  var [suggestions, setSuggestions] = useState(null);
  var [summary, setSummary] = useState('');
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);
  var [error, setError] = useState(null);

  // Trigger analysis only once subscription status is confirmed paid; avoids an
  // unnecessary API call for free users who see LockedStylistView instead.
  useEffect(() => {
    if (isPaid) load(false);
  }, [isPaid]);

  // Loads wardrobe gap analysis. On a non-forced load, checks AsyncStorage for a cached
  // result with a matching wardrobe item count before calling Claude. After a successful
  // API call, writes the result back to cache so subsequent loads with the same wardrobe skip it.
  var load = useCallback(async (forceRefresh) => {
    setError(null);
    if (!forceRefresh) setLoading(true);

    try {
      var { data: { user } } = await supabase.auth.getUser();
      var { data: wardrobe, error: wErr } = await supabase
        .from('clothing_items')
        .select('id, name, category, subcategory, color, season, formality, image_url')
        .eq('user_id', user.id)
        .eq('is_lent', false);

      if (wErr) throw wErr;

      var count = wardrobe?.length ?? 0;

      if (count < 5) {
        setError('too_few');
        setSuggestions(null);
        return;
      }

      if (!forceRefresh) {
        var cached = await AsyncStorage.getItem(CACHE_KEY_PREFIX + user.id); // per-user key prevents cross-user data leakage
        if (cached) {
          var parsed = JSON.parse(cached);
          // Cache hit: wardrobe size unchanged since last analysis, so suggestions are still valid.
          if (parsed.wardrobeCount === count) {
            setSummary(parsed.data.summary);
            setSuggestions(sortSuggestions(parsed.data.suggestions));
            return;
          }
        }
      }

      var wardrobeList = wardrobe.map(i =>
        `- ${i.name} | category: ${i.category}${i.subcategory ? ' / ' + i.subcategory : ''} | color: ${i.color} | season: ${i.season ?? 'all'} | formality: ${i.formality ?? 'unspecified'}`
      ).join('\n');

      var aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `You are a confident personal stylist with impeccable taste. Speak with warmth and certainty. Recommend complete head-to-toe looks, not isolated pieces. Style the user the way a trusted friend with great taste would — decisive, specific, and a little glamorous.

Analyze the user's wardrobe and identify gaps — types of clothing they're missing that would make their wardrobe more versatile and complete. Focus on styling advice only; do not mention stores, brands, or shopping. Return ONLY valid JSON matching this exact structure, with no markdown, no explanation, no wrapper:
{
  "summary": "1-2 sentence overall assessment of the wardrobe",
  "suggestions": [
    {
      "category": "short name of the item type to add (e.g. 'Neutral cardigan')",
      "reason": "why this fills a gap in their wardrobe",
      "pairs_with": ["names of existing wardrobe items it would pair well with"],
      "priority": "high" or "medium" or "low"
    }
  ]
}
Aim for 4-6 suggestions. Vary priority levels based on how significant the gap is. Note: some items may have formality listed as "unspecified" — work with the data available.`,
          messages: [{
            role: 'user',
            content: `Here is my current wardrobe (${count} items):\n${wardrobeList}\n\nPlease analyze what I'm missing and suggest items that would round out my closet.`,
          }],
        }),
      });

      if (!aiResp.ok) throw new Error(`API error ${aiResp.status}`);

      var aiData = await aiResp.json();
      var rawText = aiData.content?.[0]?.text?.trim() ?? '';
      var jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim(); // strip markdown fences Claude sometimes wraps around JSON
      var result = JSON.parse(jsonStr);

      // Defensive shape check — surface a clear error rather than a cryptic runtime crash
      // if Claude returns a malformed response.
      if (!result.summary || !Array.isArray(result.suggestions)) {
        throw new Error('Unexpected response shape from AI');
      }

      // Cache result keyed by wardrobe count so that adding or removing items automatically
      // invalidates the cache and triggers a fresh API call on the next load.
      await AsyncStorage.setItem(CACHE_KEY_PREFIX + user.id, JSON.stringify({
        wardrobeCount: count,
        data: result,
      }));

      setSummary(result.summary);
      setSuggestions(sortSuggestions(result.suggestions));
    } catch (err) {
      console.error('[Stylist]', err.message);
      setError('generic');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Pull-to-refresh handler. Passes forceRefresh=true to bypass the AsyncStorage cache
  // so Claude is always called on a manual refresh, even if the wardrobe count is unchanged.
  var handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  if (subLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator style={{ flex: 1 }} size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  if (!isPaid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LockedStylistView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>AI Stylist</Text>
          <Text style={styles.subtitle}>Wardrobe gap analysis</Text>
        </View>

        {loading && (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color="#E1D3F8" style={{ marginBottom: 16 }} />
            <Text style={styles.stateTitle}>Analyzing your wardrobe…</Text>
            <Text style={styles.stateSub}>Finding gaps and opportunities</Text>
          </View>
        )}

        {!loading && error === 'too_few' && (
          <View style={styles.stateBox}>
            <Ionicons name="shirt-outline" size={48} color="#9B9B9B" style={styles.stateEmoji} />
            <Text style={styles.stateTitle}>Add more clothes first</Text>
            <Text style={styles.stateSub}>
              Add at least 5 items to your wardrobe so your AI stylist can give you meaningful advice.
            </Text>
          </View>
        )}

        {!loading && error === 'generic' && (
          <View style={styles.stateBox}>
            <Ionicons name="sad-outline" size={48} color="#9B9B9B" style={styles.stateEmoji} />
            <Text style={styles.stateTitle}>Something went wrong</Text>
            <Text style={styles.stateSub}>Couldn't analyze your wardrobe. Please try again.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load(true)}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && suggestions && (
          <>
            <View style={styles.summaryBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="sparkles-outline" size={20} color={PRIMARY} />
                <Text style={styles.summaryLabel}>Stylist's Take</Text>
              </View>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>

            <Text style={styles.sectionLabel}>What to add next</Text>

            {suggestions.map((s, idx) => (
              <SuggestionCard key={idx} suggestion={s} />
            ))}

            <Text style={styles.disclaimer}>Powered by AI · Pull down to refresh</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Sorts suggestions high → medium → low using PRIORITY_ORDER numeric keys.
// Unknown priority strings default to 3 so they sort after all recognized levels.
function sortSuggestions(suggestions) {
  return [...suggestions].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  );
}

// Renders one gap suggestion with a color-coded priority badge, a gap description,
// and a comma-separated list of existing wardrobe items it pairs well with.
function SuggestionCard({ suggestion }) {
  var { category, reason, pairs_with, priority } = suggestion;
  var cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low; // fall back to low display config for any unrecognized priority string

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardCategory}>{category ?? ''}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.priorityText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.cardReason}>{reason ?? ''}</Text>
      {pairs_with?.length > 0 && (
        <View style={styles.pairsRow}>
          <Text style={styles.pairsLabel}>Pairs with: </Text>
          <Text style={styles.pairsItems}>{pairs_with.join(', ')}</Text>
        </View>
      )}
    </View>
  );
}

// Styles for StylistScreen, LockedStylistView, and SuggestionCard — safe area, header,
// loading/empty/error state boxes, stylist summary highlight box, suggestion cards with
// priority badges and pairing lists, and the locked-view upgrade prompt with feature list.
var styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F5F0' },
  scrollContent: { paddingBottom: 48 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1C1C1C',
    letterSpacing: -0.5,
    fontFamily: FONTS.heading,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: FONTS.body,
  },

  stateBox: {
    marginHorizontal: 16,
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  stateEmoji: { fontSize: 48, marginBottom: 16 },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1C',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: FONTS.headingRegular,
  },
  stateSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#E1D3F8',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, fontFamily: FONTS.bodyMedium },

  summaryBox: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#F9F5FF',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#E1D3F8',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    marginBottom: 6,
    fontFamily: FONTS.bodyMedium,
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
    fontFamily: FONTS.body,
  },

  sectionLabel: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: FONTS.bodyMedium,
  },

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardCategory: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1C',
    flex: 1,
    marginRight: 8,
    fontFamily: FONTS.heading,
  },
  priorityBadge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  priorityText: { fontSize: 11, fontWeight: '600', fontFamily: FONTS.bodyMedium },
  cardReason: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
    fontFamily: FONTS.body,
  },
  pairsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  pairsLabel: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  pairsItems: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    fontFamily: FONTS.body,
  },

  disclaimer: {
    marginTop: 28,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: FONTS.body,
  },

  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  lockedIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  lockedTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1C',
    marginBottom: 12,
    letterSpacing: -0.3,
    fontFamily: FONTS.heading,
  },
  lockedSub: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    fontFamily: FONTS.body,
  },
  upgradeBtn: {
    backgroundColor: PRIMARY,
    paddingVertical: 15,
    paddingHorizontal: 36,
    borderRadius: 14,
    marginBottom: 28,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bodyBold,
  },
  lockedFeatures: {
    gap: 10,
    alignItems: 'flex-start',
  },
  lockedFeatureItem: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    fontFamily: FONTS.bodyMedium,
  },
});
