import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServerSettings, VerificationResponse } from '../types';

const SERVER_URL_KEY = 'server_url';
const DEFAULT_SERVER_URL = 'http://localhost:3002';

export async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    return stored ?? DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

export async function saveServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url);
}

export async function login(
  serverUrl: string,
  username: string,
  password: string
): Promise<{ token: string; role: string; username: string }> {
  const res = await fetch(`${serverUrl}/api/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error ?? 'Login failed');
  }
  return res.json();
}

export async function fetchSettings(serverUrl: string, token: string): Promise<ServerSettings> {
  const res = await fetch(`${serverUrl}/api/mobile/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to fetch settings' }));
    throw new Error(err.error ?? 'Failed to fetch settings');
  }
  return res.json();
}

export async function verifyIdentity(
  serverUrl: string,
  token: string,
  pinNumber: string,
  imageBase64: string,
  livenessPassed: boolean
): Promise<VerificationResponse> {
  const res = await fetch(`${serverUrl}/api/mobile/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pinNumber, image: imageBase64, livenessPassed }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(err.error ?? 'Verification failed');
  }
  return res.json();
}
