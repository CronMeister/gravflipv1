
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { apiGet, authenticatedGet, authenticatedPost } from "@/utils/api";
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
    console.log('[API] Loading store data...');
    try {
      setLoading(true);

      const storeItems = await apiGet<StoreItem[]>('/api/store/items');
      console.log('[API] Store items loaded:', storeItems.length);
      setItems(storeItems);

      if (user) {
        try {
          const stats = await authenticatedGet<UserStats>('/api/stats');
          console.log('[API] User stats loaded:', stats);
          setUserStats(stats);
        } catch (statsError) {
          console.error('[API] Error loading stats:', statsError);
        }

        try {
          const purchases = await authenticatedGet<Array<{ itemId: string }>>('/api/store/purchases');
          console.log('[API] User purchases loaded:', purchases.length);
          setPurchasedItemIds(new Set(purchases.map((p) => p.itemId)));
        } catch (purchasesError) {
          console.error('[API] Error loading purchases:', purchasesError);
        }
      }
    } catch (error) {
      console.error('[API] Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (itemId: string, price: number) => {
    console.log('[API] Attempting to purchase item:', itemId);

    if (!user) {
      showModal('Sign In Required', 'Please sign in to purchase items from the store.');
      return;
    }
    
    if (!userStats || userStats.totalCoins < price) {
      showModal('Not Enough Coins', `You need ${price} coins but only have ${userStats?.totalCoins || 0} coins.`);
      return;
    }
    
    try {
      setPurchasing(itemId);
      const result = await authenticatedPost<{ id: string; itemId: string; purchasedAt: string }>('/api/store/purchase', { itemId });
      console.log('[API] Purchase successful:', result);
      setPurchasedItemIds((prev) => new Set([...prev, itemId]));
      setUserStats((prev) => prev ? { ...prev, totalCoins: prev.totalCoins - price } : null);
      showModal('Purchase Successful! 🎉', 'Item has been added to your collection.');
    } catch (error: any) {
      console.error('[API] Error purchasing item:', error);
      const msg = error?.message?.includes('400') ? 'You already own this item.' : 'Purchase failed. Please try again.';
      showModal('Purchase Failed', msg);
    } finally {
      setPurchasing(null);
    }
  };

  const formatPrice = (priceInCents: number) => {
    const priceText = `R${(priceInCents / 100).toFixed(2)}`;
    return priceText;
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
        contentContainerStyle={styles.contentContainer}
      >
        <GlassView style={styles.coinsHeader} glassEffectStyle="regular">
          <IconSymbol ios_icon_name="dollarsign.circle.fill" android_material_icon_name="attach-money" size={40} color="#FFD700" />
          <View>
            <Text style={[styles.coinsLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Your Coins</Text>
            <Text style={[styles.coinsAmount, { color: theme.colors.text }]}>{userStats?.totalCoins ?? (user ? '...' : '—')}</Text>
          </View>
        </GlassView>

        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Store</Text>

        {items.length === 0 && !loading && (
          <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>No items available in the store.</Text>
        )}

        {items.map((item) => {
          const isOwned = purchasedItemIds.has(item.id);
          const canAfford = !isOwned && userStats && userStats.totalCoins >= item.price;
          const isPurchasing = purchasing === item.id;
          const priceDisplay = formatPrice(item.price);
          
          return (
            <GlassView key={item.id} style={styles.itemCard} glassEffectStyle="regular">
              <View style={styles.itemHeader}>
                <IconSymbol 
                  ios_icon_name={item.icon} 
                  android_material_icon_name={item.icon} 
                  size={32} 
                  color={theme.colors.primary} 
                />
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.colors.text }]}>{item.name}</Text>
                  <Text style={[styles.itemDescription, { color: theme.dark ? '#98989D' : '#666' }]}>{item.description}</Text>
                  <Text style={[styles.itemCategory, { color: theme.dark ? '#6b7280' : '#9ca3af' }]}>{item.category}</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[
                  styles.purchaseButton,
                  { backgroundColor: isOwned ? '#22c55e' : canAfford ? theme.colors.primary : theme.dark ? '#333' : '#ccc' }
                ]}
                onPress={() => !isOwned && handlePurchase(item.id, item.price)}
                disabled={isOwned || !canAfford || isPurchasing}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : isOwned ? (
                  <Text style={styles.purchaseButtonText}>✓ Owned</Text>
                ) : (
                  <Text style={styles.purchaseButtonText}>{priceDisplay}</Text>
                )}
              </TouchableOpacity>
            </GlassView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  coinsLabel: {
    fontSize: 14,
  },
  coinsAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
  },
  purchaseButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  itemCategory: {
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
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
