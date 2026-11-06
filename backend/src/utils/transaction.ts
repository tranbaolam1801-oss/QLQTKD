import prisma from '../config/database';
import type { FirestoreAdapter } from '../config/firestore-adapter';

export type TransactionClient = FirestoreAdapter;

/** Retry only serialization conflicts; callbacks must contain database operations only. */
export async function serializableTransaction<T>(operation: (tx: TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation);
    } catch (error) {
      const errCode = (error as { code?: string })?.code;
      if ((errCode !== 'P2034' && errCode !== 'ABORTED') || attempt >= 2) throw error;
    }
  }
}
