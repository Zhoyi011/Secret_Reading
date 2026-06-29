import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigDefault from '../firebase-applet-config.json';

// Support custom configuration via VITE_ environment variables with fallback to user's custom project keys
const env = (import.meta as any).env || {};
const defaultConfig = firebaseConfigDefault as any;
const customConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || defaultConfig.apiKey || "AIzaSyDt-JP_yIy2amy_SJjpV7RawDf8yR9wLmw",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || defaultConfig.authDomain || "secret-reading.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || defaultConfig.projectId || "secret-reading",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || defaultConfig.storageBucket || "secret-reading.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultConfig.messagingSenderId || "1071172219377",
  appId: env.VITE_FIREBASE_APP_ID || defaultConfig.appId || "1:1071172219377:web:7998d9fb76bbb9303f1450",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || defaultConfig.measurementId || "G-ZTVQP3G9YX",
  firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || defaultConfig.firestoreDatabaseId || "(default)"
};

const app = initializeApp(customConfig);
const dbId = customConfig.firestoreDatabaseId && customConfig.firestoreDatabaseId !== "(default)" ? customConfig.firestoreDatabaseId : undefined;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);
export const auth = getAuth(app);

// Connectivity testing requirement from Firebase Integration Skill:
async function testConnection() {
  try {
    // Tests connection to server
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration; client appears to be offline.", error);
    }
  }
}
testConnection();

// Error Handling Infrastructure from Firebase Integration Skill:
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
