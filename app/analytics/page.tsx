"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WithdrawalModal from "../components/WithdrawalModal";

export default function EarnDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [totalViews, setTotalViews] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [videos, setVideos] = useState<any[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]); // 🔥 NEW STATE

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchCreatorStats(currentUser.uid);
        fetchWithdrawalHistory(currentUser.uid); // 🔥 FETCH HISTORY
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchCreatorStats = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        setWalletBalance(userDoc.data().walletBalance || 0);
      }

      const videosQuery = query(
        collection(db, "videos"),
        where("creatorId", "==", uid),
      );
      const videosSnap = await getDocs(videosQuery);
      const videosData = videosSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setVideos(videosData);

      let views = 0;
      videosData.forEach((video) => {
        views += video.views || 0;
      });
      setTotalViews(views);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NEW FUNCTION: Fetch Withdrawal History (Index-Free!)
  const fetchWithdrawalHistory = async (uid: string) => {
    try {
      // 1. Fetch all withdrawals for this user (No orderBy needed here!)
      const q = query(
        collection(db, "withdrawals"),
        where("userId", "==", uid),
      );
      const snapshot = await getDocs(q);

      // 2. Sort by date in JavaScript (Newest first)
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

      setWithdrawalHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Helper for Status Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-2 py-1 rounded-full text-xs font-bold">
            🟡 Pending
          </span>
        );
      case "paid":
        return (
          <span className="bg-green-500/20 text-green-400 border border-green-500/50 px-2 py-1 rounded-full text-xs font-bold">
            🟢 Paid
          </span>
        );
      case "rejected":
        return (
          <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-2 py-1 rounded-full text-xs font-bold">
            {" "}
            Rejected
          </span>
        );
      default:
        return (
          <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full text-xs font-bold">
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
          <p className="text-gray-400">
            Track your performance and withdraw your funds securely.
          </p>
        </div>

        {/* MAIN WITHDRAWAL CARD */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-800 rounded-2xl p-6 shadow-2xl border border-green-500/20 mb-8">
          <p className="text-green-200 text-sm mb-2">
            Available Balance (Ready to Withdraw)
          </p>
          <h2 className="text-5xl font-bold mb-6">
            ₦{walletBalance.toLocaleString()}
          </h2>

          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full bg-white text-green-700 font-bold py-4 rounded-xl hover:bg-gray-100 transition text-lg shadow-lg"
          >
            💸 Withdraw Funds
          </button>
          <p className="text-green-200/60 text-xs text-center mt-3">
            Min: 3,000 • Max: ₦50,000 per request
          </p>
        </div>

        {/* 🔥 WITHDRAWAL HISTORY SECTION */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          📜 Withdrawal History
        </h2>
        {withdrawalHistory.length === 0 ? (
          <div className="text-center py-8 bg-[#111] border border-gray-800 rounded-2xl mb-8">
            <p className="text-gray-400 text-sm">No withdrawal requests yet.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {withdrawalHistory.map((req) => (
              <div
                key={req.id}
                className="bg-[#111] border border-gray-800 rounded-xl p-4 flex justify-between items-center"
              >
                <div>
                  <p className="text-white font-bold text-lg">
                    ₦{req.amount.toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {req.createdAt?.toDate
                      ? req.createdAt.toDate().toLocaleDateString()
                      : "Just now"}{" "}
                    • {req.bankDetails?.bankName}
                  </p>
                </div>
                {getStatusBadge(req.status)}
              </div>
            ))}
          </div>
        )}

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total Video Views</p>
            <p className="text-3xl font-bold text-cyan-400">
              {totalViews.toLocaleString()}
            </p>
          </div>
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-1">Videos Uploaded</p>
            <p className="text-3xl font-bold text-purple-400">
              {videos.length}
            </p>
          </div>
        </div>

        {/* VIDEO PERFORMANCE LIST */}
        <h2 className="text-xl font-bold mb-4">📊 Video Performance</h2>
        {videos.length === 0 ? (
          <div className="text-center py-12 bg-[#111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400 mb-4">No videos yet. Start creating!</p>
            <button
              onClick={() => router.push("/")}
              className="bg-cyan-500 text-black font-bold px-6 py-2 rounded-full"
            >
              Go to Feed
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => (
              <div
                key={video.id}
                className="bg-[#111] border border-gray-800 rounded-xl p-4 flex items-center gap-4"
              >
                <div className="w-24 h-16 bg-gray-900 rounded-lg flex items-center justify-center overflow-hidden">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">🎥</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm truncate">
                    {video.title || "Untitled Video"}
                  </h3>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1">
                    <span>👁️ {video.views || 0} views</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WITHDRAWAL MODAL */}
      <WithdrawalModal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          if (user) {
            fetchCreatorStats(user.uid);
            fetchWithdrawalHistory(user.uid); // 🔥 Refresh history too!
          }
        }}
        userBalance={walletBalance}
      />
    </div>
  );
}
