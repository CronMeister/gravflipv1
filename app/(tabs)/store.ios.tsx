
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiGet, apiPost, authenticatedGet, authenticatedPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

// ─── Color tokens ────────────────────────────────────────────────────────────
const C = {
  bg0: '#050818',
  bg1: '#0a0f2e',
  cyan: '#00f5ff',
  cyanDim: 'rgba(0,245,255,0.15)',
  cyanGlow: 'rgba(0,245,255,0.35)',
  gold: '#f59e0b',
  goldDim: 'rgba(245,158,11,0.15)',
  purple: '#a855f7',
  purpleDim: 'rgba(168,85,247,0.15)',
  white: '#ffffff',
  whiteFaded: 'rgba(255,255,255,0.4)',
  surface: 'rgba(255,255,255,0.05)',
  surfaceBorder: 'rgba(255,255,255,0.1)',
  rare: '#00f5ff',
  epic: '#a855f7',
  legendary: '#f59e0b',
  common: '#9ca3af',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  price_display: string | null;
  icon: string;
  category: string;
  tab: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  currency_type: 'flux' | 'iap';
  iap_product_id: string | null;
  sort_order: number;
}

interface UserStats {
  totalCoins: number;
  highScore: number;
  weeklyScore: number;
}

interface EquippedSlots {
  skin: { item_id: string; item: StoreItem } | null;
  trail: { item_id: string; item: StoreItem } | null;
  theme: { item_id: string; item: StoreItem } | null;
  gravity_effect: { item_id: string; item: StoreItem } | null;
  death_effect: { item_id: string; item: StoreItem } | null;
}

interface DailyStreak {
  currentStreak: number;
  lastClaimedDate: string | null;
  canClaimToday: boolean;
  nextReward: { type: string; value: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TABS = ['Featured', 'Skins', 'Trails', 'Themes', 'Effects', 'Premium', 'Daily'] as const;
type TabName = typeof TABS[number];

const TAB_TO_API: Record<TabName, string> = {
  Featured: 'featured',
  Skins: 'skins',
  Trails: 'trails',
  Themes: 'themes',
  Effects: 'effects',
  Premium: 'premium',
  Daily: 'daily',
};

const RARITY_COLOR: Record<string, string> = {
  common: C.common,
  rare: C.rare,
  epic: C.epic,
  legendary: C.legendary,
};

const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

function rarityGlow(rarity: string): string {
  switch (rarity) {
    case 'legendary': return 'rgba(245,158,11,0.5)';
    case 'epic': return 'rgba(168,85,247,0.5)';
    case 'rare': return 'rgba(0,245,255,0.5)';
    default: return 'rgba(255,255,255,0.15)';
  }
}

function categoryToSlot(category: string): string {
  if (category === 'effect') return 'gravity_effect';
  return category;
}

function formatFlux(n: number): string {
  return Number(n).toLocaleString();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AnimPressable({
  onPress,
  style,
  children,
  disabled,
  scaleValue = 0.96,
}: {
  onPress?: () => void;
  style?: any;
  children: React.ReactNode;
  disabled?: boolean;
  scaleValue?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const animIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleValue, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scale, scaleValue]);
  const animOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scale]);
  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
      <Pressable onPressIn={animIn} onPressOut={animOut} onPress={onPress} disabled={disabled} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

function LegendaryRotator({ color }: { color: string }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 2,
        borderColor: color,
        borderStyle: 'dashed',
        transform: [{ rotate }],
        opacity: 0.6,
      }}
    />
  );
}

