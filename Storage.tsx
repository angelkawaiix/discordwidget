/**
 * Determine is localStorage can be used.
 */
function localStorageTest(): boolean {
  const test = 'test';
  try {
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Store everything in local storage.
 */
class LocalStorage {
  /**
   * Get an item from the store.
   */
  get(key: string): string | null | undefined {
    let value = localStorage.getItem(key);
    if (value != null) {
      try {
        value = JSON.parse(value);
      } catch (e) {}
    }
    return value;
  }

  /**
   * Set an item in the store.
   */
  set(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Remove an item from the store.
   */
  remove(key: string): void {
    localStorage.removeItem(key);
  }

  /**
   * Clear all items at the store.
   */
  clear(): void {
    localStorage.clear();
  }
}

/**
 * Mock store that puts everything in an object if localStorage is disabled.
 */
class ObjectStorage {
  storage: {[key: string]: any};

  constructor() {
    this.storage = {};
  }

  /**
   * Get an item from the store.
   */
  get(key: string): string | null | undefined {
    return this.storage[key];
  }

  /**
   * Set an item in the store.
   */
  set(key: string, value: any): void {
    this.storage[key] = value;
  }

  /**
   * Remove an item from the store.
   */
  remove(key: string): void {
    delete this.storage[key];
  }

  /**
   * Clear all items at the store.
   */
  clear(): void {
    this.storage = {};
  }
}

export default localStorageTest() ? new LocalStorage() : new ObjectStorage();
