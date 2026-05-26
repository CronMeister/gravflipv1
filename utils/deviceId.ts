import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "gravflip.deviceId";

let cachedDeviceId: string | null = null;

function generateUUID(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Math.random fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const getDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    let stored: string | null = null;

    if (Platform.OS === "web") {
      stored = localStorage.getItem(DEVICE_ID_KEY);
    } else {
      stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    }

    if (stored) {
      cachedDeviceId = stored;
      console.log("[DeviceId] Loaded existing device ID:", stored);
      return stored;
    }

    const newId = generateUUID();
    console.log("[DeviceId] Generated new device ID:", newId);

    if (Platform.OS === "web") {
      localStorage.setItem(DEVICE_ID_KEY, newId);
    } else {
      await SecureStore.setItemAsync(DEVICE_ID_KEY, newId);
    }

    cachedDeviceId = newId;
    return newId;
  } catch (error) {
    console.error("[DeviceId] Error getting device ID:", error);
    // Fallback: generate ephemeral ID for this session
    const fallback = generateUUID();
    cachedDeviceId = fallback;
    return fallback;
  }
};
