import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Firebase Web config is client-side configuration. Environment values are
  // preferred, but these project values keep the production static build
  // functional if the host does not inject Vite build variables.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB7NZtzZ8ZRTmQV1hT88Mpp6YWHPFnyK9c",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mybusiness-d48d1.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mybusiness-d48d1",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mybusiness-d48d1.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "414376220106",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:414376220106:web:2530bc27aedc9009e02b33",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
