"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore"; // 🔥 ALREADY HAS IMPORTS
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export default function GiftStore() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState("");
  const [convertAmount, setConvertAmount] = useState("");
  const [converting, setConverting] = useState(false);

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
        setCoinBalance(userDoc.data().coinBalance || 0);
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

  const handleConvertToCoins = async () => {
    const amount = parseInt(convertAmount);

    if (!amount || amount < 1000) {
      alert("Minimum conversion is ₦1,000");
      return;
    }

    if (amount > walletBalance) {
      alert("Insufficient wallet balance");
      return;
    }

    if (
      !confirm(
        `⚠️ WARNING: This will convert ₦${amount.toLocaleString()} from your withdrawable wallet to coins.\n\nThis action is IRREVERSIBLE. You will NOT be able to withdraw this amount to your bank account.\n\nDo you want to continue?`,
      )
    ) {
      return;
    }

    setConverting(true);
    try {
      const coinsToAdd = amount / 10;

      await updateDoc(doc(db, "users", user.uid), {
        walletBalance: increment(-amount),
        coinBalance: increment(coinsToAdd),
      });

      // 🔥 LOG THE CONVERSION TRANSACTION
      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type: "conversion",
        amount: amount,
        coins: coinsToAdd,
        description: "Converted wallet balance to coins",
        status: "completed",
        createdAt: serverTimestamp(),
      });

      // 🔥 FORCE UI TO REFRESH FROM DATABASE (No more ghost numbers!)
      await fetchWallet(user.uid);
      setConvertAmount("");

      alert(
        `✅ Successfully converted ₦${amount.toLocaleString()} to ${coinsToAdd.toLocaleString()} coins!`,
      );
    } catch (err) {
      console.error("Conversion error:", err);
      alert("Failed to convert. Please try again.");
    } finally {
      setConverting(false);
    }
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
          Support An African student by sending gifts to ease the struggle
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
              </p>
            </div>
          </div>

          <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔄</span>
              <h3 className="font-bold text-lg">Convert Wallet to Coins</h3>
            </div>
            <p className="text-xs text-gray-300 mb-3">
              Convert your withdrawable cash to coins for gifting.{" "}
              <span className="text-yellow-400 font-bold">
                This is irreversible!
              </span>
            </p>
            <div className="flex gap-3">
              <input
                type="number"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="Enter amount (Min ₦1,000)"
                className="flex-1 bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                min="1000"
              />
              <button
                onClick={handleConvertToCoins}
                disabled={
                  converting || !convertAmount || parseInt(convertAmount) < 1000
                }
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {converting ? "Converting..." : "Convert"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Rate: ₦10 = 1 coin • Min: ₦1,000 (100 coins)
            </p>
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
              Buy Coins with Card (Min ₦1,000)
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

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">🎁 Popular Gifts</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111] border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">📱</div>
              <p className="font-bold">Data Bundle</p>
              <p className="text-cyan-400 text-sm">₦500 (50 coins)</p>
            </div>
            <div className="bg-[#111] border border-gray-800 rounded-xl p-4 text-center">
              <div className="text-4xl mb-2">🎓</div>
              <p className="font-bold">Scholarship</p>
              <p className="text-cyan-400 text-sm">₦100,000 (10,000 coins)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
