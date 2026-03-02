
import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Platform } from "react-native";
import { useTheme } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

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

export default function HomeScreen() {
  const theme = useTheme();
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  
  const playerY = useSharedValue(SCREEN_HEIGHT / 2);
  const playerVelocity = useRef(0);
  const gravityDirection = useRef(1);
  const obstacleCounter = useRef(0);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveEasyObstacles = useRef(0); // Track consecutive full obstacles

  const playerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: playerY.value },
        { rotate: `${gravityDirection.current === 1 ? '0deg' : '180deg'}` },
      ],
    };
  });

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

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    gameLoopRef.current = setInterval(() => {
      playerVelocity.current += GRAVITY * gravityDirection.current;
      let newPlayerY = playerY.value + playerVelocity.current;

      const minY = BOUNDARY_PADDING;
      const maxY = SCREEN_HEIGHT - PLAYER_SIZE - BOUNDARY_PADDING;

      if (newPlayerY < minY) {
        newPlayerY = minY;
        playerVelocity.current = 0;
        console.log("Player hit roof - sliding along boundary");
      } else if (newPlayerY > maxY) {
        newPlayerY = maxY;
        playerVelocity.current = 0;
        console.log("Player hit floor - sliding along boundary");
      }

      playerY.value = newPlayerY;

      setObstacles((prevObstacles) => {
        let newObstacles = prevObstacles.map((obs) => ({
          ...obs,
          x: obs.x - GAME_SPEED,
        }));

        newObstacles = newObstacles.filter((obs) => {
          if (obs.type === 'wall') {
            return obs.x > -SCREEN_WIDTH;
          }
          return obs.x > -OBSTACLE_WIDTH;
        });

        let currentScore = 0;
        newObstacles.forEach((obs) => {
          if (!obs.passed) {
            const passThreshold = obs.type === 'wall' ? obs.x + SCREEN_WIDTH : obs.x + OBSTACLE_WIDTH;
            if (passThreshold < 50) {
              obs.passed = true;
              currentScore++;
            }
          }
        });
        
        if (currentScore > 0) {
          runOnJS(setScore)((s) => {
            const newScore = s + currentScore;
            console.log("Score increased to:", newScore);
            return newScore;
          });
        }

        const difficultyMultiplier = Math.max(0, 1 - (score * DIFFICULTY_INCREASE_RATE));
        const currentFullObstacleDistance = Math.max(
          MIN_FULL_OBSTACLE_DISTANCE,
          OBSTACLE_SPAWN_DISTANCE * difficultyMultiplier
        );
        const currentFloatingObstacleDistance = Math.max(
          MIN_FLOATING_OBSTACLE_DISTANCE,
          FLOATING_OBSTACLE_SPAWN_DISTANCE * difficultyMultiplier
        );

        const lastObstacle = newObstacles[newObstacles.length - 1];
        const shouldSpawnFullObstacle = !lastObstacle || 
          (lastObstacle.type === 'full' && lastObstacle.x < SCREEN_WIDTH - currentFullObstacleDistance) ||
          (lastObstacle.type === 'floating' && lastObstacle.x < SCREEN_WIDTH - currentFullObstacleDistance) ||
          (lastObstacle.type === 'wall' && lastObstacle.x < SCREEN_WIDTH - currentFullObstacleDistance);
        
        const shouldSpawnFloatingObstacle = !lastObstacle || 
          lastObstacle.x < SCREEN_WIDTH - currentFloatingObstacleDistance;

        if (shouldSpawnFloatingObstacle) {
          // Force floating or wall obstacle if too many consecutive easy obstacles
          const forceChallengingObstacle = consecutiveEasyObstacles.current >= 4;
          
          let randomChoice = Math.random();
          
          // If forcing challenging obstacle, skip full obstacle chance
          if (forceChallengingObstacle) {
            randomChoice = Math.random() * (WALL_CHANCE + FLOATING_CHANCE);
            console.log("Forcing challenging obstacle after", consecutiveEasyObstacles.current, "easy obstacles");
          }
          
          if (randomChoice < WALL_CHANCE) {
            // Spawn wall obstacle (30% chance)
            if (shouldSpawnFullObstacle) {
              const minWallY = BOUNDARY_PADDING + 100;
              const maxWallY = SCREEN_HEIGHT - BOUNDARY_PADDING - WALL_OBSTACLE_HEIGHT - 100;
              const wallY = Math.random() * (maxWallY - minWallY) + minWallY;
              
              const minGapX = 80;
              const maxGapX = SCREEN_WIDTH - WALL_GAP_SIZE - 80;
              const wallGapX = Math.random() * (maxGapX - minGapX) + minGapX;
              
              newObstacles.push({
                id: obstacleCounter.current++,
                x: SCREEN_WIDTH,
                gapY: 0,
                wallY,
                wallGapX,
                passed: false,
                type: 'wall',
              });
              consecutiveEasyObstacles.current = 0;
              console.log("Spawned wall obstacle at Y:", wallY, "with gap at X:", wallGapX, "- Difficulty:", difficultyMultiplier.toFixed(2));
            }
          } else if (randomChoice < WALL_CHANCE + FLOATING_CHANCE) {
            // Spawn floating obstacle (60% chance) - bias toward edges
            const playableHeight = SCREEN_HEIGHT - BOUNDARY_PADDING * 2 - FLOATING_OBSTACLE_SIZE;
            const edgeZoneHeight = playableHeight * EDGE_ZONE_PERCENTAGE;
            
            let floatingY;
            const spawnNearEdge = Math.random() < EDGE_BIAS_CHANCE;
            
            if (spawnNearEdge) {
              // Spawn in edge zones (top 25% or bottom 25% of playable area)
              const spawnAtTop = Math.random() < 0.5;
              if (spawnAtTop) {
                // Top edge zone
                floatingY = BOUNDARY_PADDING + Math.random() * edgeZoneHeight;
              } else {
                // Bottom edge zone
                floatingY = SCREEN_HEIGHT - BOUNDARY_PADDING - FLOATING_OBSTACLE_SIZE - Math.random() * edgeZoneHeight;
              }
              console.log("Spawned edge floating obstacle at Y:", floatingY.toFixed(0), "(edge zone)");
            } else {
              // Spawn in middle zone
              const minFloatingY = BOUNDARY_PADDING + edgeZoneHeight;
              const maxFloatingY = SCREEN_HEIGHT - BOUNDARY_PADDING - FLOATING_OBSTACLE_SIZE - edgeZoneHeight;
              floatingY = Math.random() * (maxFloatingY - minFloatingY) + minFloatingY;
              console.log("Spawned center floating obstacle at Y:", floatingY.toFixed(0), "(center zone)");
            }
            
            newObstacles.push({
              id: obstacleCounter.current++,
              x: SCREEN_WIDTH,
              gapY: 0,
              floatingY,
              passed: false,
              type: 'floating',
            });
            consecutiveEasyObstacles.current = 0;
          } else {
            // Spawn full vertical obstacle (10% chance)
            if (shouldSpawnFullObstacle) {
              const minGapY = BOUNDARY_PADDING + 80;
              const maxGapY = SCREEN_HEIGHT - OBSTACLE_GAP - BOUNDARY_PADDING - 80;
              const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
              newObstacles.push({
                id: obstacleCounter.current++,
                x: SCREEN_WIDTH,
                gapY,
                passed: false,
                type: 'full',
              });
              consecutiveEasyObstacles.current++;
              console.log("Spawned full obstacle with gap at Y:", gapY, "- Consecutive easy:", consecutiveEasyObstacles.current, "- Difficulty:", difficultyMultiplier.toFixed(2));
            }
          }
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
    };
  }, [gameStarted, gameOver, score]);

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
  const startButtonText = gameOver ? 'Play Again' : 'Start Game';
  const instructionText = 'Tap to flip gravity';

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={[styles.container, { backgroundColor }]}
      onPress={flipGravity}
    >
      {gameStarted && !gameOver && (
        <>
          <View style={[styles.greyedOutArea, styles.topGreyedOut, { backgroundColor: greyedOutColor }]} />
          <View style={[styles.greyedOutArea, styles.bottomGreyedOut, { backgroundColor: greyedOutColor }]} />
          
          <View style={[styles.boundary, styles.topBoundary, { backgroundColor: boundaryColor }]} />
          <View style={[styles.boundary, styles.bottomBoundary, { backgroundColor: boundaryColor }]} />
        </>
      )}

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
        <View style={styles.menuContainer}>
          <Text style={[styles.title, { color: textColor }]}>Gravity Flip</Text>
          <Text style={[styles.instruction, { color: textColor }]}>{instructionText}</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: buttonBg }]}
            onPress={startGame}
          >
            <Text style={[styles.buttonText, { color: buttonText }]}>{startButtonText}</Text>
          </TouchableOpacity>
        </View>
      )}

      {gameOver && (
        <View style={styles.menuContainer}>
          <Text style={[styles.gameOverText, { color: obstacleColor }]}>{gameOverText}</Text>
          <Text style={[styles.finalScore, { color: textColor }]}>{finalScoreText}</Text>
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
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  instruction: {
    fontSize: 18,
    marginBottom: 32,
    textAlign: 'center',
  },
  gameOverText: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  finalScore: {
    fontSize: 28,
    marginBottom: 32,
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
