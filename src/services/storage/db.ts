import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { SavedDraft, SavedSignature, SavedStamp } from '../../types/document';

interface DocuLoomDB extends DBSchema {
  preferences: {
    key: string;
    value: any;
  };
  recentTools: {
    key: string;
    value: {
      toolId: string;
      lastUsed: number;
    };
    indexes: { 'by-time': number };
  };
  recentFiles: {
    key: string;
    value: {
      id: string;
      fileName: string;
      fileSizeBytes: number;
      pageCount?: number;
      lastOpened: number;
    };
    indexes: { 'by-time': number };
  };
  savedSignatures: {
    key: string;
    value: SavedSignature;
  };
  savedStamps: {
    key: string;
    value: SavedStamp;
  };
  drafts: {
    key: string;
    value: SavedDraft;
    indexes: { 'by-modified': number };
  };
  favorites: {
    key: string;
    value: {
      toolId: string;
      addedAt: number;
    };
  };
}

const DB_NAME = 'doculoom-local-store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DocuLoomDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<DocuLoomDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences');
        }
        if (!db.objectStoreNames.contains('recentTools')) {
          const store = db.createObjectStore('recentTools', { keyPath: 'toolId' });
          store.createIndex('by-time', 'lastUsed');
        }
        if (!db.objectStoreNames.contains('recentFiles')) {
          const store = db.createObjectStore('recentFiles', { keyPath: 'id' });
          store.createIndex('by-time', 'lastOpened');
        }
        if (!db.objectStoreNames.contains('savedSignatures')) {
          db.createObjectStore('savedSignatures', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('savedStamps')) {
          db.createObjectStore('savedStamps', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          const store = db.createObjectStore('drafts', { keyPath: 'id' });
          store.createIndex('by-modified', 'lastModified');
        }
        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'toolId' });
        }
      },
    });
  }
  return dbPromise;
}

// Storage helpers
export const StorageService = {
  // Preferences
  async getPreference<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const db = await getDB();
      const val = await db.get('preferences', key);
      return val !== undefined ? val : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  async setPreference<T>(key: string, value: T): Promise<void> {
    try {
      const db = await getDB();
      await db.put('preferences', value, key);
    } catch (e) {
      console.warn('Failed to save preference', e);
    }
  },

  // Recent Tools
  async logToolUsage(toolId: string): Promise<void> {
    try {
      const db = await getDB();
      await db.put('recentTools', { toolId, lastUsed: Date.now() });
    } catch (e) {
      console.warn('Failed to log tool usage', e);
    }
  },

  async getRecentTools(limit = 6): Promise<string[]> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('recentTools', 'by-time');
      return all.reverse().slice(0, limit).map((t) => t.toolId);
    } catch {
      return [];
    }
  },

  // Recent Files (metadata only)
  async logRecentFile(meta: { fileName: string; fileSizeBytes: number; pageCount?: number }): Promise<void> {
    try {
      const db = await getDB();
      const id = `${meta.fileName}-${meta.fileSizeBytes}`;
      await db.put('recentFiles', {
        id,
        ...meta,
        lastOpened: Date.now(),
      });
    } catch (e) {
      console.warn('Failed to log recent file', e);
    }
  },

  async getRecentFiles(limit = 5): Promise<Array<{ id: string; fileName: string; fileSizeBytes: number; pageCount?: number; lastOpened: number }>> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('recentFiles', 'by-time');
      return all.reverse().slice(0, limit);
    } catch {
      return [];
    }
  },

  // Favorites
  async getFavorites(): Promise<string[]> {
    try {
      const db = await getDB();
      const all = await db.getAll('favorites');
      return all.map((f) => f.toolId);
    } catch {
      return [];
    }
  },

  async toggleFavorite(toolId: string): Promise<boolean> {
    try {
      const db = await getDB();
      const exists = await db.get('favorites', toolId);
      if (exists) {
        await db.delete('favorites', toolId);
        return false;
      } else {
        await db.put('favorites', { toolId, addedAt: Date.now() });
        return true;
      }
    } catch {
      return false;
    }
  },

  // Signatures
  async getSignatures(): Promise<SavedSignature[]> {
    try {
      const db = await getDB();
      return await db.getAll('savedSignatures');
    } catch {
      return [];
    }
  },

  async saveSignature(sig: SavedSignature): Promise<void> {
    try {
      const db = await getDB();
      await db.put('savedSignatures', sig);
    } catch (e) {
      console.warn('Failed to save signature', e);
    }
  },

  async deleteSignature(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('savedSignatures', id);
    } catch (e) {
      console.warn('Failed to delete signature', e);
    }
  },

  // Stamps
  async getSavedStamps(): Promise<SavedStamp[]> {
    try {
      const db = await getDB();
      return await db.getAll('savedStamps');
    } catch {
      return [];
    }
  },

  async saveStamp(stamp: SavedStamp): Promise<void> {
    try {
      const db = await getDB();
      await db.put('savedStamps', stamp);
    } catch (e) {
      console.warn('Failed to save stamp', e);
    }
  },

  // Drafts
  async saveDraft(draft: SavedDraft): Promise<void> {
    try {
      const db = await getDB();
      await db.put('drafts', draft);
    } catch (e) {
      console.warn('Failed to save draft', e);
    }
  },

  async getDraft(id: string): Promise<SavedDraft | undefined> {
    try {
      const db = await getDB();
      return await db.get('drafts', id);
    } catch {
      return undefined;
    }
  },

  async getAllDrafts(): Promise<SavedDraft[]> {
    try {
      const db = await getDB();
      const all = await db.getAllFromIndex('drafts', 'by-modified');
      return all.reverse();
    } catch {
      return [];
    }
  },

  async deleteDraft(id: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete('drafts', id);
    } catch (e) {
      console.warn('Failed to delete draft', e);
    }
  },

  // Clear all local data (for user privacy control)
  async clearAllData(): Promise<void> {
    try {
      const db = await getDB();
      await db.clear('preferences');
      await db.clear('recentTools');
      await db.clear('recentFiles');
      await db.clear('savedSignatures');
      await db.clear('savedStamps');
      await db.clear('drafts');
      await db.clear('favorites');
    } catch (e) {
      console.error('Failed to clear local data', e);
    }
  },
};
