import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { env } from "../config.js";

let firebaseAdminAuth: Auth | undefined;

export function getFirebaseAdminAuth(): Auth {
  if (firebaseAdminAuth) return firebaseAdminAuth;

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.");
  }

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });

  firebaseAdminAuth = getAuth(app);
  return firebaseAdminAuth;
}
