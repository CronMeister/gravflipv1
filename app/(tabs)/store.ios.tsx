
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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@react-navigation/native';
import { GlassView } from 'expo-glass-effect';
import { IconSymbol } from '@/components/IconSymbol';
import { apiGet, apiPost, authenticatedGet, authenticatedPost } from '@/utils/api';
import { useAuth } from '@/contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

// ─── Rarity colors (toned-down, design-system aligned) ───────────────────────
const RARITY_COLOR: Record<string, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

const RARITY_LABEL: Record<string, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  priceDisplay: string | null;
  icon: string;
  category: string;
  tab: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  currencyType: 'flux' | 'iap';
  iapProductId: string | null;
  sortOrder: number;
}

interface UserStats {
  totalCoins: number;
  highScore: number;
  weeklyScore: number;
}

interface EquippedSlots {
  skin: { itemId: string; item: StoreItem } | null;
  trail: { itemId: string; item: StoreItem } | null;
  theme: { itemId: string; item: StoreItem } | null;
  gravity_effect: { itemId: string; item: StoreItem } | null;
  death_effect: { itemId: string; item: StoreItem } | null;
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

function categoryToSlot(category: string): string {
  if (category === 'effect') return 'gravity_effect';
  return category;
}

function formatFlux(n: number): string {
  return Number(n).toLocaleString();
}

// ─── Theme palette for ThemePreview ──────────────────────────────────────────
function getThemePalette(name: string): [string, string] {
  const lower = name.toLowerCase();
  if (lower.includes('retro') || lower.includes('neon')) return ['#ff00ff', '#00ffff'];
  if (lower.includes('cyber') || lower.includes('grid')) return ['#00ff41', '#0d0d0d'];
  if (lower.includes('matrix')) return ['#00ff41', '#003300'];
  if (lower.includes('deep') || lower.includes('space')) return ['#0a0a2e', '#6600cc'];
  if (lower.includes('solar') || lower.includes('storm')) return ['#ff6600', '#cc0000'];
  if (lower.includes('vapor') || lower.includes('wave')) return ['#ff71ce', '#b967ff'];
  if (lower.includes('ocean') || lower.includes('aqua')) return ['#006994', '#00d4ff'];
  if (lower.includes('forest') || lower.includes('nature')) return ['#228b22', '#8b4513'];
  if (lower.includes('fire') || lower.includes('lava')) return ['#ff4500', '#8b0000'];
  if (lower.includes('ice') || lower.includes('frost')) return ['#87ceeb', '#4169e1'];
  return ['#1e293b', '#475569'];
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
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: color,
        borderStyle: 'dashed',
        transform: [{ rotate }],
        opacity: 0.5,
      }}
    />
  );
}

// ─── Category-specific preview components ────────────────────────────────────

function SkinPreview({ item }: { item: StoreItem }) {
  const color = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const isLegendary = item.rarity === 'legendary';
  return (
    <View style={previewStyles.container}>
      {isLegendary && <LegendaryRotator color={color} />}
      <View style={[previewStyles.skinCircle, { backgroundColor: color }]}>
        <View style={previewStyles.skinSheen} />
      </View>
    </View>
  );
}

function TrailPreview({ item }: { item: StoreItem }) {
  const color = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const dots = [
    { size: 8, opacity: 0.2 },
    { size: 10, opacity: 0.35 },
    { size: 12, opacity: 0.55 },
    { size: 14, opacity: 0.75 },
    { size: 16, opacity: 1.0 },
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
        <View style={[previewStyles.trailPlayer, { backgroundColor: color }]}>
          <View style={previewStyles.skinSheen} />
        </View>
      </View>
    </View>
  );
}

