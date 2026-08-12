"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import ProtectedRoute from "../components/ProtectedRoute";

export default function ReferEarn() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchReferralData(currentUser.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchReferralData = async (uid: string) => {
    try {
      // 1. Fetch user's referral code
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const code = userData.referralCode || uid.substring(0, 8).toUpperCase();
        setReferralCode(code);
        setReferralLink(`${window.location.origin}/signup?ref=${code}`);
        setTotalReferrals(userData.totalReferrals || 0);
        setTotalEarned((userData.totalReferrals || 0) * 100); // 100 coins per referral
      }
    } catch (err) {
      console.error("Error fetching referral data:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      alert("✅ Referral link copied! Share it with your friends.");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
        <div className="max-w-2xl mx-auto px-4">
          {/* HEADER */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">🎁 Refer & Earn</h1>
            <p className="text-gray-400">
              Invite friends and earn 100 coins each!
            </p>
          </div>

          {/* REWARD CARD */}
          <div className="bg-gradient-to-r from-purple-600 to-cyan-600 rounded-2xl p-6 mb-8 shadow-2xl">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-black/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-white mb-1">
                  {totalReferrals}
                </p>
                <p className="text-sm text-gray-200">Friends Referred</p>
              </div>
              <div className="bg-black/30 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-white mb-1">
                  🪙 {totalEarned}
                </p>
                <p className="text-sm text-gray-200">Coins Earned</p>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-sm text-gray-200 mb-2">Your Referral Link:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={referralLink}
                  readOnly
                  className="flex-1 bg-black/50 border border-white/20 rounded-lg px-3 py-2 text-xs text-gray-300"
                />
                <button
                  onClick={copyToClipboard}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                    copied
                      ? "bg-green-500 text-white"
                      : "bg-white text-purple-600 hover:bg-gray-100"
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* HOW IT WORKS */}
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">📋 How It Works</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500 text-black font-bold flex items-center justify-center flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">Share Your Link</p>
                  <p className="text-sm text-gray-400">
                    Copy and share your unique referral link with friends
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500 text-black font-bold flex items-center justify-center flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">Friend Signs Up</p>
                  <p className="text-sm text-gray-400">
                    When they register using your link, you both get rewarded
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-cyan-500 text-black font-bold flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Earn 100 Coins</p>
                  <p className="text-sm text-gray-400">
                    Both you and your friend receive 100 coins instantly!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SHARE BUTTONS */}
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4">📤 Share Now</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=Join%20YouChat%20and%20get%20100%20free%20coins!%20Use%20my%20link:%20${referralLink}`,
                    "_blank",
                  )
                }
                className="bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                <span>📱</span> WhatsApp
              </button>
              <button
                onClick={() =>
                  window.open(
                    `https://twitter.com/intent/tweet?text=Join%20YouChat%20and%20get%20100%20free%20coins!%20Use%20my%20link:%20${referralLink}`,
                    "_blank",
                  )
                }
                className="bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                <span>🐦</span> Twitter
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
