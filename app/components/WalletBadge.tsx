"use client";

import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

export default function WalletBadge() {
  const [balance, setBalance] = useState(0);
  const [coins, setCoins] = useState(0);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const unsubscribeDoc = onSnapshot(
          doc(db, "users", currentUser.uid),
          (doc) => {
            if (doc.exists()) {
              setBalance(doc.data().walletBalance || 0);
              setCoins(doc.data().coinBalance || 0); // 🔥 Ensure this matches your database field
            }
          },
        );
        return () => unsubscribeDoc();
      } else {
        setUser(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  if (!user) return null;

  return (
    <Link
      href="/gifts"
      className="flex items-center gap-2 bg-[#1a1a1a] border border-purple-500/30 rounded-full px-3 py-1.5 hover:bg-[#222] transition group shadow-lg shadow-purple-500/5"
    >
      <div className="text-purple-400 text-lg group-hover:scale-110 transition">
        🪙
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">
          Coins
        </span>
        <span className="text-sm font-bold text-white">
          {coins.toLocaleString()}
        </span>
      </div>
    </Link>
  );
}
