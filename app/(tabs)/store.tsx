
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { apiGet, apiPost, authenticatedGet, authenticatedPost } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  category: string;
}

interface UserStats {
  totalCoins: number;
  highScore: number;
  weeklyScore: number;
}

const CATEGORY_INFO: Record<string, { title: string; icon: string; color: string }> = {
  skin: { title: 'Character Skins', icon: 'palette', color: '#8b5cf6' },
  world_pack: { title: 'World Packs', icon: 'public', color: '#3b82f6' },
  shield: { title: 'Shields', icon: 'shield', color: '#10b981' },
  powerup: { title: 'Power-Ups', icon: 'bolt', color: '#f59e0b' },
};

export default function StoreScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [purchasedItemIds, setPurchasedItemIds] = useState<Set<string>>(new Set());
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const showModal = (title: string, message: string) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalVisible(true);
  };

  useEffect(() => {
    loadStoreData();
  }, [user]);

  const loadStoreData = async () => {
    console.log('[Store] Loading store data...');
    try {
      setLoading(true);

      let storeItems = await apiGet<StoreItem[]>('/api/store/items');
      console.log('[Store] Store items loaded:', storeItems.length);

      // If no items exist, seed the store with initial items
      if (storeItems.length === 0) {
        console.log('[Store] No items found, seeding store...');
        try {
          const seedResult = await apiPost<{ created: number; total: number; message: string }>('/api/store/seed', {});
          console.log('[Store] Seed result:', seedResult);
          // Reload items after seeding
          storeItems = await apiGet<StoreItem[]>('/api/store/items');
          console.log('[Store] Store items after seed:', storeItems.length);
        } catch (seedError) {
          console.error('[Store] Error seeding store:', seedError);
        }
      }

      setItems(storeItems);

      if (user) {
        try {
          const stats = await authenticatedGet<UserStats>('/api/stats');
          console.log('[Store] User stats loaded:', stats);
          setUserStats(stats);
        } catch (statsError) {
          console.error('[Store] Error loading stats:', statsError);
        }

        try {
          const purchases = await authenticatedGet<Array<{ itemId: string }>>('/api/store/purchases');
          console.log('[Store] User purchases loaded:', purchases.length);
          setPurchasedItemIds(new Set(purchases.map((p) => p.itemId)));
        } catch (purchasesError) {
          console.error('[Store] Error loading purchases:', purchasesError);
        }
      }
    } catch (error) {
      console.error('[Store] Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId: string, price: number) => {
    console.log('[Store] Attempting to purchase item:', itemId);

    if (!user) {
      showModal('Sign In Required', 'Please sign in to purchase items from the store.');
      return;
    }
    
    if (!userStats || userStats.totalCoins < price) {
      const coinsNeeded = price;
      const coinsHave = userStats?.totalCoins || 0;
      showModal('Not Enough Coins', `You need ${coinsNeeded} coins but only have ${coinsHave} coins.`);
      return;
    }
    
    try {
      setPurchasing(itemId);
      const result = await authenticatedPost<{ id: string; itemId: string; purchasedAt: string }>('/api/store/purchase', { itemId });
      console.log('[Store] Purchase successful:', result);
      setPurchasedItemIds((prev) => new Set([...prev, itemId]));
      setUserStats((prev) => prev ? { ...prev, totalCoins: prev.totalCoins - price } : null);
      showModal('Purchase Successful! 🎉', 'Item has been added to your collection.');
    } catch (error: any) {
      console.error('[Store] Error purchasing item:', error);
      const msg = error?.message?.includes('400') ? 'You already own this item.' : 'Purchase failed. Please try again.';
      showModal('Purchase Failed', msg);
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (priceInCents: number) => {
    const rands = (priceInCents / 100).toFixed(0);
    const priceText = `R${rands}`;
    return priceText;
  };

  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, StoreItem[]>);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.text }]}>Loading store...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>{modalTitle}</Text>
            <Text style={[styles.modalMessage, { color: theme.dark ? '#98989D' : '#666' }]}>{modalMessage}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar
        ]}
      >
        <GlassView 
          style={[
            styles.coinsHeader,
            Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
          ]} 
          glassEffectStyle="regular"
        >
          <IconSymbol ios_icon_name="dollarsign.circle.fill" android_material_icon_name="attach-money" size={40} color="#FFD700" />
          <View>
            <Text style={[styles.coinsLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Your Coins</Text>
            <Text style={[styles.coinsAmount, { color: theme.colors.text }]}>{userStats?.totalCoins ?? (user ? '...' : '—')}</Text>
          </View>
        </GlassView>

        <Text style={[styles.mainTitle, { color: theme.colors.text }]}>Store</Text>

        {items.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <IconSymbol ios_icon_name="cart" android_material_icon_name="shopping-cart" size={64} color={theme.dark ? '#444' : '#ccc'} />
            <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>No items available yet.</Text>
            <Text style={[styles.emptySubtext, { color: theme.dark ? '#6b7280' : '#9ca3af' }]}>Check back soon for new items!</Text>
          </View>
        )}

        {Object.entries(groupedItems).map(([category, categoryItems]) => {
          const categoryInfo = CATEGORY_INFO[category] || { title: category, icon: 'shopping-bag', color: theme.colors.primary };
          
          return (
            <View key={category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <IconSymbol 
                  ios_icon_name={categoryInfo.icon} 
                  android_material_icon_name={categoryInfo.icon} 
                  size={24} 
                  color={categoryInfo.color} 
                />
                <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>{categoryInfo.title}</Text>
              </View>

              {categoryItems.map((item) => {
                const isOwned = purchasedItemIds.has(item.id);
                const canAfford = !isOwned && userStats && userStats.totalCoins >= item.price;
                const isPurchasing = purchasing === item.id;
                const priceDisplay = formatPrice(item.price);
                
                return (
                  <GlassView 
                    key={item.id}
                    style={[
                      styles.itemCard,
                      Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                    ]} 
                    glassEffectStyle="regular"
                  >
                    <View style={styles.itemContent}>
                      <View style={[styles.itemIconContainer, { backgroundColor: categoryInfo.color + '20' }]}>
                        <IconSymbol 
                          ios_icon_name={item.icon} 
                          android_material_icon_name={item.icon} 
                          size={28} 
                          color={categoryInfo.color} 
                        />
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { color: theme.colors.text }]}>{item.name}</Text>
                        <Text style={[styles.itemDescription, { color: theme.dark ? '#98989D' : '#666' }]} numberOfLines={2}>{item.description}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.purchaseButton,
                          { backgroundColor: isOwned ? '#22c55e' : canAfford ? categoryInfo.color : theme.dark ? '#333' : '#ccc' }
                        ]}
                        onPress={() => !isOwned && handlePurchase(item.id, item.price)}
                        disabled={isOwned || !canAfford || isPurchasing}
                      >
                        {isPurchasing ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : isOwned ? (
                          <IconSymbol ios_icon_name="checkmark" android_material_icon_name="check" size={18} color="#fff" />
                        ) : (
                          <Text style={styles.purchaseButtonText}>{priceDisplay}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </GlassView>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
  },
  coinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  coinsLabel: {
    fontSize: 14,
  },
  coinsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  categorySection: {
    marginBottom: 28,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  itemCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  purchaseButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
