
import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform, ScrollView } from "react-native";
import { useTheme } from "@react-navigation/native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { apiGet, authenticatedGet, authenticatedPost } from "@/utils/api";
import { useAuth } from "@/contexts/AuthContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PLAYER_SIZE = 40;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_GAP = 220;
const GAME_SPEED = 1.8;
const GRAVITY = 0.35;
const JUMP_FORCE = -8;
const BOUNDARY_PADDING = 20;
const OBSTACLE_SPAWN_DISTANCE = 400;
const FLOATING_OBSTACLE_SIZE = 50;
const FLOATING_OBSTACLE_SPAWN_DISTANCE = 180;

// Wall obstacle constants
const WALL_OBSTACLE_HEIGHT = 60;
const WALL_GAP_SIZE = 140;

// Progressive difficulty constants
const MIN_FULL_OBSTACLE_DISTANCE = 280;
const MIN_FLOATING_OBSTACLE_DISTANCE = 140;
const DIFFICULTY_INCREASE_RATE = 0.015;

// Obstacle spawn probabilities
const WALL_CHANCE = 0.30; // 30% chance for wall obstacles
const FLOATING_CHANCE = 0.60; // 60% chance for floating obstacles
// Remaining 10% for full vertical obstacles

// Edge bias for floating obstacles
const EDGE_ZONE_PERCENTAGE = 0.25; // Top/bottom 25% of playable area
const EDGE_BIAS_CHANCE = 0.65; // 65% of floating obstacles spawn near edges

// Speed scaling: speed = GAME_SPEED * min(MAX_SPEED_MULTIPLIER, 1 + score * SPEED_SCALE_RATE)
const SPEED_SCALE_RATE = 0.02;
const MAX_SPEED_MULTIPLIER = 3.0;

// Spawn interval scaling (ms): max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - score * INTERVAL_REDUCTION_PER_POINT)
const BASE_SPAWN_INTERVAL = 1400;
const INTERVAL_REDUCTION_PER_POINT = 12;
const MIN_SPAWN_INTERVAL = 600;

interface Obstacle {
  id: number;
  x: number;
  gapY: number;
  passed: boolean;
  type: 'full' | 'floating' | 'wall';
  floatingY?: number;
  wallY?: number;
  wallGapX?: number;
}

interface DailyObjective {
  id: string;
  title: string;
  description: string;
  targetValue: number;
  rewardCoins: number;
  icon: string;
  progress: number;
  completed: boolean;
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [highScore, setHighScore] = useState(0);
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>([]);
  
  const playerY = useSharedValue(SCREEN_HEIGHT / 2);
  const playerVelocity = useRef(0);
  const gravityDirection = useRef(1);
  const obstacleCounter = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const spawnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveEasyObstacles = useRef(0); // Track consecutive full obstacles
  const scoreRef = useRef(0); // Mirror of score state for use inside game loop

