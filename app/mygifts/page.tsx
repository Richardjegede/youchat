"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Gift Catalog
const GIFT_CATALOG: any = {
  rose: { name: "Rose", icon: "🌹", price: 100, coins: 10 },
  flower: { name: "Flower Bouquet", icon: "💐", price: 500, coins: 50 },
  heart: { name: "Heart", icon: "❤️", price: 1000, coins: 100 },
  crown: { name: "Crown", icon: "", price: 5000, coins: 500 },
  diamond: { name: "Diamond", icon: "💎", price: 10000, coins: 1000 },
  car: { name: "Luxury Car", icon: "🏎️", price: 50000, coins: 5000 },
  mansion: { name: "Mansion", icon: "🏰", price: 100000, coins: 10000 },
};

export default function MyGifts() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myGifts, setMyGifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingGift, setSendingGift] = useState(false);
  const [selectedGift, setSelectedGift] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchMyGifts(currentUser.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMyGifts = async (uid: string) => {
    try {
      const giftsQuery = query(
        collection(db, "gifts"),
        where("senderId", "==", uid),
      );
      const giftsSnap = await getDocs(giftsQuery);
      const giftsData = giftsSnap.docs.map((d) => d.data());

      // Count how many of each gift they have
      const giftCounts: any = {};
      giftsData.forEach((gift: any) => {
        if (!gift.sent) {
          // Only count gifts that haven't been sent yet
          giftCounts[gift.giftId] = (giftCounts[gift.giftId] || 0) + 1;
        }
      });

      // Convert to array with counts
      const myGiftsArray = Object.keys(giftCounts).map((giftId) => ({
        giftId,
        ...GIFT_CATALOG[giftId],
        count: giftCounts[giftId],
      }));

      setMyGifts(myGiftsArray);
    } catch (err) {
      console.error("Error fetching gifts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendGift = async (gift: any, recipientId: string) => {
    if (!user) return;

    setSendingGift(true);
    try {
      // 1. Find an unsent gift from this user
      const giftsQuery = query(
        collection(db, "gifts"),
        where("senderId", "==", user.uid),
        where("giftId", "==", gift.giftId),
        where("sent", "==", false),
      );
      const giftsSnap = await getDocs(giftsQuery);

      if (giftsSnap.empty) {
        alert("No gifts available to send!");
        return;
      }

      const giftDoc = giftsSnap.docs[0];
      const giftData = giftDoc.data();

      // 2. Mark it as sent and assign to recipient
      await updateDoc(doc(db, "gifts", giftDoc.id), {
        sent: true,
        recipientId: recipientId,
        sentAt: new Date().toISOString(),
      });

      // 3. Add to recipient's wallet (70% of gift value)
      const creatorEarnings = gift.price * 0.7;
      const recipientRef = doc(db, "users", recipientId);
      await updateDoc(recipientRef, {
        walletBalance: increment(creatorEarnings),
        totalGiftsReceived: increment(1),
      });

      alert(`✅ Sent ${gift.icon} ${gift.name} successfully!`);
      fetchMyGifts(user.uid); // Refresh the list
    } catch (err) {
      console.error("Error sending gift:", err);
      alert("Failed to send gift");
    } finally {
      setSendingGift(false);
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
        <h1 className="text-3xl font-bold mb-2">🎁 My Gifts</h1>
        <p className="text-gray-400">
          Send your purchased gifts to support creators
        </p>

        {myGifts.length === 0 ? (
          <div className="text-center py-16 bg-[#111] border border-gray-800 rounded-2xl mt-8">
            <p className="text-gray-400 mb-4">
              You haven't purchased any gifts yet.
            </p>
            <button
              onClick={() => router.push("/gifts")}
              className="bg-cyan-500 text-black font-bold px-6 py-3 rounded-full hover:bg-cyan-400 transition"
            >
              Buy Gifts Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mt-8">
            {myGifts.map((gift) => (
              <div
                key={gift.giftId}
                className="bg-[#111] border border-gray-800 rounded-2xl p-6 text-center"
              >
                <div className="text-6xl mb-3">{gift.icon}</div>
                <h3 className="font-bold text-lg mb-2">{gift.name}</h3>
                <p className="text-cyan-400 font-bold mb-4">
                  Owned: {gift.count}
                </p>
                <button
                  onClick={() => setSelectedGift(gift)}
                  disabled={sendingGift}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 rounded-xl hover:scale-105 transition disabled:opacity-50"
                >
                  Send Gift
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SEND GIFT MODAL */}
      {selectedGift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="text-6xl mb-3">{selectedGift.icon}</div>
              <h2 className="text-2xl font-bold mb-2">
                Send {selectedGift.name}
              </h2>
              <p className="text-gray-400">
                You have {selectedGift.count} of this gift
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                Recipient's Username or User ID
              </label>
              <input
                type="text"
                placeholder="Enter username"
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                id="recipientInput"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedGift(null)}
                className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const recipientId = (
                    document.getElementById(
                      "recipientInput",
                    ) as HTMLInputElement
                  ).value;
                  if (recipientId) {
                    await handleSendGift(selectedGift, recipientId);
                    setSelectedGift(null);
                  } else {
                    alert("Please enter a recipient");
                  }
                }}
                disabled={sendingGift}
                className="flex-1 bg-cyan-500 text-black py-3 rounded-xl font-bold disabled:opacity-50"
              >
                {sendingGift ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
