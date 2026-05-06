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
import { supabase } from '../lib/supabase';

var ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
var CACHE_KEY_PREFIX = 'stylist_suggestions_';

var PRIORITY_CONFIG = {
  high:   { label: 'High Priority',   color: '#7C3AED', bg: '#F3E8FF' },
  medium: { label: 'Medium Priority', color: '#D97706', bg: '#FEF3C7' },
  low:    { label: 'Low Priority',    color: '#059669', bg: '#D1FAE5' },
};

var PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export default function StylistScreen() {
  var [suggestions, setSuggestions] = useState(null);
  var [summary, setSummary] = useState('');
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);
  var [error, setError] = useState(null);

  useEffect(() => {
    load(false);
  }, []);

  var load = useCallback(async (forceRefresh) => {
    setError(null);
    if (!forceRefresh) setLoading(true);

    try {
      var { data: { user } } = await supabase.auth.getUser();
      var { data: wardrobe, error: wErr } = await supabase
        .from('clothing_items')
        .select('id, name, category, subcategory, color, season, formality, image_url')
        .eq('user_id', user.id);

      if (wErr) throw wErr;

      var count = wardrobe?.length ?? 0;

      if (count < 5) {
        setError('too_few');
        setSuggestions(null);
        return;
      }

      if (!forceRefresh) {
        var cached = await AsyncStorage.getItem(CACHE_KEY_PREFIX + user.id);
        if (cached) {
          var parsed = JSON.parse(cached);
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
      var jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();
      var result = JSON.parse(jsonStr);

      if (!result.summary || !Array.isArray(result.suggestions)) {
        throw new Error('Unexpected response shape from AI');
      }

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

  var handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#9b59b6"
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
            <Text style={styles.stateEmoji}>👗</Text>
            <Text style={styles.stateTitle}>Add more clothes first</Text>
            <Text style={styles.stateSub}>
              Add at least 5 items to your wardrobe so your AI stylist can give you meaningful advice.
            </Text>
          </View>
        )}

        {!loading && error === 'generic' && (
          <View style={styles.stateBox}>
            <Text style={styles.stateEmoji}>😕</Text>
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
              <Text style={styles.summaryLabel}>✨ Stylist's Take</Text>
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

function sortSuggestions(suggestions) {
  return [...suggestions].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  );
}

function SuggestionCard({ suggestion }) {
  var { category, reason, pairs_with, priority } = suggestion;
  var cfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.low;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardCategory}>{category}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.priorityText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <Text style={styles.cardReason}>{reason}</Text>
      {pairs_with?.length > 0 && (
        <View style={styles.pairsRow}>
          <Text style={styles.pairsLabel}>Pairs with: </Text>
          <Text style={styles.pairsItems}>{pairs_with.join(', ')}</Text>
        </View>
      )}
    </View>
  );
}

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
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 2,
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
  },
  stateSub: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#E1D3F8',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },

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
    color: '#9b59b6',
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 21,
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
  },

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
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
  },
  priorityBadge: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  priorityText: { fontSize: 11, fontWeight: '600' },
  cardReason: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  pairsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  pairsLabel: {
    fontSize: 12,
    color: '#9b59b6',
    fontWeight: '600',
  },
  pairsItems: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },

  disclaimer: {
    marginTop: 28,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
  },
});
