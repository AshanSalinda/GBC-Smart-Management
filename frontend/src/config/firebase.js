import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Parse the JSON string from the environment variable
const configString = import.meta.env.VITE_FIREBASE_CONFIG || '{}';
const firebaseConfig = JSON.parse(configString);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Force the account selection prompt to ensure users can switch accounts if needed
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
