"use client";

import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

const GIFT_CATALOG = [
  { id: "data", name: "Data Bundle", icon: "📱", price: 500, coins: 50 },
  { id: "kolanut", name: "Kola Nut", icon: "🌰", price: 500, coins: 50 },
  { id: "indomie", name: "Indomie Pack", icon: "🍜", price: 1000, coins: 100 },
  { id: "jollof", name: "Jollof Rice", icon: "🍛", price: 1000, coins: 100 },
  {
    id: "transport",
    name: "Transport Fare",
    icon: "🚌",
    price: 1000,
    coins: 100,
  },
  { id: "chapman", name: "Chapman", icon: "🥤", price: 1000, coins: 100 },
  { id: "handouts", name: "Handouts", icon: "📚", price: 1000, coins: 100 },
  { id: "health", name: "Health", icon: "💊", price: 1000, coins: 100 },
  { id: "fuel", name: "Generator Fuel", icon: "⛽", price: 2000, coins: 200 },
  { id: "allowance", name: "Allowance", icon: "💲", price: 5000, coins: 500 },
  { id: "support", name: "Support", icon: "🎁", price: 10000, coins: 1000 },
  { id: "rent", name: "Rent", icon: "🏡", price: 20000, coins: 2000 },
  {
    id: "schoolfees",
    name: "School Fees",
    icon: "💵",
    price: 50000,
    coins: 5000,
  },
  { id: "laptop", name: "Laptop", icon: "💻", price: 70000, coins: 7000 },
  {
    id: "scholarship",
    name: "Scholarship",
    icon: "🎓",
    price: 100000,
    coins: 10000,
  },
];

export default function GiftSelectorModal({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  postId,
}: any) {
  const [userCoins, setUserCoins] = useState(0);
  const [sending, setSending] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      const fetchCoins = async () => {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          setUserCoins(userDoc.data().coinBalance || 0);
        }
      };
      fetchCoins();
    }
  }, [isOpen]);

  const handleSelectGift = async (gift: any) => {
    if (!auth.currentUser) {
      alert("Please log in to send gifts.");
      return;
    }

    if (userCoins < gift.coins) {
      if (
        confirm(
          `You need ${gift.coins} coins to send ${gift.name}. Go to store to buy more?`,
        )
      ) {
        window.location.href = "/gifts";
      }
      return;
    }

    setSending(true);
    try {
      const senderId = auth.currentUser.uid;
      const senderName = isAnonymous
        ? "Anonymous Supporter"
        : auth.currentUser.displayName || "A Supporter";

      // 1. Deduct BOTH coins AND the Naira value from sender
      await updateDoc(doc(db, "users", senderId), {
        coinBalance: increment(-gift.coins),
        walletBalance: increment(-gift.price),
      });
      setUserCoins((prev) => prev - gift.coins);

      // 🔥 LOG SENDER TRANSACTION
      await addDoc(collection(db, "transactions"), {
        userId: senderId,
        type: "gift_sent",
        amount: gift.price,
        coins: gift.coins,
        description: `Sent ${gift.name} to ${recipientName}`,
        status: "completed",
        createdAt: serverTimestamp(),
      });

      // 2. Add 70% CASH to the recipient's wallet
      const creatorEarnings = gift.price * 0.7;
      await updateDoc(doc(db, "users", recipientId), {
        walletBalance: increment(creatorEarnings),
      });

      // 🔥 LOG RECEIVER TRANSACTION
      await addDoc(collection(db, "transactions"), {
        userId: recipientId,
        type: "gift_received",
        amount: creatorEarnings,
        description: `Received ${gift.name} from ${senderName}`,
        status: "completed",
        createdAt: serverTimestamp(),
      });

      // 3. ADD +1 GIFT COUNT TO THE SPECIFIC POST
      if (postId) {
        await updateDoc(doc(db, "feed", postId), {
          giftCount: increment(1),
        });
      }

      // 4. Record the gift in the database
      await addDoc(collection(db, "gifts"), {
        senderId,
        senderName,
        recipientId,
        postId,
        giftId: gift.id,
        giftName: gift.name,
        giftIcon: gift.icon,
        price: gift.price,
        coins: gift.coins,
        isAnonymous,
        createdAt: serverTimestamp(),
      });

      // 5. Notifications
      // Notification for the Receiver
      await addDoc(collection(db, "notifications"), {
        userId: recipientId,
        actorUid: senderId,
        type: "gift",
        message: `sent you a ${gift.icon} ${gift.name}!`,
        read: false,
        createdAt: serverTimestamp(),
      });

      // 🔥 FIXED: Notification for the Sender (Point actorUid to senderId)
      await addDoc(collection(db, "notifications"), {
        userId: senderId,
        actorUid: senderId, // ✅ Changed from recipientId to senderId
        type: "gift_sent",
        message: `You successfully sent a ${gift.icon} ${gift.name} to ${recipientName}.`,
        read: false,
        createdAt: serverTimestamp(),
      });
      alert(`🎉 You sent a ${gift.icon} ${gift.name} to ${recipientName}!`);
      onClose();
    } catch (err) {
      console.error("Error sending gift:", err);
      alert("Failed to send gift.");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#151515] w-full max-w-2xl rounded-t-3xl border-t border-gray-800 p-6 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Send a Gift</h2>
            <p className="text-gray-400 text-sm">
              Support {recipientName || "this creator"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-purple-600 to-cyan-600 px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
              <span className="text-xl">🪙</span>
              <span className="font-bold text-white text-lg">{userCoins}</span>
            </div>
            <button
              onClick={() => (window.location.href = "/gifts")}
              className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-2 rounded-full transition"
            >
              + Buy
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6 bg-[#1a1a1a] p-3 rounded-xl border border-gray-800">
          <input
            type="checkbox"
            id="anonymous"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="w-5 h-5 accent-cyan-500"
          />
          <label
            htmlFor="anonymous"
            className="text-gray-300 text-sm cursor-pointer"
          >
            Send as <span className="text-cyan-400 font-bold">Anonymous</span>
          </label>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {GIFT_CATALOG.map((gift) => {
            const canAfford = userCoins >= gift.coins;
            return (
              <button
                key={gift.id}
                onClick={() => handleSelectGift(gift)}
                disabled={sending || !canAfford}
                className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${canAfford ? "bg-[#1a1a1a] border-gray-700 hover:border-cyan-400 hover:scale-105 active:scale-95" : "bg-[#111] border-gray-800 opacity-50 cursor-not-allowed"}`}
              >
                <div className="text-4xl mb-2">{gift.icon}</div>
                <p className="text-white text-xs font-semibold text-center leading-tight mb-1">
                  {gift.name}
                </p>
                <div
                  className={`text-xs font-bold flex items-center gap-1 ${canAfford ? "text-purple-400" : "text-gray-500"}`}
                >
                  <span>🪙</span> {gift.coins}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-[#222] text-gray-400 font-bold rounded-xl hover:bg-[#333] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
