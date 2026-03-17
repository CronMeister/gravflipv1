import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet } from "@/utils/api";

interface UserStats {
  highScore: number;
  totalCoins: number;
  weeklyScore: number;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (user) {
      loadStats();
    } else {
      setStats(null);
    }
  }, [user]);

  const loadStats = async () => {
    console.log('[API] Loading user stats for profile...');
    try {
      setStatsLoading(true);
      const data = await authenticatedGet<UserStats>('/api/stats');
      console.log('[API] Profile stats loaded:', data);
      setStats(data);
    } catch (error) {
      console.error('[API] Error loading profile stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.contentContainer,
            Platform.OS !== 'ios' && styles.contentContainerWithTabBar
          ]}
        >
          <GlassView style={[
            styles.profileHeader,
            Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
          ]} glassEffectStyle="regular">
            <IconSymbol ios_icon_name="person.circle.fill" android_material_icon_name="person" size={80} color={theme.dark ? '#98989D' : '#ccc'} />
            <Text style={[styles.name, { color: theme.colors.text }]}>Guest</Text>
            <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>Sign in to track your progress</Text>
          </GlassView>

          <TouchableOpacity
            style={[styles.signInButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/auth')}
          >
            <IconSymbol ios_icon_name="person.fill" android_material_icon_name="person" size={20} color="#fff" />
            <Text style={styles.signInButtonText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar
        ]}
      >
        <GlassView style={[
          styles.profileHeader,
          Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
        ]} glassEffectStyle="regular">
          <IconSymbol ios_icon_name="person.circle.fill" android_material_icon_name="person" size={80} color={theme.colors.primary} />
          <Text style={[styles.name, { color: theme.colors.text }]}>{user.name || 'Player'}</Text>
          <Text style={[styles.email, { color: theme.dark ? '#98989D' : '#666' }]}>{user.email}</Text>
        </GlassView>

        {statsLoading ? (
          <View style={styles.statsLoadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : stats ? (
          <GlassView style={[
            styles.statsSection,
            Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
          ]} glassEffectStyle="regular">
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Your Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <IconSymbol ios_icon_name="trophy.fill" android_material_icon_name="star" size={28} color="#FFD700" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.highScore}</Text>
                <Text style={[styles.statLabel, { color: theme.dark ? '#98989D' : '#666' }]}>High Score</Text>
              </View>
              <View style={styles.statItem}>
                <IconSymbol ios_icon_name="dollarsign.circle.fill" android_material_icon_name="attach-money" size={28} color="#FFD700" />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.totalCoins}</Text>
                <Text style={[styles.statLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Total Coins</Text>
              </View>
              <View style={styles.statItem}>
                <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="leaderboard" size={28} color={theme.colors.primary} />
                <Text style={[styles.statValue, { color: theme.colors.text }]}>{stats.weeklyScore}</Text>
                <Text style={[styles.statLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Weekly Score</Text>
              </View>
            </View>
          </GlassView>
        ) : null}

        <TouchableOpacity
          style={[styles.signOutButton, { backgroundColor: theme.dark ? '#1c1c1e' : '#f1f5f9' }]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#ef4444" />
          ) : (
            <>
              <IconSymbol ios_icon_name="rectangle.portrait.and.arrow.right" android_material_icon_name="logout" size={20} color="#ef4444" />
              <Text style={styles.signOutButtonText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
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
  },
  statsLoadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
    gap: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 16,
  },
  statsSection: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  signOutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});
