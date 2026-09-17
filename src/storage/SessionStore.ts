import type { SquatRep, StoredMetricsFrame, WorkoutSession } from '../types';
import { openDatabase, transactionRequest } from './db';

export class SessionStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private db() { return this.dbPromise ?? (this.dbPromise = openDatabase()); }
  async create(session: WorkoutSession): Promise<void> { await transactionRequest(await this.db(), 'readwrite', store => store.add(session)); }
  async save(session: WorkoutSession): Promise<void> { await transactionRequest(await this.db(), 'readwrite', store => store.put(session)); }
  async update(session: WorkoutSession): Promise<void> { return this.save(session); }
  async get(id: string): Promise<WorkoutSession | undefined> { return transactionRequest(await this.db(), 'readonly', store => store.get(id)); }
  async list(): Promise<WorkoutSession[]> { return transactionRequest(await this.db(), 'readonly', store => store.getAll()); }
  async delete(id: string): Promise<void> { await transactionRequest(await this.db(), 'readwrite', store => store.delete(id)); }
  async addRep(id: string, rep: SquatRep): Promise<WorkoutSession> {
    const session = await this.get(id); if (!session) throw new Error('セッションが見つかりません。');
    const next = { ...session, reps: [...session.reps, rep] }; await this.save(next); return next;
  }
  async appendFrame(id: string, frame: StoredMetricsFrame): Promise<WorkoutSession> {
    const session = await this.get(id); if (!session) throw new Error('セッションが見つかりません。');
    const next = { ...session, frames: [...(session.frames ?? []), frame] }; await this.save(next); return next;
  }
}

export const sessionStore = new SessionStore();
export default sessionStore;
