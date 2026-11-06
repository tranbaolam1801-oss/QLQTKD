import firestoreAdapterInstance, { firestoreAdapter } from './firestore-adapter';
import type { FirestoreAdapter } from './firestore-adapter';

// Primary Database Client for QLQTKD backed by Google Cloud Firebase Firestore
const raw: any = firestoreAdapterInstance || firestoreAdapter;
export const prisma: FirestoreAdapter = (raw?.default || raw) as unknown as any;
export default prisma;

