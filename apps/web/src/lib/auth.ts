import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();

export const subscribeToAuth = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

export const signInWithGoogle = async () => (await signInWithPopup(auth, googleProvider)).user;

export const logout = () => signOut(auth);

export const getAuthToken = () => auth.currentUser?.getIdToken() ?? Promise.resolve(null);