function ThemePreview({ item }: { item: StoreItem }) {
  const [bgColor, obstacleColor] = getThemePalette(item.name);
  return (
    <View style={previewStyles.container}>
      <View style={[previewStyles.themeScene, { backgroundColor: bgColor }]}>
        <View style={[previewStyles.themeObstacleLeft, { backgroundColor: obstacleColor }]} />
        <View style={[previewStyles.themeObstacleRight, { backgroundColor: obstacleColor }]} />
        <View style={[previewStyles.themePlayer, { backgroundColor: '#f59e0b' }]} />
      </View>
    </View>
  );
}

function EffectPreview({ item }: { item: StoreItem }) {
  const color = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  return (
    <View style={previewStyles.container}>
      <View style={[previewStyles.effectRing3, { borderColor: color, opacity: 0.15 }]} />
      <View style={[previewStyles.effectRing2, { borderColor: color, opacity: 0.3 }]} />
      <View style={[previewStyles.effectRing1, { borderColor: color, opacity: 0.6 }]} />
      <View style={[previewStyles.effectCore, { backgroundColor: color }]} />
    </View>
  );
}

function FluxPackPreview({ item }: { item: StoreItem }) {
  const boltCount = item.price <= 100 ? 1 : item.price <= 500 ? 2 : item.price <= 2000 ? 3 : 4;
  const bolts = Array.from({ length: boltCount });
  return (
    <View style={previewStyles.container}>
      <View style={previewStyles.fluxBolts}>
        {bolts.map((_, i) => (
          <IconSymbol
            key={i}
            ios_icon_name="bolt.fill"
            android_material_icon_name="flash_on"
            size={20 + i * 4}
            color="#f59e0b"
          />
        ))}
      </View>
    </View>
  );
}

function ItemPreviewComponent({ item }: { item: StoreItem }) {
  if (item.tab === 'skins') return <SkinPreview item={item} />;
  if (item.tab === 'trails') return <TrailPreview item={item} />;
  if (item.tab === 'themes') return <ThemePreview item={item} />;
  if (item.tab === 'effects') return <EffectPreview item={item} />;
  if (item.tab === 'premium') return <FluxPackPreview item={item} />;
  // Fallback for featured tab — pick by category
  if (item.category === 'skin') return <SkinPreview item={item} />;
  if (item.category === 'trail') return <TrailPreview item={item} />;
  if (item.category === 'theme') return <ThemePreview item={item} />;
  if (item.category === 'effect') return <EffectPreview item={item} />;
  return (
    <View style={previewStyles.container}>
      <IconSymbol
        ios_icon_name="sparkles"
        android_material_icon_name="auto_awesome"
        size={36}
        color={RARITY_COLOR[item.rarity] || RARITY_COLOR.common}
      />
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  skinSheen: {
    position: 'absolute',
    top: 4,
    left: 6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trailDot: {},
  trailPlayer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 4,
  },
  themeScene: {
    width: 80,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeObstacleLeft: {
    position: 'absolute',
    left: 20,
    top: 0,
    width: 10,
    height: 18,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  themeObstacleRight: {
    position: 'absolute',
    left: 20,
    bottom: 0,
    width: 10,
    height: 18,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  themePlayer: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    left: 10,
  },
  effectRing3: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
  },
  effectRing2: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
  },
  effectRing1: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  effectCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fluxBolts: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
});

