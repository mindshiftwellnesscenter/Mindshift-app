// lib/localCrypto.ts
// Local encryption with the browser's built-in Web Crypto API. No keys or text leave the device.
//
// How it works
// - Each signed-in user gets a random 256-bit AES-GCM key, created on this device the first
//   time they save. It is created as NON-EXTRACTABLE, so no script (including ours) can read
//   or export the raw key; the browser can only use it to encrypt/decrypt on this device.
// - Every entry is encrypted with a fresh random 12-byte IV.
// - The Clerk user id and entry id are bound in as "additional authenticated data" (AAD).
//   If a record were copied to another profile, or its id changed, decryption fails.
//
// SECURITY: never log plaintext, keys, or decrypted objects from this file.

import { getLocalDb } from "./localDb";

export interface EntryPayload {
  content: string;
  tags: string[];
}

const enc = new TextEncoder();
const dec = new TextDecoder();

// In-memory cache so we don't hit IndexedDB for the key on every save. Cleared on sign-out.
const keyCache = new Map<string, CryptoKey>();

export function clearKeyCache(): void {
  keyCache.clear();
}

function assertCrypto(): SubtleCrypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Secure encryption isn't available in this browser. Use a current browser over HTTPS.");
  }
  return window.crypto.subtle;
}

/** Gets this user's device key, creating it on first use. */
export async function getOrCreateUserKey(userId: string): Promise<CryptoKey> {
  if (!userId) throw new Error("Not signed in.");
  const cached = keyCache.get(userId);
  if (cached) return cached;

  const subtle = assertCrypto();
  const db = getLocalDb();

  let key: CryptoKey;
  const existing = await db.keys.get(userId);
  if (existing) {
    key = existing.key;
  } else {
    // Generate outside the database transaction (IndexedDB transactions can't wait on crypto).
    const created = await subtle.generateKey({ name: "AES-GCM", length: 256 }, false /* non-extractable */, [
      "encrypt",
      "decrypt",
    ]);
    // Store it unless another tab created one first; either way, use the stored key.
    key = await db.transaction("rw", db.keys, async () => {
      const again = await db.keys.get(userId);
      if (again) return again.key;
      await db.keys.put({ userId, key: created, createdAt: Date.now() });
      return created;
    });
  }

  keyCache.set(userId, key);
  return key;
}

function aad(userId: string, entryId: string): Uint8Array {
  return enc.encode(`JournalAppDB|v1|${userId}|${entryId}`);
}

export async function encryptEntry(
  userId: string,
  entryId: string,
  payload: EntryPayload,
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const subtle = assertCrypto();
  const key = await getOrCreateUserKey(userId);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad(userId, entryId) as BufferSource },
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return { iv, ciphertext };
}

export async function decryptEntry(
  userId: string,
  entryId: string,
  iv: Uint8Array,
  ciphertext: ArrayBuffer,
): Promise<EntryPayload> {
  const subtle = assertCrypto();
  const key = await getOrCreateUserKey(userId);
  let plain: ArrayBuffer;
  try {
    plain = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad(userId, entryId) as BufferSource },
      key,
      ciphertext,
    );
  } catch {
    // Deliberately generic: never include entry data in errors.
    throw new Error("This entry couldn't be unlocked on this device.");
  }
  const parsed = JSON.parse(dec.decode(plain)) as Partial<EntryPayload>;
  return { content: String(parsed.content ?? ""), tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [] };
}
