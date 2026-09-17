import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDatabase, transactionRequest } from './db';
import { SessionStore } from './SessionStore';
import type { WorkoutSession } from '../types';

function session(id: string): WorkoutSession {
  return {
    id,
    participantId: 'anonymous-test',
    startedAt: 1,
    deviceInfo: { width: 1280, height: 720 },
    calibration: {
      standingHipY: 0.5,
      shoulderWidth: 0.2,
      hipWidth: 0.15,
      ankleWidth: 0.1,
      bodyHeight: 0.8,
      baselineTorsoLean: 0,
      baselineHipShift: 0,
      sampleCount: 3,
    },
    reps: [],
  };
}

describe('SessionStore', () => {
  it('round-trips create, get, and save through IndexedDB', async () => {
    const store = new SessionStore();
    const original = session(`round-trip-${Date.now()}`);
    await store.create(original);
    const loaded = await store.get(original.id);
    expect(loaded).toEqual(original);

    const updated = { ...original, endedAt: 42 };
    await store.save(updated);
    await expect(store.get(original.id)).resolves.toEqual(updated);
  });

  it('rejects when the transaction is aborted before completion', async () => {
    const db = await openDatabase();
    const id = `abort-${Date.now()}`;
    await transactionRequest(db, 'readwrite', objectStore => objectStore.add(session(id)));
    const operation = transactionRequest(db, 'readwrite', objectStore => objectStore.add(session(id)));
    await expect(operation).rejects.toThrow();
    db.close();
  });
});