// ─── Rarity Badge ─────────────────────────────────────────────────────────────
function RarityBadge({ rarity, textColor }: { rarity: string; textColor: string }) {
  const color = RARITY_COLOR[rarity] || RARITY_COLOR.common;
  return (
    <View style={badgeStyles.row}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <Text style={[badgeStyles.text, { color: textColor }]}>{RARITY_LABEL[rarity] || rarity.toUpperCase()}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ─── Item Card ────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  isOwned,
  isEquipped,
  onPurchase,
  onEquip,
  purchasing,
  theme,
}: {
  item: StoreItem;
  isOwned: boolean;
  isEquipped: boolean;
  onPurchase: (item: StoreItem) => void;
  onEquip: (item: StoreItem) => void;
  purchasing: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const textColor = theme.dark ? '#ffffff' : '#000000';
  const secondaryColor = theme.dark ? '#98989D' : '#666666';
  const isIAP = item.currencyType === 'iap';
  const priceLabel = isIAP
    ? (item.priceDisplay || `$${(Number(item.price) / 100).toFixed(2)}`)
    : `${formatFlux(item.price)} Flux`;

  const btnLabel = isEquipped ? 'EQUIPPED' : isOwned ? 'EQUIP' : priceLabel;

  const btnBg = isEquipped
    ? theme.colors.primary
    : isOwned
    ? (theme.dark ? '#1e293b' : '#f1f5f9')
    : theme.colors.primary;

  const btnTextColor = isOwned && !isEquipped ? textColor : '#ffffff';

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
    <AnimPressable onPress={handleBtn} disabled={isEquipped || purchasing} scaleValue={0.97}>
      <GlassView
        style={[
          cardStyles.card,
          Platform.OS !== 'ios' && {
            backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          },
        ]}
        glassEffectStyle="regular"
      >
        <ItemPreviewComponent item={item} />
        <View style={cardStyles.info}>
          <Text style={[cardStyles.name, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
          <RarityBadge rarity={item.rarity} textColor={secondaryColor} />
        </View>
        <View style={cardStyles.btnWrap}>
          <View style={[cardStyles.btn, { backgroundColor: btnBg }]}>
            {purchasing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : isEquipped ? (
              <View style={cardStyles.btnInner}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check_circle"
                  size={14}
                  color="#ffffff"
                />
                <Text style={[cardStyles.btnText, { color: '#ffffff' }]}>{btnLabel}</Text>
              </View>
            ) : isOwned ? (
              <View style={cardStyles.btnInner}>
                <IconSymbol
                  ios_icon_name="checkmark.circle"
                  android_material_icon_name="check_circle_outline"
                  size={14}
                  color={btnTextColor}
                />
                <Text style={[cardStyles.btnText, { color: btnTextColor }]}>{btnLabel}</Text>
              </View>
            ) : (
              <Text style={[cardStyles.btnText, { color: btnTextColor }]}>{btnLabel}</Text>
            )}
          </View>
        </View>
      </GlassView>
    </AnimPressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
  },
  info: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  btnWrap: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

// ─── Flux Pack Card ───────────────────────────────────────────────────────────
function FluxPackCard({
  item,
  onPurchase,
  purchasing,
  theme,
}: {
  item: StoreItem;
  onPurchase: (item: StoreItem) => void;
  purchasing: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const textColor = theme.dark ? '#ffffff' : '#000000';
  const secondaryColor = theme.dark ? '#98989D' : '#666666';
  const priceLabel = item.priceDisplay || `$${(Number(item.price) / 100).toFixed(2)}`;
  const fluxMatch = item.name.match(/\d[\d,]*/);
  const fluxAmount = fluxMatch ? fluxMatch[0] : '???';

  function handlePress() {
    console.log('[Store] Flux pack purchase pressed:', item.id, item.name);
    onPurchase(item);
  }

  return (
    <AnimPressable onPress={handlePress} disabled={purchasing}>
      <GlassView
        style={[
          packStyles.card,
          Platform.OS !== 'ios' && {
            backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          },
        ]}
        glassEffectStyle="regular"
      >
        <View style={packStyles.preview}>
          <FluxPackPreview item={item} />
        </View>
        <View style={packStyles.middle}>
          <Text style={[packStyles.name, { color: textColor }]}>{item.name}</Text>
          <View style={packStyles.amountRow}>
            <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="flash_on" size={14} color="#f59e0b" />
            <Text style={packStyles.amount}>{fluxAmount}</Text>
            <Text style={[packStyles.fluxLabel, { color: secondaryColor }]}>FLUX</Text>
          </View>
          <Text style={[packStyles.desc, { color: secondaryColor }]} numberOfLines={1}>{item.description}</Text>
        </View>
        <View style={packStyles.right}>
          <View style={[packStyles.btn, { backgroundColor: theme.colors.primary }]}>
            {purchasing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={packStyles.btnText}>{priceLabel}</Text>
            )}
          </View>
        </View>
      </GlassView>
    </AnimPressable>
  );
}

const packStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    gap: 12,
  },
  preview: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  middle: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '700',
  },
  fluxLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  desc: {
    fontSize: 13,
  },
  right: {
    alignItems: 'center',
  },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

// ─── Featured Bundle Card ─────────────────────────────────────────────────────
function FeaturedBundleCard({
  title,
  badge,
  badgeColor,
  contents,
  price,
  btnLabel,
  onPress,
  theme,
}: {
  title: string;
  badge: string;
  badgeColor: string;
  contents: string[];
  price: string;
  btnLabel: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const textColor = theme.dark ? '#ffffff' : '#000000';
  const secondaryColor = theme.dark ? '#98989D' : '#666666';

  function handlePress() {
    console.log('[Store] Featured bundle pressed:', title);
    onPress();
  }

  return (
    <AnimPressable onPress={handlePress} scaleValue={0.98}>
      <GlassView
        style={[
          bundleStyles.card,
          Platform.OS !== 'ios' && {
            backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          },
        ]}
        glassEffectStyle="regular"
      >
        <View style={[bundleStyles.badgeWrap, { backgroundColor: `${badgeColor}22` }]}>
          <Text style={[bundleStyles.badgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
        <Text style={[bundleStyles.title, { color: textColor }]}>{title}</Text>
        <View style={bundleStyles.contents}>
          {contents.map((c, i) => (
            <View key={i} style={bundleStyles.contentRow}>
              <IconSymbol
                ios_icon_name="checkmark.circle.fill"
                android_material_icon_name="check_circle"
                size={14}
                color={badgeColor}
              />
              <Text style={[bundleStyles.contentText, { color: secondaryColor }]}>{c}</Text>
            </View>
          ))}
        </View>
        <View style={bundleStyles.bottom}>
          <Text style={[bundleStyles.price, { color: textColor }]}>{price}</Text>
          <View style={[bundleStyles.btn, { backgroundColor: theme.colors.primary }]}>
            <Text style={bundleStyles.btnText}>{btnLabel}</Text>
          </View>
        </View>
      </GlassView>
    </AnimPressable>
  );
}

const bundleStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 20,
    marginBottom: 12,
  },
  badgeWrap: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  contents: {
    gap: 8,
    marginBottom: 20,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contentText: {
    fontSize: 15,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  price: {
    fontSize: 26,
    fontWeight: '700',
  },
  btn: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

// ─── Daily Streak Dots ────────────────────────────────────────────────────────
function DailyStreakDots({
  streak,
  canClaim,
  theme,
}: {
  streak: number;
  canClaim: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  const dots = Array.from({ length: 7 }, (_, i) => i);
  const mutedColor = theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const mutedTextColor = theme.dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
  const textColor = theme.dark ? '#ffffff' : '#000000';
  return (
    <View style={dotStyles.row}>
      {dots.map((i) => {
        const claimed = i < streak;
        const isCurrent = i === streak && canClaim;
        const dotBg = claimed
          ? theme.colors.primary
          : isCurrent
          ? 'transparent'
          : mutedColor;
        const borderColor = isCurrent ? theme.colors.primary : 'transparent';
        const numColor = claimed ? '#ffffff' : isCurrent ? theme.colors.primary : mutedTextColor;
        return (
          <View
            key={i}
            style={[
              dotStyles.dot,
              {
                backgroundColor: dotBg,
                borderColor,
                borderWidth: isCurrent ? 2 : 0,
              },
            ]}
          >
            {claimed ? (
              <IconSymbol
                ios_icon_name="checkmark"
                android_material_icon_name="check"
                size={12}
                color="#ffffff"
              />
            ) : (
              <Text style={[dotStyles.num, { color: numColor }]}>{i + 1}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  num: {
    fontSize: 12,
    fontWeight: '700',
  },
});

// ─── Purchase Success Modal ───────────────────────────────────────────────────
function PurchaseModal({
  visible,
  item,
  onClose,
  onEquip,
  theme,
}: {
  visible: boolean;
  item: StoreItem | null;
  onClose: () => void;
  onEquip: (item: StoreItem) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textColor = theme.dark ? '#ffffff' : '#000000';
  const secondaryColor = theme.dark ? '#98989D' : '#666666';

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
      <View style={modalStyles.overlay}>
        <Animated.View style={[{ transform: [{ scale }], opacity }]}>
          <GlassView
            style={[
              modalStyles.purchaseCard,
              Platform.OS !== 'ios' && {
                backgroundColor: theme.dark ? 'rgba(20,20,30,0.95)' : 'rgba(255,255,255,0.95)',
              },
            ]}
            glassEffectStyle="regular"
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check_circle"
              size={56}
              color={theme.colors.primary}
            />
            <Text style={[modalStyles.purchaseTitle, { color: textColor }]}>Purchase Complete</Text>
            <Text style={[modalStyles.purchaseItemName, { color: theme.colors.primary }]}>{item.name} Unlocked</Text>
            <View style={modalStyles.purchaseBtns}>
              <AnimPressable onPress={handleEquip} style={{ flex: 1 }}>
                <View style={[modalStyles.equipBtn, { backgroundColor: theme.colors.primary }]}>
                  <Text style={modalStyles.equipBtnText}>Equip Now</Text>
                </View>
              </AnimPressable>
              <AnimPressable onPress={handleClose} style={{ flex: 1 }}>
                <View
                  style={[
                    modalStyles.closeBtn,
                    { backgroundColor: theme.dark ? '#1e293b' : '#f1f5f9' },
                  ]}
                >
                  <Text style={[modalStyles.closeBtnText, { color: textColor }]}>Close</Text>
                </View>
              </AnimPressable>
            </View>
          </GlassView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Info Modal ───────────────────────────────────────────────────────────────
function InfoModal({
  visible,
  title,
  message,
  onClose,
  theme,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const textColor = theme.dark ? '#ffffff' : '#000000';
  const secondaryColor = theme.dark ? '#98989D' : '#666666';

  function handleClose() {
    console.log('[Store] Info modal closed:', title);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <GlassView
          style={[
            modalStyles.infoCard,
            Platform.OS !== 'ios' && {
              backgroundColor: theme.dark ? 'rgba(20,20,30,0.95)' : 'rgba(255,255,255,0.95)',
            },
          ]}
          glassEffectStyle="regular"
        >
          <Text style={[modalStyles.infoTitle, { color: textColor }]}>{title}</Text>
          <Text style={[modalStyles.infoMessage, { color: secondaryColor }]}>{message}</Text>
          <AnimPressable onPress={handleClose}>
            <View style={[modalStyles.infoBtn, { backgroundColor: theme.colors.primary }]}>
              <Text style={modalStyles.infoBtnText}>OK</Text>
            </View>
          </AnimPressable>
        </GlassView>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  purchaseCard: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  purchaseTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },
  purchaseItemName: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  purchaseBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  equipBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  equipBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  closeBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoCard: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 360,
    borderRadius: 20,
    overflow: 'hidden',
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  infoBtn: {
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  infoBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function StoreScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const textColor = theme.dark ? '#ffffff' : '#000000';
  const secondaryColor = theme.dark ? '#98989D' : '#666666';

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
    console.log('[Store] handlePurchase called for:', item.id, item.name, 'currency:', item.currencyType);
    if (!user) {
      showInfo('Sign In Required', 'Sign in to purchase items from the store.');
      return;
    }
    if (item.currencyType === 'flux') {
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
      console.log('[Store] IAP purchase initiated for:', item.iapProductId);
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
        [slot]: { itemId: item.id, item },
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
        showInfo('Daily Reward Claimed!', `You received ${formatFlux(result.reward.value)} Flux!`);
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
    return equipped[slot]?.itemId === item.id;
  }

  // ─── Tab content ────────────────────────────────────────────────────────────
  const tabItems = items.filter((i) => {
    if (activeTab === 'Featured') return i.rarity === 'legendary' || i.rarity === 'epic';
    if (activeTab === 'Skins') return i.tab === 'skins';
    if (activeTab === 'Trails') return i.tab === 'trails';
    if (activeTab === 'Themes') return i.tab === 'themes';
    if (activeTab === 'Effects') return i.tab === 'effects';
    if (activeTab === 'Premium') return i.tab === 'premium' || i.currencyType === 'iap';
    return false;
  });

  const fluxBalance = userStats?.totalCoins ?? 0;
  const fluxDisplay = user ? formatFlux(fluxBalance) : '---';

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: secondaryColor }]}>Loading Store...</Text>
        </View>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <PurchaseModal
        visible={purchaseModal.visible}
        item={purchaseModal.item}
        onClose={() => setPurchaseModal({ visible: false, item: null })}
        onEquip={handleEquip}
        theme={theme}
      />
      <InfoModal
        visible={infoModal.visible}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ visible: false, title: '', message: '' })}
        theme={theme}
      />

      {/* Top Bar */}
      <GlassView
        style={[
          styles.topBar,
          { paddingTop: insets.top + 8 },
          Platform.OS !== 'ios' && {
            backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          },
        ]}
        glassEffectStyle="regular"
      >
        <View style={styles.fluxPill}>
          <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="flash_on" size={16} color="#f59e0b" />
          <Text style={[styles.fluxAmount, { color: textColor }]}>{fluxDisplay}</Text>
        </View>
        <Text style={[styles.storeTitle, { color: textColor }]}>Store</Text>
        <View style={styles.topBarRight}>
          <AnimPressable onPress={() => { console.log('[Store] Settings pressed'); }}>
            <View style={[styles.iconBtn, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <IconSymbol ios_icon_name="gearshape.fill" android_material_icon_name="settings" size={18} color={secondaryColor} />
            </View>
          </AnimPressable>
          <AnimPressable onPress={() => { console.log('[Store] Restore purchases pressed'); }}>
            <View style={[styles.iconBtn, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
              <IconSymbol ios_icon_name="arrow.clockwise" android_material_icon_name="restore" size={18} color={secondaryColor} />
            </View>
          </AnimPressable>
        </View>
      </GlassView>

      {/* Tab Bar */}
      <View style={[styles.tabBarWrap, { borderBottomColor: theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
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
                  <Text
                    style={[
                      styles.tabLabel,
                      isActive
                        ? [styles.tabLabelActive, { color: textColor }]
                        : [styles.tabLabelInactive, { color: secondaryColor }],
                    ]}
                  >
                    {tab}
                  </Text>
                  {isActive && (
                    <View style={[styles.tabUnderline, { backgroundColor: theme.colors.primary }]} />
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
            {/* Bundles */}
            <Text style={[styles.sectionLabel, { color: secondaryColor }]}>BUNDLES</Text>
            <FeaturedBundleCard
              title="Starter Pack"
              badge="BEST VALUE"
              badgeColor="#f59e0b"
              contents={['Singularity Core skin', 'RGB Spectrum Trail', '2,000 Flux']}
              price="$3.99"
              btnLabel="Get Starter Pack"
              onPress={() => showInfo('Coming Soon', 'Bundle purchases will be available soon!')}
              theme={theme}
            />
            <FeaturedBundleCard
              title="Premium Bundle"
              badge="MOST POPULAR"
              badgeColor="#a855f7"
              contents={['Celestial Reactor skin', 'Plasma Storm Trail', 'Deep Space Theme', '5,000 Flux']}
              price="$7.99"
              btnLabel="Get Premium Bundle"
              onPress={() => showInfo('Coming Soon', 'Bundle purchases will be available soon!')}
              theme={theme}
            />

            {/* Featured Items Grid */}
            <Text style={[styles.sectionLabel, { color: secondaryColor, marginTop: 8 }]}>FEATURED ITEMS</Text>
            {tabItems.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol ios_icon_name="sparkles" android_material_icon_name="auto_awesome" size={40} color={secondaryColor} />
                <Text style={[styles.emptyText, { color: textColor }]}>No featured items yet</Text>
                <Text style={[styles.emptySubtext, { color: secondaryColor }]}>Check back soon for legendary drops</Text>
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
                    theme={theme}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {(activeTab === 'Skins' || activeTab === 'Trails' || activeTab === 'Themes' || activeTab === 'Effects') && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: secondaryColor }]}>{activeTab.toUpperCase()}</Text>
            {tabItems.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol ios_icon_name="sparkles" android_material_icon_name="auto_awesome" size={40} color={secondaryColor} />
                <Text style={[styles.emptyText, { color: textColor }]}>No {activeTab.toLowerCase()} yet</Text>
                <Text style={[styles.emptySubtext, { color: secondaryColor }]}>New items drop regularly</Text>
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
                    theme={theme}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {activeTab === 'Premium' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: secondaryColor }]}>FLUX PACKS</Text>
            <Text style={[styles.sectionSubtitle, { color: secondaryColor }]}>Top up your Flux balance</Text>
            {tabItems.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="flash_on" size={40} color={secondaryColor} />
                <Text style={[styles.emptyText, { color: textColor }]}>No packs available</Text>
                <Text style={[styles.emptySubtext, { color: secondaryColor }]}>Check back soon</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {tabItems.map((item) => (
                  <FluxPackCard
                    key={item.id}
                    item={item}
                    onPurchase={handlePurchase}
                    purchasing={purchasing === item.id}
                    theme={theme}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {activeTab === 'Daily' && (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Daily Reward Panel */}
            <GlassView
              style={[
                styles.dailyCard,
                Platform.OS !== 'ios' && {
                  backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                },
              ]}
              glassEffectStyle="regular"
            >
              <View style={styles.dailyTitleRow}>
                <IconSymbol ios_icon_name="gift.fill" android_material_icon_name="card_giftcard" size={20} color={theme.colors.primary} />
                <Text style={[styles.dailyTitle, { color: textColor }]}>Daily Reward</Text>
              </View>

              {!user ? (
                <View style={styles.dailySignIn}>
                  <Text style={[styles.dailySignInText, { color: secondaryColor }]}>Sign in to claim daily rewards</Text>
                </View>
              ) : (
                <>
                  <DailyStreakDots
                    streak={dailyStreak?.currentStreak ?? 0}
                    canClaim={dailyStreak?.canClaimToday ?? false}
                    theme={theme}
                  />
                  <View style={styles.dailyStreakRow}>
                    <Text style={[styles.dailyStreakNum, { color: theme.colors.primary }]}>{dailyStreak?.currentStreak ?? 0}</Text>
                    <Text style={[styles.dailyStreakLabel, { color: secondaryColor }]}>DAY STREAK</Text>
                  </View>
                  {dailyStreak?.nextReward && (
                    <View style={[styles.dailyRewardPreview, { backgroundColor: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                      <IconSymbol ios_icon_name="bolt.fill" android_material_icon_name="flash_on" size={20} color="#f59e0b" />
                      <Text style={styles.dailyRewardValue}>{formatFlux(dailyStreak.nextReward.value)}</Text>
                      <Text style={[styles.dailyRewardType, { color: secondaryColor }]}>FLUX</Text>
                    </View>
                  )}
                  <Animated.View style={{ transform: [{ scale: claimPulse }] }}>
                    <AnimPressable
                      onPress={handleClaimDaily}
                      disabled={!dailyStreak?.canClaimToday || claimingDaily}
                    >
                      <View
                        style={[
                          styles.claimBtn,
                          {
                            backgroundColor: dailyStreak?.canClaimToday
                              ? theme.colors.primary
                              : (theme.dark ? '#1e293b' : '#e2e8f0'),
                            opacity: dailyStreak?.canClaimToday ? 1 : 0.6,
                          },
                        ]}
                      >
                        {claimingDaily ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[styles.claimBtnText, { color: dailyStreak?.canClaimToday ? '#ffffff' : secondaryColor }]}>
                            {dailyStreak?.canClaimToday ? 'Claim Reward' : 'Already Claimed'}
                          </Text>
                        )}
                      </View>
                    </AnimPressable>
                  </Animated.View>
                </>
              )}
            </GlassView>

            {/* Daily Discount */}
            {items.length > 0 && (() => {
              const discountItem = items[Math.floor(items.length / 2)];
              const discountPct = 30;
              const discountedPrice = Math.floor(discountItem.price * (1 - discountPct / 100));
              const discountedDisplay = discountItem.currencyType === 'iap'
                ? `$${(discountedPrice / 100).toFixed(2)}`
                : `${formatFlux(discountedPrice)} Flux`;
              const originalDisplay = discountItem.currencyType === 'iap'
                ? (discountItem.priceDisplay || `$${(Number(discountItem.price) / 100).toFixed(2)}`)
                : `${formatFlux(discountItem.price)} Flux`;
              return (
                <GlassView
                  style={[
                    styles.discountCard,
                    Platform.OS !== 'ios' && {
                      backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    },
                  ]}
                  glassEffectStyle="regular"
                >
                  <View style={[styles.discountBadge, { backgroundColor: '#a855f7' }]}>
                    <Text style={styles.discountBadgeText}>-{discountPct}%</Text>
                  </View>
                  <Text style={[styles.discountLabel, { color: secondaryColor }]}>DAILY DEAL</Text>
                  <View style={styles.discountRow}>
                    <View style={styles.discountPreview}>
                      <ItemPreviewComponent item={discountItem} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.discountItemName, { color: textColor }]}>{discountItem.name}</Text>
                      <RarityBadge rarity={discountItem.rarity} textColor={secondaryColor} />
                    </View>
                    <View style={styles.discountPriceCol}>
                      <Text style={[styles.discountOldPrice, { color: secondaryColor }]}>{originalDisplay}</Text>
                      <Text style={[styles.discountNewPrice, { color: theme.colors.primary }]}>{discountedDisplay}</Text>
                    </View>
                  </View>
                  <Text style={[styles.discountRefresh, { color: secondaryColor }]}>Refreshes in 12h 00m</Text>
                </GlassView>
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
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  storeTitle: {
    fontSize: 17,
    fontWeight: '600',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  fluxPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 1,
  },
  fluxAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarRight: {
    flexDirection: 'row',
    gap: 8,
    zIndex: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tab Bar
  tabBarWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabLabelInactive: {},
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
  },

  // Scroll content
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    marginTop: -6,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  // Daily
  dailyCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
    marginBottom: 16,
  },
  dailyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dailyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dailySignIn: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  dailySignInText: {
    fontSize: 15,
    textAlign: 'center',
  },
  dailyStreakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
  },
  dailyStreakNum: {
    fontSize: 48,
    fontWeight: '700',
  },
  dailyStreakLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dailyRewardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    borderRadius: 12,
    padding: 12,
  },
  dailyRewardValue: {
    color: '#f59e0b',
    fontSize: 22,
    fontWeight: '700',
  },
  dailyRewardType: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  claimBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  claimBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Discount Card
  discountCard: {
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  discountLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  discountPreview: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  discountItemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  discountPriceCol: {
    alignItems: 'flex-end',
  },
  discountOldPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  discountNewPrice: {
    fontSize: 17,
    fontWeight: '700',
  },
  discountRefresh: {
    fontSize: 12,
    textAlign: 'right',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
});
