// lib/localDb.ts
// On-device database (IndexedDB via Dexie). Nothing in this file talks to a server.
// Journal text and tags are stored ONLY as AES-GCM ciphertext; see lib/localCrypto.ts.

import Dexie, { type Table } from "dexie";

/** One encrypted journal entry as it sits in IndexedDB. */
export interface JournalRecord {
  /** Entry id chosen by the app (e.g. crypto.randomUUID()). */
  id: string;
  /** Clerk user id that owns this entry. */
  userId: string;
  /** 12-byte random nonce used for this encryption. */
  iv: Uint8Array;
  /** Encrypted JSON of { content, tags }. Never stored in plain text. */
  ciphertext: ArrayBuffer;
  createdAt: number;
  updatedAt: number;
}

/** One device-bound encryption key per signed-in user. */
export interface KeyRecord {
  userId: string;
  /** Non-extractable AES-GCM key: it can be used on this device but never exported or read. */
  key: CryptoKey;
  createdAt: number;
}

export class JournalAppDB extends Dexie {
  journals!: Table<JournalRecord, [string, string]>;
  keys!: Table<KeyRecord, string>;

  constructor() {
    super("JournalAppDB");
    this.version(1).stores({
      // Primary key is the pair [userId+id], so two people on one device can never collide.
      // Indexed: id, userId, updatedAt, plus [userId+updatedAt] for fast "newest first" lists.
      journals: "[userId+id], id, userId, updatedAt, [userId+updatedAt]",
      keys: "userId",
    });
  }
}

let db: JournalAppDB | null = null;

/** Browser-only accessor. Throws if called during server rendering. */
export function getLocalDb(): JournalAppDB {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("The local journal is only available in the browser.");
  }
  if (!db) db = new JournalAppDB();
  return db;
}

/**
 * Ask the browser not to evict this site's storage when the device is low on space.
 * Safari may still clear data for sites that haven't been used in a while unless the
 * app is added to the Home Screen, so tell users about that in onboarding.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Not supported: fall through.
  }
  return false;
}

/** Permanently removes every entry and the key for one user on this device. */
export async function wipeUserData(userId: string): Promise<void> {
  const d = getLocalDb();
  await d.transaction("rw", d.journals, d.keys, async () => {
    await d.journals.where("userId").equals(userId).delete();
    await d.keys.delete(userId);
  });
}
