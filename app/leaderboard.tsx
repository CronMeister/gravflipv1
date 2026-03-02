
import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { apiGet, authenticatedGet } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
  image?: string | null;
}

type LeaderboardType = 'weekly' | 'alltime';

export default function LeaderboardScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<{ weeklyRank: number; weeklyScore: number; alltimeRank: number; highScore: number } | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [leaderboardType, user]);

  const loadLeaderboard = async () => {
    console.log('[API] Loading leaderboard:', leaderboardType);
    try {
      setLoading(true);

      // Fetch leaderboard data (public endpoints)
      if (leaderboardType === 'weekly') {
        const data = await apiGet<Array<{ rank: number; userId: string; name: string; weeklyScore: number; image?: string | null }>>('/api/leaderboard/weekly');
        console.log('[API] Weekly leaderboard loaded:', data.length, 'entries');
        setEntries(data.map((e) => ({
          userId: e.userId,
          name: e.name,
          score: e.weeklyScore,
          rank: e.rank,
          image: e.image,
        })));
      } else {
        const data = await apiGet<Array<{ rank: number; userId: string; name: string; highScore: number; image?: string | null }>>('/api/leaderboard/alltime');
        console.log('[API] All-time leaderboard loaded:', data.length, 'entries');
        setEntries(data.map((e) => ({
          userId: e.userId,
          name: e.name,
          score: e.highScore,
          rank: e.rank,
          image: e.image,
        })));
      }

      // Fetch user position (authenticated)
      if (user) {
        try {
          const userPos = await authenticatedGet<{ weeklyRank: number; weeklyScore: number; alltimeRank: number; highScore: number }>('/api/leaderboard/user');
          console.log('[API] User leaderboard position:', userPos);
          setUserPosition(userPos);
        } catch (userPosError) {
          console.error('[API] Error loading user position:', userPosError);
          setUserPosition(null);
        }
      } else {
        setUserPosition(null);
      }
    } catch (error) {
      console.error('[API] Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return '#FFD700';
    if (rank === 2) return '#C0C0C0';
    if (rank === 3) return '#CD7F32';
    return theme.colors.text;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    const rankText = `${rank}`;
    return rankText;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: 'Leaderboard',
          headerBackTitle: 'Back',
        }} 
      />
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            leaderboardType === 'weekly' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setLeaderboardType('weekly')}
        >
          <Text style={[
            styles.tabText,
            { color: leaderboardType === 'weekly' ? '#fff' : theme.colors.text }
          ]}>Weekly</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            leaderboardType === 'alltime' && { backgroundColor: theme.colors.primary }
          ]}
          onPress={() => setLeaderboardType('alltime')}
        >
          <Text style={[
            styles.tabText,
            { color: leaderboardType === 'alltime' ? '#fff' : theme.colors.text }
          ]}>All Time</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
          {userPosition && (
            <GlassView style={styles.userPositionCard} glassEffectStyle="regular">
              <Text style={[styles.userPositionLabel, { color: theme.dark ? '#98989D' : '#666' }]}>Your Position</Text>
              <View style={styles.userPositionContent}>
                <Text style={[styles.userRank, { color: theme.colors.text }]}>
                  #{leaderboardType === 'weekly' ? userPosition.weeklyRank : userPosition.alltimeRank}
                </Text>
                <Text style={[styles.userScore, { color: theme.colors.text }]}>
                  {leaderboardType === 'weekly' ? userPosition.weeklyScore : userPosition.highScore} pts
                </Text>
              </View>
            </GlassView>
          )}

          {entries.length === 0 && (
            <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>No entries yet. Be the first!</Text>
          )}

          {entries.map((entry) => {
            const rankDisplay = getRankIcon(entry.rank);
            const rankColor = getRankColor(entry.rank);
            const isCurrentUser = user && entry.userId === user.id;
            
            return (
              <GlassView
                key={entry.userId}
                style={[
                  styles.entryCard,
                  isCurrentUser && { borderWidth: 1, borderColor: theme.colors.primary }
                ]}
                glassEffectStyle="regular"
              >
                <View style={styles.rankContainer}>
                  <Text style={[styles.rankText, { color: rankColor }]}>{rankDisplay}</Text>
                </View>
                <View style={styles.entryInfo}>
                  <Text style={[styles.username, { color: theme.colors.text }]}>
                    {entry.name}{isCurrentUser ? ' (You)' : ''}
                  </Text>
                  <Text style={[styles.score, { color: theme.dark ? '#98989D' : '#666' }]}>{entry.score} pts</Text>
                </View>
              </GlassView>
            );
          })}
        </ScrollView>
      )}
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
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  userPositionCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  userPositionLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  userPositionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userRank: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  userScore: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 16,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  entryInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  score: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 40,
  },
});
