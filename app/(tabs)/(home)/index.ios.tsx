
import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from "react-native";
import { useTheme } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PLAYER_SIZE = 40;
const OBSTACLE_WIDTH = 60;
const OBSTACLE_GAP = 200;
const GAME_SPEED = 3;
const GRAVITY = 0.6;
const JUMP_FORCE = -12;

interface Obstacle {
  id: number;
  x: number;
  gapY: number;
  passed: boolean;
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
    
    console.log("User tapped to flip gravity");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    gravityDirection.current *= -1;
    playerVelocity.current = JUMP_FORCE * gravityDirection.current;
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
  };

  const endGame = () => {
    console.log("Game over - Score:", score);
    setGameOver(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

    if (playerTop < 0 || playerBottom > SCREEN_HEIGHT) {
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    gameLoopRef.current = setInterval(() => {
      playerVelocity.current += GRAVITY * gravityDirection.current;
      const newPlayerY = playerY.value + playerVelocity.current;
      playerY.value = newPlayerY;

      setObstacles((prevObstacles) => {
        let newObstacles = prevObstacles.map((obs) => ({
          ...obs,
          x: obs.x - GAME_SPEED,
        }));

        newObstacles = newObstacles.filter((obs) => obs.x > -OBSTACLE_WIDTH);

        newObstacles.forEach((obs) => {
          if (!obs.passed && obs.x + OBSTACLE_WIDTH < 50) {
            obs.passed = true;
            runOnJS(setScore)((s) => s + 1);
          }
        });

        const lastObstacle = newObstacles[newObstacles.length - 1];
        if (!lastObstacle || lastObstacle.x < SCREEN_WIDTH - 300) {
          const gapY = Math.random() * (SCREEN_HEIGHT - OBSTACLE_GAP - 100) + 50;
          newObstacles.push({
            id: obstacleCounter.current++,
            x: SCREEN_WIDTH,
            gapY,
            passed: false,
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
    };
  }, [gameStarted, gameOver]);

  const isDark = theme.dark;
  const backgroundColor = isDark ? '#0a0a0f' : '#e0f2ff';
  const playerColor = '#f59e0b';
  const obstacleColor = isDark ? '#dc2626' : '#ef4444';
  const textColor = isDark ? '#ffffff' : '#1e293b';
  const buttonBg = isDark ? '#1e40af' : '#3b82f6';
  const buttonText = '#ffffff';

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
  },
  scoreContainer: {
    position: 'absolute',
    top: 60,
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
