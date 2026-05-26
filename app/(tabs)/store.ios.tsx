import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassView } from "expo-glass-effect";
import { IconSymbol } from "@/components/IconSymbol";
import { apiGet, apiPost, authenticatedGet, authenticatedPost } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  category: string;
  rarity: string;
  currencyType: string;
  tab: string;
  iapProductId: string | null;
  priceDisplay: string | null;
  sortOrder: number;
  createdAt: string;
}

interface UserStats {
  userId: string;
  highScore: number;
  totalCoins: number;
  weeklyScore: number;
  lastScoreUpdate: string;
  createdAt: string;
}

interface Purchase {
  id: string;
  userId: string;
  itemId: string;
  purchasedAt: string;
}

interface EquippedSlot {
  itemId: string;
  item?: StoreItem;
}

interface EquippedSlots {
  skin: EquippedSlot | null;
  trail: EquippedSlot | null;
  theme: EquippedSlot | null;
  gravity_effect: EquippedSlot | null;
  death_effect: EquippedSlot | null;
}

interface NextReward {
  dayNumber: number;
  rewardType: string;
  rewardValue: number;
  item?: StoreItem;
}

interface DailyStreak {
  currentStreak: number;
  lastClaimedDate: string | null;
  canClaimToday: boolean;
  nextReward: NextReward | null;
}

type TabKey = 'skins' | 'trails' | 'themes' | 'effects' | 'premium' | 'daily';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFlux(n: number): string {
  const num = Number(n) || 0;
  if (num >= 1000) return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'k';
  return String(num);
}

const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

function getRarityColor(rarity: string): string {
  return RARITY_COLOR[rarity] || RARITY_COLOR.common;
}

function categoryToSlot(category: string): 'skin' | 'trail' | 'theme' | 'gravity_effect' | 'death_effect' {
  if (category === 'effect') return 'gravity_effect';
  if (category === 'skin' || category === 'trail' || category === 'theme') return category;
  return 'skin';
}

function isEquipped(equipped: EquippedSlots | null, item: StoreItem): boolean {
  if (!equipped) return false;
  const slot = categoryToSlot(item.category);
  const slotData = equipped[slot];
  return !!slotData && slotData.itemId === item.id;
}

function getThemeColors(name: string): [string, string] {
  const map: Record<string, [string, string]> = {
    'Retro Neon': ['#0d0d1a', '#ff00ff'],
    'Cyber Grid': ['#001a33', '#00ffff'],
    'Matrix Green': ['#001a00', '#00ff41'],
    'Deep Space': ['#000011', '#4444ff'],
    'Solar Storm': ['#1a0500', '#ff6600'],
    'Vaporwave Night': ['#1a0033', '#ff66cc'],
  };
  return map[name] || ['#1a1a2e', '#6366f1'];
}

// ─── Preview Components ───────────────────────────────────────────────────────

function SkinPreview({ rarity }: { rarity: string }) {
  const color = getRarityColor(rarity);
  return (
    <View style={previewStyles.container}>
      <View style={[previewStyles.skinCircle, { backgroundColor: color }]}>
        <View style={previewStyles.skinSheen} />
      </View>
    </View>
  );
}

