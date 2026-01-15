import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

// Initialize Firebase
initializeApp();

// Export storage instance for use across the app
export const storage = getStorage();