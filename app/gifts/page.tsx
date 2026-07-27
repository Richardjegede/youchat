"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function GiftStore() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0); // 🔥 REAL COIN STATE
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchWallet(currentUser.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchWallet = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setWalletBalance(userDoc.data().walletBalance || 0);
        setCoinBalance(userDoc.data().coinBalance || 0); // 🔥 READ REAL COINS
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoins = async (amount: number) => {
    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          amount: amount * 100,
          metadata: { type: "coins_purchase", userId: user.uid },
        }),
      });

      const data = await response.json();
      if (data.status && data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert("Failed to initialize payment");
      }
    } catch (err) {
      console.error(err);
      alert("Payment error");
    }
  };

  const handleCustomAmount = () => {
    const amount = parseInt(customAmount);
    if (amount < 1000) {
      alert("Minimum amount is ₦1,000");
      return;
    }
    handleAddCoins(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">Buy Gifts</h1>
        <p className="text-gray-400">
          Support African students by sending gifts to your favorite creators
        </p>

        <div className="bg-gradient-to-r from-purple-600 to-cyan-600 rounded-2xl p-6 mt-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-sm text-gray-200 mb-1">Your Wallet Balance</p>
              <p className="text-4xl font-bold">
                ₦{walletBalance.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-200 mb-1">Coins</p>
              <p className="text-2xl font-bold">
                🪙 {coinBalance.toLocaleString()}
              </p>{" "}
              {/* 🔥 DISPLAY REAL COINS */}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => handleAddCoins(2000)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm py-3 rounded-xl font-bold transition"
            >
              ₦2,000
            </button>
            <button
              onClick={() => handleAddCoins(5000)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm py-3 rounded-xl font-bold transition"
            >
              ₦5,000
            </button>
            <button
              onClick={() => handleAddCoins(10000)}
              className="bg-white/20 hover:bg-white/30 backdrop-blur-sm py-3 rounded-xl font-bold transition"
            >
              ₦10,000
            </button>
          </div>

          <div className="bg-black/30 rounded-xl p-4 border border-white/10">
            <label className="block text-sm text-gray-300 mb-2">
              Custom Amount (Min ₦1,000)
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Enter amount (e.g., 20000)"
                className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                min="1000"
              />
              <button
                onClick={handleCustomAmount}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-3 rounded-xl transition"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
