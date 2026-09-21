import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading localStorage key “' + key + '”:', error);
      return defaultValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error('Error setting localStorage key “' + key + '”:', error);
    }
  };

  useEffect(() => {
    setStoredValue((prev) => {
      try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        return prev;
      }
    });
  }, [key, defaultValue]);

  return [storedValue, setValue];
}
