"use client";
// hooks/useLocalJournal.ts
// CRUD for journal entries stored only on this device (IndexedDB), encrypted with the
// signed-in Clerk user's device key. There are no fetch/network calls in this hook.

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { getLocalDb, requestPersistentStorage } from "@/lib/localDb";
import { decryptEntry, encryptEntry } from "@/lib/localCrypto";

export interface JournalEntry {
  id: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export function useLocalJournal() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setReady(false);
      return;
    }
    let active = true;
    // Ask the browser to keep this data; result isn't needed to continue.
    requestPersistentStorage().finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn]);

  const requireUser = useCallback((): string => {
    if (!isLoaded || !isSignedIn || !userId) throw new Error("Please sign in to use your journal.");
    return userId;
  }, [isLoaded, isSignedIn, userId]);

  /** Creates or updates an entry. Content and tags are encrypted before they touch storage. */
  const saveEntry = useCallback(
    async (id: string, content: string, tags: string[] = []): Promise<void> => {
      const uid = requireUser();
      if (!id) throw new Error("An entry id is required.");
      const db = getLocalDb();
      const now = Date.now();
      const { iv, ciphertext } = await encryptEntry(uid, id, { content, tags });
      await db.transaction("rw", db.journals, async () => {
        const existing = await db.journals.get([uid, id]);
        await db.journals.put({
          id,
          userId: uid,
          iv,
          ciphertext,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      });
    },
    [requireUser],
  );

  /** Returns one decrypted entry, or null if it doesn't exist for this user. */
  const getEntry = useCallback(
    async (id: string): Promise<JournalEntry | null> => {
      const uid = requireUser();
      const rec = await getLocalDb().journals.get([uid, id]);
      if (!rec) return null;
      const { content, tags } = await decryptEntry(uid, rec.id, rec.iv, rec.ciphertext);
      return { id: rec.id, content, tags, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
    },
    [requireUser],
  );

  /** Returns all of this user's entries, newest first, decrypted in memory only. */
  const getAllEntries = useCallback(async (): Promise<JournalEntry[]> => {
    const uid = requireUser();
    const recs = await getLocalDb()
      .journals.where("[userId+updatedAt]")
      .between([uid, -Infinity], [uid, Infinity])
      .reverse()
      .toArray();
    const out: JournalEntry[] = [];
    for (const rec of recs) {
      try {
        const { content, tags } = await decryptEntry(uid, rec.id, rec.iv, rec.ciphertext);
        out.push({ id: rec.id, content, tags, createdAt: rec.createdAt, updatedAt: rec.updatedAt });
      } catch {
        // Skip entries that can't be unlocked (for example, a damaged record). No details are logged.
      }
    }
    return out;
  }, [requireUser]);

  /** Permanently deletes one entry from this device. */
  const deleteEntry = useCallback(
    async (id: string): Promise<void> => {
      const uid = requireUser();
      await getLocalDb().journals.delete([uid, id]);
    },
    [requireUser],
  );

  return { ready: ready && !!userId, saveEntry, getEntry, getAllEntries, deleteEntry };
}
