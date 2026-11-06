import firestoreAdapter from './firestore-adapter';

// Primary Database Client for QLQTKD backed by Google Cloud Firebase Firestore
const prisma = firestoreAdapter as unknown as any;
export default prisma;