  const playerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: playerY.value },
        { rotate: `${gravityDirection.current === 1 ? '0deg' : '180deg'}` },
      ],
    };
  });

  useEffect(() => {
    loadGameData();
  }, [user]);

  const loadGameData = async () => {
    console.log('[API] Loading game data...');
    try {
      // Fetch high score from stats (authenticated)
      if (user) {
        try {
          const stats = await authenticatedGet<{ highScore: number; totalCoins: number; weeklyScore: number }>('/api/stats');
          console.log('[API] Stats loaded:', stats);
          setHighScore(stats.highScore || 0);
        } catch (statsError) {
          console.error('[API] Error loading stats:', statsError);
        }

        // Fetch daily objectives (authenticated)
        try {
          const objectivesData = await authenticatedGet<Array<{
            objective: {
              id: string;
              title: string;
              description: string;
              targetValue: number;
              rewardCoins: number;
              icon: string;
            };
            userProgress: {
              progress: number;
              completed: boolean;
            };
          }>>('/api/objectives/daily');
          console.log('[API] Daily objectives loaded:', objectivesData);
          const mapped: DailyObjective[] = objectivesData.map((item) => ({
            id: item.objective.id,
            title: item.objective.title,
            description: item.objective.description,
            targetValue: item.objective.targetValue,
            rewardCoins: item.objective.rewardCoins,
            icon: item.objective.icon || 'star',
            progress: item.userProgress?.progress || 0,
            completed: item.userProgress?.completed || false,
          }));
          setDailyObjectives(mapped);
        } catch (objError) {
          console.error('[API] Error loading objectives:', objError);
        }
      }
    } catch (error) {
      console.error('[API] Error loading game data:', error);
    }
  };

  const flipGravity = () => {
    if (!gameStarted || gameOver) return;
    
    console.log("User tapped to flip gravity - immediate shift");
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    gravityDirection.current *= -1;
    playerVelocity.current = 0;
  };

  const startGame = () => {
    console.log("Starting new game");
    scoreRef.current = 0;
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setObstacles([]);
    playerY.value = SCREEN_HEIGHT / 2;
    playerVelocity.current = 0;
    gravityDirection.current = 1;
    obstacleCounter.current = 0;
    consecutiveEasyObstacles.current = 0;
  };

  const endGame = () => {
    console.log("Game over - Score:", score);
    setGameOver(true);
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    // Submit score to backend (authenticated)
    if (user && score > 0) {
      console.log('[API] Submitting score:', score);
      authenticatedPost<{ highScore: number; totalCoins: number; weeklyScore: number; coinsAwarded: number }>('/api/stats/score', { score })
        .then((result) => {
          console.log('[API] Score submitted, new high score:', result.highScore, 'coins awarded:', result.coinsAwarded);
          setHighScore(result.highScore || 0);
        })
        .catch((err) => {
          console.error('[API] Error submitting score:', err);
        });
    } else if (score > highScore) {
      setHighScore(score);
    }
  };

  const checkCollision = (playerYPos: number, obstaclesList: Obstacle[]) => {
    const playerLeft = 50;
    const playerRight = playerLeft + PLAYER_SIZE;
    const playerTop = playerYPos;
    const playerBottom = playerYPos + PLAYER_SIZE;

    for (const obstacle of obstaclesList) {
      if (obstacle.type === 'floating' && obstacle.floatingY !== undefined) {
        const floatingLeft = obstacle.x;
        const floatingRight = obstacle.x + FLOATING_OBSTACLE_SIZE;
        const floatingTop = obstacle.floatingY;
        const floatingBottom = obstacle.floatingY + FLOATING_OBSTACLE_SIZE;

        if (
          playerRight > floatingLeft &&
          playerLeft < floatingRight &&
          playerBottom > floatingTop &&
          playerTop < floatingBottom
        ) {
          return true;
        }
      } else if (obstacle.type === 'wall' && obstacle.wallY !== undefined && obstacle.wallGapX !== undefined) {
        const wallTop = obstacle.wallY;
        const wallBottom = obstacle.wallY + WALL_OBSTACLE_HEIGHT;
        const wallLeft = obstacle.x;
        const wallRight = obstacle.x + SCREEN_WIDTH;
        const gapLeft = obstacle.wallGapX;
        const gapRight = obstacle.wallGapX + WALL_GAP_SIZE;

        if (playerBottom > wallTop && playerTop < wallBottom) {
          const playerCenterX = playerLeft + PLAYER_SIZE / 2;
          if (playerCenterX < gapLeft || playerCenterX > gapRight) {
            return true;
          }
        }
      } else {
        const obstacleLeft = obstacle.x;
        const obstacleRight = obstacle.x + OBSTACLE_WIDTH;

        if (playerRight > obstacleLeft && playerLeft < obstacleRight) {
          const topObstacleBottom = obstacle.gapY;
          const bottomObstacleTop = obstacle.gapY + OBSTACLE_GAP;

          if (playerTop < topObstacleBottom || playerBottom > bottomObstacleTop) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Spawn a single obstacle, called by the interval-based spawn timer
  const spawnObstacle = () => {
    const currentScore = scoreRef.current;
    const forceChallengingObstacle = consecutiveEasyObstacles.current >= 4;
    let randomChoice = Math.random();
    if (forceChallengingObstacle) {
      randomChoice = Math.random() * (WALL_CHANCE + FLOATING_CHANCE);
      console.log("Forcing challenging obstacle after", consecutiveEasyObstacles.current, "easy obstacles");
    }

    const speedMultiplier = Math.min(MAX_SPEED_MULTIPLIER, 1 + currentScore * SPEED_SCALE_RATE);
    const spawnInterval = Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - currentScore * INTERVAL_REDUCTION_PER_POINT);

    if (randomChoice < WALL_CHANCE) {
      const minWallY = BOUNDARY_PADDING + 100;
      const maxWallY = SCREEN_HEIGHT - BOUNDARY_PADDING - WALL_OBSTACLE_HEIGHT - 100;
      const wallY = Math.random() * (maxWallY - minWallY) + minWallY;
      const minGapX = 80;
      const maxGapX = SCREEN_WIDTH - WALL_GAP_SIZE - 80;
      const wallGapX = Math.random() * (maxGapX - minGapX) + minGapX;
      setObstacles((prev) => [
        ...prev,
        { id: obstacleCounter.current++, x: SCREEN_WIDTH, gapY: 0, wallY, wallGapX, passed: false, type: 'wall' },
      ]);
      consecutiveEasyObstacles.current = 0;
      console.log("Spawned wall obstacle - score:", currentScore, "speed multiplier:", speedMultiplier.toFixed(2), "spawn interval:", spawnInterval);
    } else if (randomChoice < WALL_CHANCE + FLOATING_CHANCE) {
      const playableHeight = SCREEN_HEIGHT - BOUNDARY_PADDING * 2 - FLOATING_OBSTACLE_SIZE;
      const edgeZoneHeight = playableHeight * EDGE_ZONE_PERCENTAGE;
      let floatingY: number;
      const spawnNearEdge = Math.random() < EDGE_BIAS_CHANCE;
      if (spawnNearEdge) {
        const spawnAtTop = Math.random() < 0.5;
        if (spawnAtTop) {
          floatingY = BOUNDARY_PADDING + Math.random() * edgeZoneHeight;
        } else {
          floatingY = SCREEN_HEIGHT - BOUNDARY_PADDING - FLOATING_OBSTACLE_SIZE - Math.random() * edgeZoneHeight;
        }
        console.log("Spawned edge floating obstacle at Y:", floatingY.toFixed(0), "- score:", currentScore, "speed multiplier:", speedMultiplier.toFixed(2));
      } else {
        const minFloatingY = BOUNDARY_PADDING + edgeZoneHeight;
        const maxFloatingY = SCREEN_HEIGHT - BOUNDARY_PADDING - FLOATING_OBSTACLE_SIZE - edgeZoneHeight;
        floatingY = Math.random() * (maxFloatingY - minFloatingY) + minFloatingY;
        console.log("Spawned center floating obstacle at Y:", floatingY.toFixed(0), "- score:", currentScore, "speed multiplier:", speedMultiplier.toFixed(2));
      }
      setObstacles((prev) => [
        ...prev,
        { id: obstacleCounter.current++, x: SCREEN_WIDTH, gapY: 0, floatingY, passed: false, type: 'floating' },
      ]);
      consecutiveEasyObstacles.current = 0;
    } else {
      const minGapY = BOUNDARY_PADDING + 80;
      const maxGapY = SCREEN_HEIGHT - OBSTACLE_GAP - BOUNDARY_PADDING - 80;
      const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
      setObstacles((prev) => [
        ...prev,
        { id: obstacleCounter.current++, x: SCREEN_WIDTH, gapY, passed: false, type: 'full' },
      ]);
      consecutiveEasyObstacles.current++;
      console.log("Spawned full obstacle - score:", currentScore, "speed multiplier:", speedMultiplier.toFixed(2), "consecutive easy:", consecutiveEasyObstacles.current);
    }
  };

  // Restart the spawn timer with the current score-based interval
  const restartSpawnTimer = () => {
    if (spawnTimerRef.current) clearTimeout(spawnTimerRef.current);
    const currentScore = scoreRef.current;
    const interval = Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - currentScore * INTERVAL_REDUCTION_PER_POINT);
    spawnTimerRef.current = setTimeout(() => {
      spawnObstacle();
      restartSpawnTimer();
    }, interval);
  };

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    // Kick off the first spawn immediately then keep scheduling
    restartSpawnTimer();

    gameLoopRef.current = setInterval(() => {
      const currentScore = scoreRef.current;
      const speedMultiplier = Math.min(MAX_SPEED_MULTIPLIER, 1 + currentScore * SPEED_SCALE_RATE);
      const currentSpeed = GAME_SPEED * speedMultiplier;

      playerVelocity.current += GRAVITY * gravityDirection.current;
      let newPlayerY = playerY.value + playerVelocity.current;

      const minY = BOUNDARY_PADDING;
      const maxY = SCREEN_HEIGHT - PLAYER_SIZE - BOUNDARY_PADDING;

      if (newPlayerY < minY || newPlayerY > maxY) {
        console.log("Player went out of bounds at Y:", newPlayerY.toFixed(1), "- triggering game over");
        runOnJS(endGame)();
        return;
      }

      playerY.value = newPlayerY;

      setObstacles((prevObstacles) => {
        let newObstacles = prevObstacles.map((obs) => ({
          ...obs,
          x: obs.x - currentSpeed,
        }));

        newObstacles = newObstacles.filter((obs) => {
          if (obs.type === 'wall') {
            return obs.x > -SCREEN_WIDTH;
          }
          return obs.x > -OBSTACLE_WIDTH;
        });

        let currentScoreDelta = 0;
        newObstacles.forEach((obs) => {
          if (!obs.passed) {
            const passThreshold = obs.type === 'wall' ? obs.x + SCREEN_WIDTH : obs.x + OBSTACLE_WIDTH;
            if (passThreshold < 50) {
              obs.passed = true;
              currentScoreDelta++;
            }
          }
        });

        if (currentScoreDelta > 0) {
          runOnJS(setScore)((s) => {
            const newScore = s + currentScoreDelta;
            scoreRef.current = newScore;
            console.log("Score increased to:", newScore, "| speed multiplier:", Math.min(MAX_SPEED_MULTIPLIER, 1 + newScore * SPEED_SCALE_RATE).toFixed(2), "| spawn interval:", Math.max(MIN_SPAWN_INTERVAL, BASE_SPAWN_INTERVAL - newScore * INTERVAL_REDUCTION_PER_POINT), "ms");
            return newScore;
          });
        }

        if (checkCollision(newPlayerY, newObstacles)) {
          runOnJS(endGame)();
        }

        return newObstacles;
      });
    }, 16);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
      if (spawnTimerRef.current) {
        clearTimeout(spawnTimerRef.current);
      }
    };
  }, [gameStarted, gameOver]);

  const isDark = theme.dark;
  const backgroundColor = isDark ? '#0a0a0f' : '#e0f2ff';
  const playerColor = '#f59e0b';
  const obstacleColor = isDark ? '#dc2626' : '#ef4444';
  const floatingObstacleColor = isDark ? '#7c3aed' : '#a855f7';
  const wallObstacleColor = isDark ? '#059669' : '#10b981';
  const textColor = isDark ? '#ffffff' : '#1e293b';
  const buttonBg = isDark ? '#1e40af' : '#3b82f6';
  const buttonText = '#ffffff';
  const boundaryColor = isDark ? '#374151' : '#cbd5e1';
  const greyedOutColor = isDark ? 'rgba(30, 30, 40, 0.6)' : 'rgba(148, 163, 184, 0.4)';

  const scoreText = `${score}`;
  const gameOverText = 'Game Over!';
  const finalScoreText = `Score: ${score}`;
  const highScoreText = `High Score: ${highScore}`;
  const startButtonText = gameOver ? 'Play Again' : 'Start Game';
  const instructionText = 'Tap to flip gravity';
  const leaderboardButtonText = 'Leaderboard';

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[styles.container, { backgroundColor }]}
      onPress={flipGravity}
    >


      {gameStarted && !gameOver && (
        <View style={styles.scoreContainer}>
          <Text style={[styles.scoreText, { color: textColor }]}>{scoreText}</Text>
        </View>
      )}

      {gameStarted && !gameOver && (
        <>
          <Animated.View
            style={[
              styles.player,
              { backgroundColor: playerColor },
              playerAnimatedStyle,
            ]}
          />

          {obstacles.map((obstacle) => (
            <React.Fragment key={obstacle.id}>
              {obstacle.type === 'floating' && obstacle.floatingY !== undefined ? (
                <View
                  style={[
                    styles.floatingObstacle,
                    {
                      backgroundColor: floatingObstacleColor,
                      left: obstacle.x,
                      top: obstacle.floatingY,
                      width: FLOATING_OBSTACLE_SIZE,
                      height: FLOATING_OBSTACLE_SIZE,
                    },
                  ]}
                />
              ) : obstacle.type === 'wall' && obstacle.wallY !== undefined && obstacle.wallGapX !== undefined ? (
                <>
                  <View
                    style={[
                      styles.wallObstacle,
                      {
                        backgroundColor: wallObstacleColor,
                        left: obstacle.x,
                        top: obstacle.wallY,
                        width: obstacle.wallGapX,
                        height: WALL_OBSTACLE_HEIGHT,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.wallObstacle,
                      {
                        backgroundColor: wallObstacleColor,
                        left: obstacle.x + obstacle.wallGapX + WALL_GAP_SIZE,
                        top: obstacle.wallY,
                        width: SCREEN_WIDTH - obstacle.wallGapX - WALL_GAP_SIZE,
                        height: WALL_OBSTACLE_HEIGHT,
                      },
                    ]}
                  />
                </>
              ) : (
                <>
                  <View
                    style={[
                      styles.obstacle,
                      styles.topObstacle,
                      {
                        backgroundColor: obstacleColor,
                        left: obstacle.x,
                        height: obstacle.gapY,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.obstacle,
                      styles.bottomObstacle,
                      {
                        backgroundColor: obstacleColor,
                        left: obstacle.x,
                        top: obstacle.gapY + OBSTACLE_GAP,
                        height: SCREEN_HEIGHT - (obstacle.gapY + OBSTACLE_GAP),
                      },
                    ]}
                  />
                </>
              )}
            </React.Fragment>
          ))}
        </>
      )}

      {!gameStarted && !gameOver && (
        <ScrollView 
          style={styles.menuScrollView}
          contentContainerStyle={[
            styles.menuContainer,
            Platform.OS !== 'ios' && styles.menuContainerWithTabBar
          ]}
        >
          <Text style={[styles.title, { color: textColor }]}>GravFlip</Text>
          
          <GlassView 
            style={[
              styles.highScoreCard,
              Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
            ]} 
            glassEffectStyle="regular"
          >
            <IconSymbol ios_icon_name="trophy.fill" android_material_icon_name="star" size={32} color="#FFD700" />
            <Text style={[styles.highScoreText, { color: textColor }]}>{highScoreText}</Text>
          </GlassView>

          <TouchableOpacity
            style={[styles.leaderboardButton, { backgroundColor: theme.dark ? '#1e293b' : '#f1f5f9' }]}
            onPress={() => router.push('/leaderboard')}
          >
            <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="leaderboard" size={20} color={theme.colors.primary} />
            <Text style={[styles.leaderboardButtonText, { color: textColor }]}>{leaderboardButtonText}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { color: textColor }]}>Daily Objectives</Text>
          
          {dailyObjectives.map((objective) => {
            const progressPercent = Math.min((objective.progress / objective.targetValue) * 100, 100);
            const progressText = `${objective.progress}/${objective.targetValue}`;
            const rewardText = `+${objective.rewardCoins}`;
            
            return (
              <GlassView 
                key={objective.id}
                style={[
                  styles.objectiveCard,
                  Platform.OS !== 'ios' && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                ]} 
                glassEffectStyle="regular"
              >
                <View style={styles.objectiveHeader}>
                  <IconSymbol 
                    ios_icon_name={objective.icon} 
                    android_material_icon_name={objective.icon} 
                    size={24} 
                    color={theme.colors.primary} 
                  />
                  <View style={styles.objectiveInfo}>
                    <Text style={[styles.objectiveTitle, { color: textColor }]}>{objective.title}</Text>
                    <Text style={[styles.objectiveProgress, { color: theme.dark ? '#98989D' : '#666' }]}>{progressText}</Text>
                  </View>
                  <View style={styles.rewardBadge}>
                    <IconSymbol ios_icon_name="dollarsign.circle.fill" android_material_icon_name="attach-money" size={16} color="#FFD700" />
                    <Text style={[styles.rewardText, { color: textColor }]}>{rewardText}</Text>
                  </View>
                </View>
                <View style={[styles.progressBar, { backgroundColor: theme.dark ? '#1e293b' : '#e2e8f0' }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${progressPercent}%`, backgroundColor: theme.colors.primary }
                    ]} 
                  />
                </View>
              </GlassView>
            );
          })}

          <Text style={[styles.instruction, { color: textColor }]}>{instructionText}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonBg }]}
            onPress={startGame}
          >
            <Text style={[styles.buttonText, { color: buttonText }]}>{startButtonText}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {gameOver && (
        <View style={styles.menuContainer}>
          <Text style={[styles.gameOverText, { color: obstacleColor }]}>{gameOverText}</Text>
          <Text style={[styles.finalScore, { color: textColor }]}>{finalScoreText}</Text>
          {score > highScore && (
            <Text style={[styles.newHighScore, { color: '#FFD700' }]}>New High Score! 🎉</Text>
          )}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonBg }]}
            onPress={startGame}
          >
            <Text style={[styles.buttonText, { color: buttonText }]}>{startButtonText}</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 48 : 0,
  },
  scoreContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 68 : 60,
    alignSelf: 'center',
    zIndex: 10,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  player: {
    position: 'absolute',
    left: 50,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    borderRadius: PLAYER_SIZE / 2,
  },
  obstacle: {
    position: 'absolute',
    width: OBSTACLE_WIDTH,
  },
  topObstacle: {
    top: 0,
  },
  bottomObstacle: {},
  floatingObstacle: {
    position: 'absolute',
    borderRadius: 8,
  },
  wallObstacle: {
    position: 'absolute',
    borderRadius: 4,
  },
  greyedOutArea: {
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  topGreyedOut: {
    top: 0,
    height: BOUNDARY_PADDING,
  },
  bottomGreyedOut: {
    bottom: 0,
    height: BOUNDARY_PADDING,
  },
  boundary: {
    position: 'absolute',
    width: '100%',
    height: 3,
    zIndex: 5,
  },
  topBoundary: {
    top: BOUNDARY_PADDING,
  },
  bottomBoundary: {
    bottom: BOUNDARY_PADDING,
  },
  menuScrollView: {
    flex: 1,
  },
  menuContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  menuContainerWithTabBar: {
    paddingBottom: 120,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  highScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  highScoreText: {
    fontSize: 20,
    fontWeight: '600',
  },
  leaderboardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    gap: 12,
    width: '100%',
    maxWidth: 400,
  },
  leaderboardButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: 400,
  },
  objectiveCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    maxWidth: 400,
  },
  objectiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  objectiveInfo: {
    flex: 1,
  },
  objectiveTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  objectiveProgress: {
    fontSize: 14,
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rewardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  instruction: {
    fontSize: 18,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  gameOverText: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  finalScore: {
    fontSize: 28,
    marginBottom: 8,
  },
  newHighScore: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
  },
});
