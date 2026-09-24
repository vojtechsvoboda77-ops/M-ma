/**
 * CareMom - Firebase Cloud Realtime Sync Configuration
 * Paste your free Firebase config keys below from https://console.firebase.google.com
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDuPHFcXSI6t3WAI83II9MtzPvzcC7I9qY",
  authDomain: "pece-o-maminku.firebaseapp.com",
  projectId: "pece-o-maminku",
  storageBucket: "pece-o-maminku.firebasestorage.app",
  messagingSenderId: "855219417985",
  appId: "1:855219417985:web:149bf82a680fd4066f6e80",
  measurementId: "G-F97PS0FE1J"
};

// Auto-initialize Firebase if credentials are populated
window.firebaseEnabled = false;

if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    window.dbFirestore = firebase.firestore();
    window.firebaseEnabled = true;
    console.log("🔥 Firebase Live Sync connected successfully!");
  } catch (err) {
    console.error("Firebase init error:", err);
  }
}
