export type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

let shouldPersistAuthSession = true;

export function setAuthPersistencePreference(value: boolean) {
  shouldPersistAuthSession = value;
}

export function createAuthSessionStorage(persistent: AuthStorage, transient: AuthStorage) {
  const storage: AuthStorage = {
    async getItem(key) {
      const persistedValue = await persistent.getItem(key);
      if (persistedValue != null) {
        shouldPersistAuthSession = true;
        return persistedValue;
      }
      const transientValue = await transient.getItem(key);
      if (transientValue != null) shouldPersistAuthSession = false;
      return transientValue ?? null;
    },
    async setItem(key, value) {
      const selected = shouldPersistAuthSession ? persistent : transient;
      const alternate = shouldPersistAuthSession ? transient : persistent;
      await selected.setItem(key, value);
      await alternate.removeItem(key);
    },
    async removeItem(key) {
      await Promise.all([
        persistent.removeItem(key),
        transient.removeItem(key),
      ]);
    },
  };

  return storage;
}