function ItemPreview({ item }: { item: StoreItem }) {
  const color = RARITY_COLOR[item.rarity] || C.common;
  const isLegendary = item.rarity === 'legendary';
  const emoji = item.icon || '✦';
  return (
    <View style={styles.previewArea}>
      {isLegendary && <LegendaryRotator color={color} />}
      <View
        style={[
          styles.previewCircle,
          {
            backgroundColor: `${color}22`,
            borderColor: `${color}55`,
            shadowColor: color,
            shadowOpacity: 0.6,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
      </View>
    </View>
  );
}

function RarityBadge({ rarity }: { rarity: string }) {
  const color = RARITY_COLOR[rarity] || C.common;
  return (
    <View style={[styles.rarityBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.rarityText, { color }]}>{RARITY_LABEL[rarity] || rarity.toUpperCase()}</Text>
    </View>
  );
}

function ItemCard({
  item,
  isOwned,
  isEquipped,
  onPurchase,
  onEquip,
  purchasing,
}: {
  item: StoreItem;
  isOwned: boolean;
  isEquipped: boolean;
  onPurchase: (item: StoreItem) => void;
  onEquip: (item: StoreItem) => void;
  purchasing: boolean;
}) {
  const itemNameUpper = item.name.toUpperCase();
  const priceLabel = item.currency_type === 'iap'
    ? (item.price_display || `$${(item.price / 100).toFixed(2)}`)
    : `⚡ ${formatFlux(item.price)}`;

  const btnBg = isEquipped
    ? C.cyan
    : isOwned
    ? 'rgba(255,255,255,0.12)'
    : item.currency_type === 'iap'
    ? C.gold
    : C.cyan;

  const btnLabel = isEquipped ? 'EQUIPPED' : isOwned ? 'EQUIP' : priceLabel;

  function handleBtn() {
    if (isEquipped) return;
    if (isOwned) {
      console.log('[Store] Equip button pressed for item:', item.id, item.name);
      onEquip(item);
    } else {
      console.log('[Store] Purchase button pressed for item:', item.id, item.name, 'price:', item.price);
      onPurchase(item);
    }
  }

  return (
    <AnimPressable onPress={handleBtn} disabled={isEquipped || purchasing} scaleValue={1.03}>
      <View style={styles.itemCard}>
        <ItemPreview item={item} />
        <View style={styles.itemCardMid}>
          <Text style={styles.itemCardName} numberOfLines={1}>{itemNameUpper}</Text>
          <RarityBadge rarity={item.rarity} />
        </View>
        <View style={styles.itemCardBottom}>
          <View
            style={[
              styles.itemCardBtn,
              {
                backgroundColor: btnBg,
                borderColor: isEquipped ? C.cyan : 'transparent',
                borderWidth: isEquipped ? 1 : 0,
                shadowColor: isEquipped ? C.cyan : 'transparent',
                shadowOpacity: isEquipped ? 0.5 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            {purchasing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.itemCardBtnText, isOwned && !isEquipped && { color: C.white }]}>
                {btnLabel}
              </Text>
            )}
          </View>
        </View>
      </View>
    </AnimPressable>
  );
}

function FluxPackCard({
  item,
  onPurchase,
  purchasing,
}: {
  item: StoreItem;
  onPurchase: (item: StoreItem) => void;
  purchasing: boolean;
}) {
  const priceLabel = item.price_display || `$${(item.price / 100).toFixed(2)}`;
  const fluxAmount = item.name.match(/\d[\d,]*/)?.[0] || '???';

  function handlePress() {
    console.log('[Store] Flux pack purchase pressed:', item.id, item.name);
    onPurchase(item);
  }

  return (
    <AnimPressable onPress={handlePress} disabled={purchasing}>
      <View style={styles.fluxPackCard}>
        <View style={styles.fluxPackLeft}>
          <Text style={{ fontSize: 32 }}>{item.icon || '⚡'}</Text>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.fluxPackName}>{item.name}</Text>
            <Text style={styles.fluxPackDesc} numberOfLines={1}>{item.description}</Text>
          </View>
        </View>
        <View style={styles.fluxPackRight}>
          <Text style={styles.fluxPackAmount}>{fluxAmount}</Text>
          <Text style={styles.fluxPackFluxLabel}>FLUX</Text>
        </View>
        <AnimPressable onPress={handlePress} disabled={purchasing}>
          <View style={styles.fluxPackBtn}>
            {purchasing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.fluxPackBtnText}>{priceLabel}</Text>
            )}
          </View>
        </AnimPressable>
      </View>
    </AnimPressable>
  );
}

