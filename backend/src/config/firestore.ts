import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseConfig: any = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0601161839',
  appId: process.env.FIREBASE_APP_ID || '1:364065285265:web:ba030714cbe301c15d8b30',
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyA0zvH9Bbq5Zkv0BwlHME_a9sbB-R27NnM',
  authDomain: 'gen-lang-client-0601161839.firebaseapp.com',
  firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || 'ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072',
  storageBucket: 'gen-lang-client-0601161839.firebasestorage.app',
  messagingSenderId: '364065285265',
  measurementId: '',
  oAuthClientId: '364065285265-n0b02d7id11tiuht9nnfpfcf37jb5k4b.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

const candidatePaths = [
  path.resolve(process.cwd(), 'firebase-applet-config.json'),
  path.resolve(__dirname, '../../../firebase-applet-config.json'),
  path.resolve(__dirname, '../../firebase-applet-config.json'),
  path.resolve(__dirname, '../firebase-applet-config.json'),
  '/app/firebase-applet-config.json',
];

for (const p of candidatePaths) {
  try {
    if (fs.existsSync(p)) {
      const fileData = JSON.parse(fs.readFileSync(p, 'utf8'));
      firebaseConfig = { ...firebaseConfig, ...fileData };
      break;
    }
  } catch (_e) {}
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export default firestore;