function TrailPreview({ rarity }: { rarity: string }) {
  const color = getRarityColor(rarity);
  const dots = [
    { size: 10, opacity: 1.0 },
    { size: 9, opacity: 0.8 },
    { size: 8, opacity: 0.6 },
    { size: 7, opacity: 0.4 },
    { size: 6, opacity: 0.2 },
  ];
  return (
    <View style={previewStyles.container}>
      <View style={previewStyles.trailRow}>
        {dots.map((d, i) => (
          <View
            key={i}
            style={[
              previewStyles.trailDot,
              {
                width: d.size,
                height: d.size,
                borderRadius: d.size / 2,
                backgroundColor: color,
                opacity: d.opacity,
              },
            ]}
          />
        ))}
        <View style={[previewStyles.trailPlayer, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ThemePreview({ item }: { item: StoreItem }) {
  const [bg, obstacle] = getThemeColors(item.name);
  return (
    <View style={previewStyles.container}>
      <View style={previewStyles.themeRect}>
        <View style={[previewStyles.themeHalf, { backgroundColor: bg }]} />
        <View style={[previewStyles.themeHalf, { backgroundColor: obstacle }]} />
      </View>
    </View>
  );
}

function EffectPreview({ rarity }: { rarity: string }) {
  const color = getRarityColor(rarity);
  return (
    <View style={previewStyles.container}>
      <View style={[previewStyles.effectRing, { borderColor: color, opacity: 0.3, width: 60, height: 60, borderRadius: 30 }]} />
      <View style={[previewStyles.effectRing, { borderColor: color, opacity: 0.6, width: 44, height: 44, borderRadius: 22 }]} />
      <View style={[previewStyles.effectRing, { borderColor: color, opacity: 1.0, width: 28, height: 28, borderRadius: 14 }]} />
    </View>
  );
}

function FluxPackPreview({ price, iconColor }: { price: number; iconColor: string }) {
  const count = price <= 99 ? 1 : price <= 299 ? 2 : price <= 499 ? 3 : 4;
  const icons = Array.from({ length: count });
  return (
    <View style={previewStyles.container}>
      <View style={previewStyles.fluxRow}>
        {icons.map((_, i) => (
          <IconSymbol
            key={i}
            ios_icon_name="bolt.fill"
            android_material_icon_name="bolt"
            size={20}
            color={iconColor}
          />
        ))}
      </View>
    </View>
  );
}

function ItemPreview({ item, primaryColor }: { item: StoreItem; primaryColor: string }) {
  const cat = item.category || '';
  if (cat === 'skin') return <SkinPreview rarity={item.rarity} />;
  if (cat === 'trail') return <TrailPreview rarity={item.rarity} />;
  if (cat === 'theme') return <ThemePreview item={item} />;
  if (cat === 'effect') return <EffectPreview rarity={item.rarity} />;
  if (item.currencyType === 'iap') return <FluxPackPreview price={item.price} iconColor={primaryColor} />;
  return (
    <View style={previewStyles.container}>
      <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={40} color={getRarityColor(item.rarity)} />
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  skinSheen: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trailDot: {},
  trailPlayer: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 4,
  },
  themeRect: {
    width: 70,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  themeHalf: {
    flex: 1,
  },
  effectRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  fluxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'skins', label: 'Skins' },
  { key: 'trails', label: 'Trails' },
  { key: 'themes', label: 'Themes' },
  { key: 'effects', label: 'Effects' },
  { key: 'premium', label: 'Premium' },
  { key: 'daily', label: 'Daily' },
];

export default function StoreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [items, setItems] = useState<StoreItem[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<EquippedSlots | null>(null);
  const [dailyStreak, setDailyStreak] = useState<DailyStreak | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('skins');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [modalState, setModalState] = useState({ visible: false, title: '', message: '' });
  const [purchaseSuccess, setPurchaseSuccess] = useState<{ visible: boolean; item: StoreItem | null }>({ visible: false, item: null });

  const isDark = theme.dark;
  const backgroundColor = isDark ? '#0a0a0f' : '#e0f2ff';
  const textColor = isDark ? '#ffffff' : '#1e293b';
  const secondaryColor = isDark ? '#98989D' : '#666';
  const buttonBg = isDark ? '#1e40af' : '#3b82f6';
  const secondaryBg = isDark ? '#1e293b' : '#f1f5f9';
  const cardBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const primaryColor = theme.colors.primary;

  const showModal = (title: string, message: string) => {
    setModalState({ visible: true, title, message });
  };

  const loadAll = useCallback(async () => {
    console.log('[Store] loadAll start, user:', user?.id ?? 'unauthenticated');
    setLoading(true);
    try {
      let fetchedItems: StoreItem[] = [];
      try {
        console.log('[Store] Fetching /api/store/items');
        fetchedItems = await apiGet<StoreItem[]>('/api/store/items');
        console.log('[Store] Items fetched:', fetchedItems?.length ?? 0);
      } catch (e) {
        console.error('[Store] Error fetching items:', e);
        fetchedItems = [];
      }

      if (!Array.isArray(fetchedItems) || fetchedItems.length === 0) {
        try {
          console.log('[Store] Items empty, seeding via POST /api/store/seed');
          await apiPost('/api/store/seed', {});
          fetchedItems = await apiGet<StoreItem[]>('/api/store/items');
          console.log('[Store] Items after seed:', fetchedItems?.length ?? 0);
        } catch (e) {
          console.error('[Store] Error seeding items:', e);
          fetchedItems = [];
        }
      }

      setItems(Array.isArray(fetchedItems) ? fetchedItems : []);

      if (user) {
        const [statsResult, purchasesResult, equippedResult, dailyResult] = await Promise.allSettled([
          authenticatedGet<UserStats>('/api/stats'),
          authenticatedGet<Purchase[]>('/api/store/purchases'),
          authenticatedGet<EquippedSlots>('/api/store/equipped'),
          authenticatedGet<DailyStreak>('/api/store/daily-streak'),
        ]);

        if (statsResult.status === 'fulfilled') {
          console.log('[Store] Stats loaded, totalCoins:', statsResult.value?.totalCoins);
          setStats(statsResult.value);
        } else {
          console.error('[Store] Error loading stats:', statsResult.reason);
        }

        if (purchasesResult.status === 'fulfilled') {
          const purchases = Array.isArray(purchasesResult.value) ? purchasesResult.value : [];
          const ids = new Set<string>(purchases.map((p) => p.itemId));
          console.log('[Store] Purchases loaded:', ids.size, 'items');
          setPurchasedIds(ids);
        } else {
          console.error('[Store] Error loading purchases:', purchasesResult.reason);
        }

        if (equippedResult.status === 'fulfilled') {
          console.log('[Store] Equipped loaded:', equippedResult.value);
          setEquipped(equippedResult.value);
        } else {
          console.error('[Store] Error loading equipped:', equippedResult.reason);
        }

        if (dailyResult.status === 'fulfilled') {
          console.log('[Store] Daily streak loaded:', dailyResult.value);
          setDailyStreak(dailyResult.value);
        } else {
          console.error('[Store] Error loading daily streak:', dailyResult.reason);
        }
      }
    } finally {
      setLoading(false);
      console.log('[Store] loadAll complete');
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handlePurchase = async (item: StoreItem) => {
    console.log('[Store] handlePurchase pressed, itemId:', item.id, 'name:', item.name);
    if (!user) {
      showModal('Sign In Required', 'Please sign in to purchase items.');
      return;
    }
    if (item.currencyType === 'iap') {
      showModal('In-App Purchase', 'In-app purchases are not configured yet.');
      return;
    }
    setPurchasing(item.id);
    try {
      console.log('[Store] POST /api/store/purchase, itemId:', item.id);
      const result = await authenticatedPost<Purchase>('/api/store/purchase', { itemId: item.id });
      console.log('[Store] Purchase success:', result);
      setPurchasedIds((prev) => new Set([...prev, item.id]));
      setPurchaseSuccess({ visible: true, item });
      if (stats) {
        setStats({ ...stats, totalCoins: Math.max(0, stats.totalCoins - item.price) });
      }
    } catch (e: any) {
      console.error('[Store] Purchase error:', e);
      const msg = e?.message || 'Purchase failed. Please try again.';
      showModal('Purchase Failed', msg);
    } finally {
      setPurchasing(null);
    }
  };

  const handleEquip = async (item: StoreItem) => {
    console.log('[Store] handleEquip pressed, itemId:', item.id, 'name:', item.name);
    if (!user) {
      showModal('Sign In Required', 'Please sign in to equip items.');
      return;
    }
    const slot = categoryToSlot(item.category);
    setEquipping(item.id);
    try {
      console.log('[Store] POST /api/store/equip, itemId:', item.id, 'slot:', slot);
      await authenticatedPost('/api/store/equip', { itemId: item.id, slot });
      console.log('[Store] Equip success, slot:', slot, 'itemId:', item.id);
      const newEquipped = await authenticatedGet<EquippedSlots>('/api/store/equipped');
      setEquipped(newEquipped);
    } catch (e: any) {
      console.error('[Store] Equip error:', e);
      showModal('Equip Failed', e?.message || 'Could not equip item.');
    } finally {
      setEquipping(null);
    }
  };

  const handleClaimDaily = async () => {
    console.log('[Store] handleClaimDaily pressed');
    if (!user) {
      showModal('Sign In Required', 'Please sign in to claim daily rewards.');
      return;
    }
    setClaimingDaily(true);
    try {
      console.log('[Store] POST /api/store/claim-daily');
      const result = await authenticatedPost<{ success: boolean; reward: { type: string; value: number; item?: StoreItem }; newStreak: number }>('/api/store/claim-daily', {});
      console.log('[Store] Daily claim success:', result);
      const rewardMsg = result.reward?.type === 'coins'
        ? `You earned ${result.reward.value} Flux!`
        : result.reward?.item?.name
          ? `You received: ${result.reward.item.name}!`
          : 'Reward claimed!';
      showModal('Daily Reward Claimed!', rewardMsg);
      const newStreak = await authenticatedGet<DailyStreak>('/api/store/daily-streak');
      setDailyStreak(newStreak);
      if (stats) {
        const coinsGained = result.reward?.type === 'coins' ? (result.reward.value || 0) : 0;
        setStats({ ...stats, totalCoins: stats.totalCoins + coinsGained });
      }
    } catch (e: any) {
      console.error('[Store] Daily claim error:', e);
      showModal('Claim Failed', e?.message || 'Could not claim daily reward.');
    } finally {
      setClaimingDaily(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    if (activeTab === 'premium') return items.filter((i) => i.currencyType === 'iap');
    if (activeTab === 'daily') return [];
    return items.filter((i) => (i.tab || '').toLowerCase() === activeTab);
  }, [items, activeTab]);

  const totalCoins = stats?.totalCoins ?? 0;
  const currentStreak = dailyStreak?.currentStreak ?? 0;
  const canClaim = dailyStreak?.canClaimToday ?? false;
  const nextReward = dailyStreak?.nextReward ?? null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={primaryColor} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar */}
        <GlassView
          style={[styles.topBar, Platform.OS !== 'ios' && { backgroundColor: cardBg }]}
          glassEffectStyle="regular"
        >
          <View style={styles.fluxRow}>
            <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="bolt" size={20} color="#f59e0b" />
            <Text style={[styles.fluxAmount, { color: textColor }]}>{totalCoins.toLocaleString()}</Text>
            <Text style={[styles.fluxLabel, { color: secondaryColor }]}>Flux</Text>
          </View>
          <TouchableOpacity
            style={styles.restoreButton}
            onPress={() => {
              console.log('[Store] Restore purchases pressed');
              showModal('Restore Purchases', 'Restore purchases is not implemented yet.');
            }}
          >
            <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="restore" size={22} color={textColor} />
          </TouchableOpacity>
        </GlassView>

        {/* Sign-in gate */}
        {!user && (
          <GlassView
            style={[styles.signInBanner, Platform.OS !== 'ios' && { backgroundColor: cardBg }]}
            glassEffectStyle="regular"
          >
            <Text style={[styles.signInText, { color: secondaryColor }]}>
              Sign in to purchase items and track progress
            </Text>
            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: buttonBg }]}
              onPress={() => {
                console.log('[Store] Sign in button pressed');
                router.push('/auth');
              }}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </GlassView>
        )}

        {/* Tab Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabScroll}
          contentContainerStyle={styles.tabContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && { borderBottomColor: primaryColor, borderBottomWidth: 2 }]}
                onPress={() => {
                  console.log('[Store] Tab pressed:', tab.key);
                  setActiveTab(tab.key);
                }}
              >
                <Text style={[styles.tabText, { color: isActive ? primaryColor : secondaryColor, fontWeight: isActive ? '700' : '400' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Daily Tab */}
        {activeTab === 'daily' && (
          <View style={styles.dailyContainer}>
            {!user || !dailyStreak ? (
              <GlassView
                style={[styles.dailyCard, Platform.OS !== 'ios' && { backgroundColor: cardBg }]}
                glassEffectStyle="regular"
              >
                <IconSymbol ios_icon_name="calendar" android_material_icon_name="card-giftcard" size={48} color={secondaryColor} />
                <Text style={[styles.dailyEmptyText, { color: secondaryColor }]}>
                  Sign in to claim daily rewards
                </Text>
              </GlassView>
            ) : (
              <GlassView
                style={[styles.dailyCard, Platform.OS !== 'ios' && { backgroundColor: cardBg }]}
                glassEffectStyle="regular"
              >
                <Text style={[styles.dailyTitle, { color: textColor }]}>Daily Reward</Text>
                <Text style={[styles.streakNumber, { color: primaryColor }]}>{currentStreak}</Text>
                <Text style={[styles.streakLabel, { color: secondaryColor }]}>DAY STREAK</Text>

                {/* Week circles */}
                <View style={styles.weekRow}>
                  {Array.from({ length: 7 }).map((_, i) => {
                    const dayNum = i + 1;
                    const isCompleted = dayNum < currentStreak;
                    const isToday = dayNum === currentStreak;
                    const circleColor = isCompleted || isToday ? primaryColor : secondaryColor;
                    const circleBg = isCompleted ? primaryColor : 'transparent';
                    return (
                      <View
                        key={i}
                        style={[
                          styles.weekCircle,
                          {
                            borderColor: circleColor,
                            backgroundColor: circleBg,
                            opacity: isCompleted || isToday ? 1 : 0.4,
                          },
                        ]}
                      >
                        {isCompleted && (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check-circle" size={12} color="#fff" />
                        )}
                        {!isCompleted && (
                          <Text style={[styles.weekDayText, { color: isToday ? primaryColor : secondaryColor }]}>{dayNum}</Text>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Next reward */}
                {nextReward && (
                  <View style={styles.nextRewardRow}>
                    <Text style={[styles.nextRewardLabel, { color: secondaryColor }]}>Next Reward</Text>
                    <View style={styles.nextRewardContent}>
                      {nextReward.rewardType === 'coins' ? (
                        <>
                          <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="bolt" size={18} color="#f59e0b" />
                          <Text style={[styles.nextRewardValue, { color: textColor }]}>{nextReward.rewardValue}</Text>
                          <Text style={[styles.nextRewardUnit, { color: secondaryColor }]}>Flux</Text>
                        </>
                      ) : (
                        <>
                          <IconSymbol ios_icon_name="gift.fill" android_material_icon_name="card-giftcard" size={18} color={primaryColor} />
                          <Text style={[styles.nextRewardValue, { color: textColor }]}>{nextReward.item?.name ?? 'Item'}</Text>
                        </>
                      )}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.claimButton,
                    { backgroundColor: canClaim ? buttonBg : secondaryBg },
                  ]}
                  onPress={handleClaimDaily}
                  disabled={!canClaim || claimingDaily}
                >
                  {claimingDaily ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.claimButtonText, { color: canClaim ? '#fff' : secondaryColor }]}>
                      {canClaim ? 'Claim Reward' : 'Already Claimed'}
                    </Text>
                  )}
                </TouchableOpacity>
              </GlassView>
            )}
          </View>
        )}

        {/* Item Grid */}
        {activeTab !== 'daily' && (
          <>
            {filteredItems.length === 0 ? (
              <View style={styles.emptyContainer}>
                <IconSymbol ios_icon_name="bag" android_material_icon_name="shopping-cart" size={48} color={secondaryColor} />
                <Text style={[styles.emptyText, { color: secondaryColor }]}>No items in this category yet</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {filteredItems.map((item) => {
                  const owned = purchasedIds.has(item.id);
                  const equipped_ = isEquipped(equipped, item);
                  const isPurchasing = purchasing === item.id;
                  const isEquipping_ = equipping === item.id;
                  const rarityColor = getRarityColor(item.rarity);
                  const rarityText = (item.rarity || 'common').toUpperCase();
                  const itemName = item.name || 'Unknown';
                  const priceText = item.currencyType === 'iap'
                    ? (item.priceDisplay || `$${(Number(item.price) / 100).toFixed(2)}`)
                    : formatFlux(item.price);

                  return (
                    <GlassView
                      key={item.id}
                      style={[styles.card, Platform.OS !== 'ios' && { backgroundColor: cardBg }]}
                      glassEffectStyle="regular"
                    >
                      <ItemPreview item={item} primaryColor={primaryColor} />

                      <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                        {itemName}
                      </Text>

                      <View style={styles.rarityRow}>
                        <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                        <Text style={[styles.rarityText, { color: secondaryColor }]}>{rarityText}</Text>
                      </View>

                      {equipped_ ? (
                        <View style={[styles.actionButton, { backgroundColor: secondaryBg }]}>
                          <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={16} color={primaryColor} />
                          <Text style={[styles.actionButtonText, { color: primaryColor }]}>Equipped</Text>
                        </View>
                      ) : owned ? (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: secondaryBg }]}
                          onPress={() => handleEquip(item)}
                          disabled={isEquipping_}
                        >
                          {isEquipping_ ? (
                            <ActivityIndicator size="small" color={primaryColor} />
                          ) : (
                            <>
                              <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check-circle-outline" size={16} color={textColor} />
                              <Text style={[styles.actionButtonText, { color: textColor }]}>Equip</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: buttonBg }]}
                          onPress={() => handlePurchase(item)}
                          disabled={isPurchasing}
                        >
                          {isPurchasing ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : item.currencyType === 'iap' ? (
                            <Text style={[styles.actionButtonText, { color: '#fff' }]}>{priceText}</Text>
                          ) : (
                            <>
                              <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="bolt" size={14} color="#fff" />
                              <Text style={[styles.actionButtonText, { color: '#fff' }]}>{priceText}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </GlassView>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Info/Error Modal */}
      <Modal
        visible={modalState.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalState((s) => ({ ...s, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <GlassView
            style={[styles.modalCard, Platform.OS !== 'ios' && { backgroundColor: isDark ? 'rgba(20,20,30,0.97)' : 'rgba(255,255,255,0.97)' }]}
            glassEffectStyle="regular"
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>{modalState.title}</Text>
            <Text style={[styles.modalMessage, { color: secondaryColor }]}>{modalState.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: buttonBg }]}
              onPress={() => {
                console.log('[Store] Modal OK pressed');
                setModalState((s) => ({ ...s, visible: false }));
              }}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </GlassView>
        </View>
      </Modal>

      {/* Purchase Success Modal */}
      <Modal
        visible={purchaseSuccess.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPurchaseSuccess({ visible: false, item: null })}
      >
        <View style={styles.modalOverlay}>
          <GlassView
            style={[styles.modalCard, Platform.OS !== 'ios' && { backgroundColor: isDark ? 'rgba(20,20,30,0.97)' : 'rgba(255,255,255,0.97)' }]}
            glassEffectStyle="regular"
          >
            <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={56} color={primaryColor} />
            <Text style={[styles.modalTitle, { color: textColor }]}>Purchase Complete</Text>
            <Text style={[styles.modalItemName, { color: primaryColor }]}>{purchaseSuccess.item?.name ?? ''}</Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalButtonHalf, { backgroundColor: buttonBg }]}
                onPress={() => {
                  console.log('[Store] Equip Now pressed after purchase, itemId:', purchaseSuccess.item?.id);
                  const item = purchaseSuccess.item;
                  setPurchaseSuccess({ visible: false, item: null });
                  if (item) handleEquip(item);
                }}
              >
                <Text style={styles.modalButtonText}>Equip Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonHalf, { backgroundColor: secondaryBg }]}
                onPress={() => {
                  console.log('[Store] Close purchase success modal');
                  setPurchaseSuccess({ visible: false, item: null });
                }}
              >
                <Text style={[styles.modalButtonText, { color: textColor }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </GlassView>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignSelf: 'center',
    marginTop: 100,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  fluxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fluxAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  fluxLabel: {
    fontSize: 14,
  },
  restoreButton: {
    padding: 4,
  },
  signInBanner: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  signInText: {
    fontSize: 13,
    flex: 1,
  },
  signInButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tabScroll: {
    marginBottom: 16,
  },
  tabContent: {
    gap: 4,
    paddingRight: 8,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 4,
  },
  tabText: {
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  rarityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  rarityText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 5,
    minHeight: 40,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  dailyContainer: {
    paddingTop: 4,
  },
  dailyCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  dailyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: 'bold',
    lineHeight: 72,
  },
  streakLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  weekCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nextRewardRow: {
    alignItems: 'center',
    gap: 6,
  },
  nextRewardLabel: {
    fontSize: 13,
  },
  nextRewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextRewardValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextRewardUnit: {
    fontSize: 14,
  },
  claimButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  claimButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dailyEmptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalButtonHalf: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