function FeaturedBundleCard({
  title,
  badge,
  badgeColor,
  contents,
  price,
  btnLabel,
  gradFrom,
  gradTo,
  btnGradFrom,
  btnGradTo,
  onPress,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  contents: string[];
  price: string;
  btnLabel: string;
  gradFrom: string;
  gradTo: string;
  btnGradFrom: string;
  btnGradTo: string;
  onPress: () => void;
}) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const borderOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });

  function handlePress() {
    console.log('[Store] Featured bundle pressed:', title);
    onPress();
  }

  return (
    <AnimPressable onPress={handlePress} scaleValue={1.02}>
      <View style={[styles.featuredCard, { width: SCREEN_WIDTH * 0.85 }]}>
        <LinearGradient colors={[gradFrom, gradTo]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
        <Animated.View style={[styles.featuredCardBorder, { opacity: borderOpacity, borderColor: badgeColor }]} />
        <View style={[styles.featuredBadge, { backgroundColor: `${badgeColor}33`, borderColor: `${badgeColor}88` }]}>
          <Text style={[styles.featuredBadgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
        <Text style={styles.featuredTitle}>{title}</Text>
        <View style={styles.featuredContents}>
          {contents.map((c, i) => (
            <View key={i} style={styles.featuredContentRow}>
              <Text style={[styles.featuredContentDot, { color: badgeColor }]}>✦</Text>
              <Text style={styles.featuredContentText}>{c}</Text>
            </View>
          ))}
        </View>
        <View style={styles.featuredBottom}>
          <Text style={styles.featuredPrice}>{price}</Text>
          <AnimPressable onPress={handlePress}>
            <LinearGradient colors={[btnGradFrom, btnGradTo]} style={styles.featuredBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.featuredBtnText}>{btnLabel}</Text>
            </LinearGradient>
          </AnimPressable>
        </View>
      </View>
    </AnimPressable>
  );
}

function DailyStreakDots({ streak, canClaim }: { streak: number; canClaim: boolean }) {
  const dots = Array.from({ length: 7 }, (_, i) => i);
  return (
    <View style={styles.streakDots}>
      {dots.map((i) => {
        const claimed = i < streak;
        const isCurrent = i === streak && canClaim;
        const dotColor = claimed ? C.gold : isCurrent ? C.cyan : 'rgba(255,255,255,0.15)';
        return (
          <View
            key={i}
            style={[
              styles.streakDot,
              {
                backgroundColor: dotColor,
                shadowColor: isCurrent ? C.cyan : claimed ? C.gold : 'transparent',
                shadowOpacity: isCurrent || claimed ? 0.8 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            <Text style={styles.streakDotNum}>{i + 1}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Purchase Success Modal ───────────────────────────────────────────────────
function PurchaseModal({
  visible,
  item,
  onClose,
  onEquip,
}: {
  visible: boolean;
  item: StoreItem | null;
  onClose: () => void;
  onEquip: (item: StoreItem) => void;
}) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.5);
      opacity.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!item) return null;
  const itemNameUpper = item.name.toUpperCase();

  function handleEquip() {
    console.log('[Store] Equip Now pressed from purchase modal for item:', item!.id);
    onEquip(item!);
    onClose();
  }

  function handleClose() {
    console.log('[Store] Purchase modal closed');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.purchaseModal, { transform: [{ scale }], opacity }]}>
          <LinearGradient colors={['#0a1a3a', '#050818']} style={StyleSheet.absoluteFill} />
          <View style={styles.purchaseModalBorder} />
          <Text style={styles.purchaseCheck}>✓</Text>
          <Text style={styles.purchaseComplete}>PURCHASE COMPLETE</Text>
          <Text style={styles.purchaseItemName}>{itemNameUpper} UNLOCKED</Text>
          <View style={styles.purchaseModalBtns}>
            <AnimPressable onPress={handleEquip} style={{ flex: 1 }}>
              <LinearGradient colors={[C.cyan, '#0099cc']} style={styles.purchaseEquipBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.purchaseEquipBtnText}>EQUIP NOW</Text>
              </LinearGradient>
            </AnimPressable>
            <AnimPressable onPress={handleClose} style={{ flex: 1 }}>
              <View style={styles.purchaseCloseBtn}>
                <Text style={styles.purchaseCloseBtnText}>CLOSE</Text>
              </View>
            </AnimPressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Error/Info Modal ─────────────────────────────────────────────────────────
function InfoModal({
  visible,
  title,
  message,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) {
  function handleClose() {
    console.log('[Store] Info modal closed:', title);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.infoModal}>
          <LinearGradient colors={['#0d1f4a', '#050818']} style={StyleSheet.absoluteFill} />
          <View style={styles.infoModalBorder} />
          <Text style={styles.infoModalTitle}>{title}</Text>
          <Text style={styles.infoModalMessage}>{message}</Text>
          <AnimPressable onPress={handleClose}>
            <LinearGradient colors={[C.cyan, '#0099cc']} style={styles.infoModalBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.infoModalBtnText}>OK</Text>
            </LinearGradient>
          </AnimPressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StoreScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabName>('Featured');
  const tabFade = useRef(new Animated.Value(1)).current;

  const [items, setItems] = useState<StoreItem[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<EquippedSlots>({
    skin: null, trail: null, theme: null, gravity_effect: null, death_effect: null,
  });
  const [dailyStreak, setDailyStreak] = useState<DailyStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [claimingDaily, setClaimingDaily] = useState(false);

  const [purchaseModal, setPurchaseModal] = useState<{ visible: boolean; item: StoreItem | null }>({ visible: false, item: null });
  const [infoModal, setInfoModal] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });

  const claimPulse = useRef(new Animated.Value(1)).current;

  function showInfo(title: string, message: string) {
    setInfoModal({ visible: true, title, message });
  }

  // Claim button pulse
  useEffect(() => {
    if (dailyStreak?.canClaimToday) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(claimPulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(claimPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    } else {
      claimPulse.setValue(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyStreak?.canClaimToday]);

  // Tab switch fade
  function switchTab(tab: TabName) {
    console.log('[Store] Tab switched to:', tab);
    Animated.timing(tabFade, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  }

  const loadAll = useCallback(async () => {
    console.log('[Store] Loading all store data, user:', user?.id ?? 'guest');
    setLoading(true);
    try {
      // Seed first (no-op if already seeded)
      try {
        await apiPost('/api/store/seed', {});
        console.log('[Store] Seed complete');
      } catch (e) {
        console.log('[Store] Seed skipped or failed:', e);
      }

      const storeItems = await apiGet<StoreItem[]>('/api/store/items');
      console.log('[Store] Items loaded:', storeItems.length);

      let finalItems = storeItems;
      if (finalItems.length === 0) {
        console.log('[Store] Empty catalog, re-seeding...');
        await apiPost('/api/store/seed', {});
        finalItems = await apiGet<StoreItem[]>('/api/store/items');
        console.log('[Store] Items after re-seed:', finalItems.length);
      }
      setItems(finalItems);

      if (user) {
        const [stats, purchases, equippedData, streak] = await Promise.all([
          authenticatedGet<UserStats>('/api/stats').catch((e) => { console.error('[Store] Stats error:', e); return null; }),
          authenticatedGet<{ itemId: string }[]>('/api/store/purchases').catch((e) => { console.error('[Store] Purchases error:', e); return []; }),
          authenticatedGet<EquippedSlots>('/api/store/equipped').catch((e) => { console.error('[Store] Equipped error:', e); return null; }),
          authenticatedGet<DailyStreak>('/api/store/daily-streak').catch((e) => { console.error('[Store] Streak error:', e); return null; }),
        ]);
        console.log('[Store] Stats:', stats);
        console.log('[Store] Purchases count:', (purchases as any[]).length);
        console.log('[Store] Equipped:', equippedData);
        console.log('[Store] Daily streak:', streak);
        if (stats) setUserStats(stats);
        if (purchases) setPurchasedIds(new Set((purchases as { itemId: string }[]).map((p) => p.itemId)));
        if (equippedData) setEquipped(equippedData);
        if (streak) setDailyStreak(streak);
      }
    } catch (e) {
      console.error('[Store] Load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handlePurchase(item: StoreItem) {
    console.log('[Store] handlePurchase called for:', item.id, item.name, 'currency:', item.currency_type);
    if (!user) {
      showInfo('Sign In Required', 'Sign in to purchase items from the store.');
      return;
    }
    if (item.currency_type === 'flux') {
      const balance = userStats?.totalCoins ?? 0;
      if (balance < item.price) {
        const needed = item.price - balance;
        showInfo('Not Enough Flux', `You need ${formatFlux(needed)} more Flux to buy this item.`);
        return;
      }
      try {
        setPurchasing(item.id);
        const result = await authenticatedPost('/api/store/purchase', { itemId: item.id });
        console.log('[Store] Purchase result:', result);
        setPurchasedIds((prev) => new Set([...prev, item.id]));
        setUserStats((prev) => prev ? { ...prev, totalCoins: prev.totalCoins - item.price } : null);
        setPurchaseModal({ visible: true, item });
      } catch (e: any) {
        console.error('[Store] Purchase failed:', e);
        showInfo('Purchase Failed', e?.message?.includes('already') ? 'You already own this item.' : 'Purchase failed. Please try again.');
      } finally {
        setPurchasing(null);
      }
    } else {
      // IAP — placeholder
      console.log('[Store] IAP purchase initiated for:', item.iap_product_id);
      showInfo('Coming Soon', 'In-app purchases will be available soon!');
    }
  }

  async function handleEquip(item: StoreItem) {
    console.log('[Store] handleEquip called for:', item.id, item.name, 'category:', item.category);
    if (!user) {
      showInfo('Sign In Required', 'Sign in to equip items.');
      return;
    }
    const slot = categoryToSlot(item.category);
    try {
      await authenticatedPost('/api/store/equip', { itemId: item.id, slot });
      console.log('[Store] Equip success, slot:', slot, 'item:', item.id);
      setEquipped((prev) => ({
        ...prev,
        [slot]: { item_id: item.id, item },
      }));
    } catch (e: any) {
      console.error('[Store] Equip failed:', e);
      showInfo('Equip Failed', 'Could not equip this item. Please try again.');
    }
  }

  async function handleClaimDaily() {
    console.log('[Store] Claim daily reward pressed');
    if (!user) {
      showInfo('Sign In Required', 'Sign in to claim daily rewards.');
      return;
    }
    if (!dailyStreak?.canClaimToday) return;
    try {
      setClaimingDaily(true);
      const result = await authenticatedPost<{ success: boolean; reward: { type: string; value: number; item?: StoreItem }; newStreak: number }>('/api/store/claim-daily', {});
      console.log('[Store] Daily claim result:', result);
      setDailyStreak((prev) => prev ? { ...prev, canClaimToday: false, currentStreak: result.newStreak } : null);
      if (result.reward.type === 'flux') {
        setUserStats((prev) => prev ? { ...prev, totalCoins: prev.totalCoins + result.reward.value } : null);
        showInfo('Daily Reward Claimed!', `You received ⚡ ${formatFlux(result.reward.value)} Flux!`);
      } else {
        showInfo('Daily Reward Claimed!', 'Your reward has been added to your collection!');
      }
    } catch (e: any) {
      console.error('[Store] Daily claim failed:', e);
      showInfo('Claim Failed', 'Could not claim daily reward. Please try again.');
    } finally {
      setClaimingDaily(false);
    }
  }

  function isItemEquipped(item: StoreItem): boolean {
    const slot = categoryToSlot(item.category) as keyof EquippedSlots;
    return equipped[slot]?.item_id === item.id;
  }

  // ─── Tab content ────────────────────────────────────────────────────────────
  const tabItems = items.filter((i) => {
    if (activeTab === 'Featured') return i.rarity === 'legendary' || i.rarity === 'epic';
    if (activeTab === 'Skins') return i.tab === 'skins';
    if (activeTab === 'Trails') return i.tab === 'trails';
    if (activeTab === 'Themes') return i.tab === 'themes';
    if (activeTab === 'Effects') return i.tab === 'effects';
    if (activeTab === 'Premium') return i.tab === 'premium' || i.currency_type === 'iap';
    return false;
  });

  const fluxBalance = userStats?.totalCoins ?? 0;
  const fluxDisplay = user ? formatFlux(fluxBalance) : '---';

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#050818', '#0a0f2e', '#050818']} style={StyleSheet.absoluteFill} />
        <View style={[styles.loadingWrap, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={C.cyan} />
          <Text style={styles.loadingText}>Loading Store...</Text>
        </View>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#050818', '#0a0f2e', '#050818']} style={StyleSheet.absoluteFill} />

      <PurchaseModal
        visible={purchaseModal.visible}
        item={purchaseModal.item}
        onClose={() => setPurchaseModal({ visible: false, item: null })}
        onEquip={handleEquip}
      />
      <InfoModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ visible: false, title: '', message: '' })}
      />

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.fluxBadge}>
          <Text style={styles.fluxIcon}>⚡</Text>
          <Text style={styles.fluxAmount}>{fluxDisplay}</Text>
        </View>
        <View style={styles.topBarRight}>
          <AnimPressable onPress={() => { console.log('[Store] Settings pressed'); }} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>⚙</Text>
          </AnimPressable>
          <AnimPressable onPress={() => { console.log('[Store] Restore purchases pressed'); }} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>↺</Text>
          </AnimPressable>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <AnimPressable key={tab} onPress={() => switchTab(tab)}>
                <View style={styles.tabItem}>
                  <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : styles.tabLabelInactive]}>
                    {tab}
                  </Text>
                  {isActive && (
                    <View style={styles.tabUnderline} />
                  )}
                </View>
              </AnimPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Content */}
      <Animated.View style={[{ flex: 1 }, { opacity: tabFade }]}>
        {activeTab === 'Featured' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Bundle Carousel */}
            <Text style={styles.sectionTitle}>BUNDLES</Text>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
            >
              <View style={{ paddingHorizontal: 8 }}>
                <FeaturedBundleCard
                  title="STARTER PACK"
                  badge="BEST VALUE"
                  badgeColor={C.gold}
                  contents={['Singularity Core skin', 'RGB Spectrum Trail', '2000 Flux']}
                  price="$3.99"
                  btnLabel="GET STARTER PACK"
                  gradFrom="#1a0533"
                  gradTo="#0d1f4a"
                  btnGradFrom="#f59e0b"
                  btnGradTo="#d97706"
                  onPress={() => showInfo('Coming Soon', 'Bundle purchases will be available soon!')}
                />
              </View>
              <View style={{ paddingHorizontal: 8 }}>
                <FeaturedBundleCard
                  title="PREMIUM BUNDLE"
                  badge="MOST POPULAR"
                  badgeColor={C.purple}
                  contents={['Celestial Reactor skin', 'Plasma Storm Trail', 'Deep Space Theme', '5000 Flux']}
                  price="$7.99"
                  btnLabel="GET PREMIUM BUNDLE"
                  gradFrom="#0d1f4a"
                  gradTo="#1a0533"
                  btnGradFrom="#a855f7"
                  btnGradTo="#7c3aed"
                  onPress={() => showInfo('Coming Soon', 'Bundle purchases will be available soon!')}
                />
              </View>
            </ScrollView>

            {/* Featured Items Grid */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>FEATURED ITEMS</Text>
            {tabItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>✦</Text>
                <Text style={styles.emptyStateText}>No featured items yet</Text>
                <Text style={styles.emptyStateSubtext}>Check back soon for legendary drops</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {tabItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isOwned={purchasedIds.has(item.id)}
                    isEquipped={isItemEquipped(item)}
                    onPurchase={handlePurchase}
                    onEquip={handleEquip}
                    purchasing={purchasing === item.id}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {(activeTab === 'Skins' || activeTab === 'Trails' || activeTab === 'Themes' || activeTab === 'Effects') && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>{activeTab.toUpperCase()}</Text>
            {tabItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>✦</Text>
                <Text style={styles.emptyStateText}>No {activeTab.toLowerCase()} yet</Text>
                <Text style={styles.emptyStateSubtext}>New items drop regularly</Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {tabItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isOwned={purchasedIds.has(item.id)}
                    isEquipped={isItemEquipped(item)}
                    onPurchase={handlePurchase}
                    onEquip={handleEquip}
                    purchasing={purchasing === item.id}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {activeTab === 'Premium' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>FLUX PACKS</Text>
            <Text style={styles.sectionSubtitle}>Top up your Flux balance</Text>
            {tabItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>⚡</Text>
                <Text style={styles.emptyStateText}>No packs available</Text>
                <Text style={styles.emptyStateSubtext}>Check back soon</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {tabItems.map((item) => (
                  <FluxPackCard
                    key={item.id}
                    item={item}
                    onPurchase={handlePurchase}
                    purchasing={purchasing === item.id}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {activeTab === 'Daily' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Daily Reward Panel */}
            <View style={styles.dailyCard}>
              <LinearGradient colors={['#0a1a3a', '#050818']} style={StyleSheet.absoluteFill} />
              <View style={styles.dailyCardBorder} />
              <Text style={styles.dailyTitle}>DAILY REWARD</Text>
              {!user ? (
                <View style={styles.dailySignIn}>
                  <Text style={styles.dailySignInText}>Sign in to claim daily rewards</Text>
                </View>
              ) : (
                <>
                  <DailyStreakDots
                    streak={dailyStreak?.currentStreak ?? 0}
                    canClaim={dailyStreak?.canClaimToday ?? false}
                  />
                  <View style={styles.dailyStreakRow}>
                    <Text style={styles.dailyStreakNum}>{dailyStreak?.currentStreak ?? 0}</Text>
                    <Text style={styles.dailyStreakLabel}>DAY STREAK</Text>
                  </View>
                  {dailyStreak?.nextReward && (
                    <View style={styles.dailyRewardPreview}>
                      <Text style={styles.dailyRewardIcon}>⚡</Text>
                      <Text style={styles.dailyRewardValue}>
                        {formatFlux(dailyStreak.nextReward.value)}
                      </Text>
                      <Text style={styles.dailyRewardType}>FLUX</Text>
                    </View>
                  )}
                  <Animated.View style={{ transform: [{ scale: claimPulse }] }}>
                    <AnimPressable
                      onPress={handleClaimDaily}
                      disabled={!dailyStreak?.canClaimToday || claimingDaily}
                    >
                      <LinearGradient
                        colors={dailyStreak?.canClaimToday ? [C.cyan, '#0099cc'] : ['#1a2a3a', '#0d1a2a']}
                        style={[styles.claimBtn, !dailyStreak?.canClaimToday && { opacity: 0.5 }]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        {claimingDaily ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <Text style={[styles.claimBtnText, !dailyStreak?.canClaimToday && { color: C.whiteFaded }]}>
                            {dailyStreak?.canClaimToday ? 'CLAIM REWARD' : 'ALREADY CLAIMED'}
                          </Text>
                        )}
                      </LinearGradient>
                    </AnimPressable>
                  </Animated.View>
                </>
              )}
            </View>

            {/* Daily Discount */}
            {items.length > 0 && (() => {
              const discountItem = items[Math.floor(items.length / 2)];
              const discountPct = 30;
              const discountedPrice = Math.floor(discountItem.price * (1 - discountPct / 100));
              const discountedDisplay = discountItem.currency_type === 'iap'
                ? `$${(discountedPrice / 100).toFixed(2)}`
                : `⚡ ${formatFlux(discountedPrice)}`;
              const originalDisplay = discountItem.currency_type === 'iap'
                ? (discountItem.price_display || `$${(discountItem.price / 100).toFixed(2)}`)
                : `⚡ ${formatFlux(discountItem.price)}`;
              return (
                <View style={styles.discountCard}>
                  <LinearGradient colors={['#1a0533', '#0a0f2e']} style={StyleSheet.absoluteFill} />
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
                  </View>
                  <Text style={styles.discountLabel}>DAILY DEAL</Text>
                  <View style={styles.discountRow}>
                    <Text style={{ fontSize: 36 }}>{discountItem.icon || '✦'}</Text>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.discountItemName}>{discountItem.name.toUpperCase()}</Text>
                      <RarityBadge rarity={discountItem.rarity} />
                    </View>
                    <View style={styles.discountPriceCol}>
                      <Text style={styles.discountOldPrice}>{originalDisplay}</Text>
                      <Text style={styles.discountNewPrice}>{discountedDisplay}</Text>
                    </View>
                  </View>
                  <Text style={styles.discountRefresh}>Refreshes in 12h 00m</Text>
                </View>
              );
            })()}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050818',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: C.cyan,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 2,
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,245,255,0.15)',
    backgroundColor: 'rgba(5,8,24,0.9)',
  },
  fluxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,245,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.3)',
    gap: 6,
  },
  fluxIcon: {
    fontSize: 16,
    color: C.gold,
  },
  fluxAmount: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtnText: {
    color: C.white,
    fontSize: 18,
  },

  // Tab Bar
  tabBarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(5,8,24,0.8)',
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  tabItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: C.white,
  },
  tabLabelInactive: {
    color: C.whiteFaded,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: C.cyan,
    borderRadius: 1,
    shadowColor: C.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // Scroll content
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
    opacity: 0.7,
  },
  sectionSubtitle: {
    color: C.whiteFaded,
    fontSize: 13,
    marginBottom: 16,
    marginTop: -8,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Item Card
  itemCard: {
    width: CARD_WIDTH,
    height: 200,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    overflow: 'hidden',
  },
  previewArea: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCardMid: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  itemCardName: {
    color: C.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rarityBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemCardBottom: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  itemCardBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCardBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Flux Pack Card
  fluxPackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: `${C.gold}44`,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  fluxPackLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fluxPackName: {
    color: C.white,
    fontSize: 15,
    fontWeight: '700',
  },
  fluxPackDesc: {
    color: C.whiteFaded,
    fontSize: 12,
    marginTop: 2,
  },
  fluxPackRight: {
    alignItems: 'center',
    marginRight: 12,
  },
  fluxPackAmount: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '800',
  },
  fluxPackFluxLabel: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.7,
  },
  fluxPackBtn: {
    backgroundColor: C.gold,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  fluxPackBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
  },

  // Featured Card
  featuredCard: {
    height: SCREEN_HEIGHT * 0.48,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 24,
    justifyContent: 'flex-end',
  },
  featuredCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  featuredBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  featuredTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  featuredContents: {
    gap: 6,
    marginBottom: 20,
  },
  featuredContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featuredContentDot: {
    fontSize: 10,
  },
  featuredContentText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  featuredBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredPrice: {
    color: C.white,
    fontSize: 28,
    fontWeight: '800',
  },
  featuredBtn: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  featuredBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Daily
  dailyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${C.cyan}44`,
  },
  dailyCardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${C.cyan}33`,
  },
  dailyTitle: {
    color: C.cyan,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 20,
  },
  dailySignIn: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  dailySignInText: {
    color: C.whiteFaded,
    fontSize: 15,
    textAlign: 'center',
  },
  streakDots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  streakDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakDotNum: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
  },
  dailyStreakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  dailyStreakNum: {
    color: C.gold,
    fontSize: 48,
    fontWeight: '800',
  },
  dailyStreakLabel: {
    color: C.whiteFaded,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dailyRewardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.2)',
  },
  dailyRewardIcon: {
    fontSize: 24,
  },
  dailyRewardValue: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '800',
  },
  dailyRewardType: {
    color: C.whiteFaded,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  claimBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Discount Card
  discountCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    borderWidth: 1,
    borderColor: `${C.purple}44`,
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: C.purple,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadgeText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '800',
  },
  discountLabel: {
    color: C.purple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 16,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  discountItemName: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  discountPriceCol: {
    alignItems: 'flex-end',
  },
  discountOldPrice: {
    color: C.whiteFaded,
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  discountNewPrice: {
    color: C.cyan,
    fontSize: 18,
    fontWeight: '800',
  },
  discountRefresh: {
    color: C.whiteFaded,
    fontSize: 12,
    textAlign: 'right',
  },

  // Purchase Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  purchaseModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  purchaseModalBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: `${C.cyan}66`,
  },
  purchaseCheck: {
    color: C.cyan,
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 4,
  },
  purchaseComplete: {
    color: C.cyan,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  purchaseItemName: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  purchaseModalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  purchaseEquipBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  purchaseEquipBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  purchaseCloseBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  purchaseCloseBtnText: {
    color: C.whiteFaded,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Info Modal
  infoModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  infoModalBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  infoModalTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoModalMessage: {
    color: C.whiteFaded,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  infoModalBtn: {
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  infoModalBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyStateIcon: {
    fontSize: 40,
    color: C.whiteFaded,
    marginBottom: 8,
  },
  emptyStateText: {
    color: C.white,
    fontSize: 17,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    color: C.whiteFaded,
    fontSize: 14,
  },
});
