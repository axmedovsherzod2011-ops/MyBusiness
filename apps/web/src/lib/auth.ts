import {
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";
import { apiFetch } from "./api";

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");

export const subscribeToAuth = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback);

export const signInWithGoogle = async () => (await signInWithPopup(auth, googleProvider)).user;
export const signInWithApple = async () => (await signInWithPopup(auth, appleProvider)).user;

export const signUpWithEmail = async (email: string, password: string) =>
  (await createUserWithEmailAndPassword(auth, email, password)).user;

export const signInWithEmail = async (email: string, password: string) =>
  (await signInWithEmailAndPassword(auth, email, password)).user;

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);

export const getAuthToken = () =>
  auth.currentUser?.getIdToken() ?? Promise.resolve(null);

export async function syncCurrentUser() {
  const token = await getAuthToken();
  if (!token) return null;

  return apiFetch<{ user: {
    id: string;
    firebaseUid: string;
    fullName: string;
    email: string | null;
    status: string;
    companyId: string;
  } }>("/api/v1/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}


export function getAuthErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String((error as any).code) : "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Неверная электронная почта или пароль.",
    "auth/invalid-email": "Укажите корректный адрес электронной почты.",
    "auth/email-already-in-use": "Этот адрес электронной почты уже используется.",
    "auth/weak-password": "Пароль слишком простой. Используйте более надёжный пароль.",
    "auth/user-not-found": "Пользователь с таким адресом не найден.",
    "auth/wrong-password": "Неверный пароль.",
    "auth/popup-closed-by-user": "Окно авторизации было закрыто.",
    "auth/popup-blocked": "Браузер заблокировал окно авторизации.",
    "auth/network-request-failed": "Не удалось подключиться к серверу. Проверьте интернет-соединение.",
    "auth/too-many-requests": "Слишком много попыток. Повторите позже.",
  };
  return messages[code] || "Не удалось выполнить авторизацию. Попробуйте ещё раз.";
}
