import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  TERMS_ACCEPTED_AT: "TERMS_ACCEPTED_AT",
  WELCOME_BANNER_PENDING: "WELCOME_BANNER_PENDING",
  LOCAL_PROFILE_PHOTO: "LOCAL_PROFILE_PHOTO",
  USER_PROFILE_CACHE_PREFIX: "USER_PROFILE_CACHE",
  ACTIVE_SESSION: "samay_active_session",
  PENDING_MINUTES: "samay_pending_minutes_v1",
} as const;

export const consentService = {
  getTermsVersion: () => AsyncStorage.getItem(STORAGE_KEYS.TERMS_ACCEPTED_AT),
  setTermsVersion: (v: string) => AsyncStorage.setItem(STORAGE_KEYS.TERMS_ACCEPTED_AT, v),
  hasAccepted: async () => {
    const v = await AsyncStorage.getItem(STORAGE_KEYS.TERMS_ACCEPTED_AT);
    return Boolean(v?.trim());
  },
};

export const profilePrefsService = {
  getAvatar: () => AsyncStorage.getItem(STORAGE_KEYS.LOCAL_PROFILE_PHOTO),
  setAvatar: (uri: string) => AsyncStorage.setItem(STORAGE_KEYS.LOCAL_PROFILE_PHOTO, uri),
};

export const userProfileCacheService = {
  keyFor: (uid: string) => `${STORAGE_KEYS.USER_PROFILE_CACHE_PREFIX}:${uid}`,
  get: async <T>(uid: string): Promise<T | null> => {
    const raw = await AsyncStorage.getItem(userProfileCacheService.keyFor(uid));
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
  set: <T>(uid: string, value: T) =>
    AsyncStorage.setItem(userProfileCacheService.keyFor(uid), JSON.stringify(value)),
  clear: (uid: string) =>
    AsyncStorage.removeItem(userProfileCacheService.keyFor(uid)),
};
