import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// PASTE YOUR COPIED KEYS HERE! (Make sure you keep your real keys from Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyCz7FqkC_rgST05Y_2IjxjajUye3vx0oJI",
  authDomain: "youbuy-43eb6.firebaseapp.com",
  projectId: "youbuy-43eb6",
  storageBucket: "youbuy-43eb6.firebasestorage.app",
  messagingSenderId: "235806946505",
  appId: "1:235806946505:web:b221fae3beb46cfb2ac918",
  measurementId: "G-M14XZGYCXW",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
