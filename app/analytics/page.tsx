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
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WithdrawalModal from "../components/WithdrawalModal";

export default function EarnDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Existing State
  const [walletBalance, setWalletBalance] = useState(0);
  const [videos, setVideos] = useState([]);
  const [totalViews, setTotalViews] = useState(0);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // 🔥 NEW: Engagement & Sponsored State
  const [profileViews, setProfileViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [totalGifts, setTotalGifts] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [sponsoredPosts, setSponsoredPosts] = useState(0);
  const [sponsoredEngagement, setSponsoredEngagement] = useState(0);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchCreatorStats(currentUser.uid);
        fetchWithdrawalHistory(currentUser.uid);
        fetchTransactions(currentUser.uid);
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchCreatorStats = async (uid) => {
    try {
      // 1. Fetch User Profile Data (for walletBalance and profileViews)
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setWalletBalance(userData.walletBalance || 0);
        setProfileViews(userData.profileViews || 0); // 🔥 NEW
      }

      // 2. Fetch Videos (Existing)
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

      // 🔥 3. Fetch Feed Posts (for Likes, Comments, Gifts, and Sponsored Metrics)
      const postsQuery = query(
        collection(db, "feed"),
        where("authorId", "==", uid),
      );
      const postsSnap = await getDocs(postsQuery);

      let tLikes = 0;
      let tComments = 0;
      let tGifts = 0;
      let tSponsored = 0;
      let tSponsoredEngagement = 0;

      postsSnap.forEach((docSnap) => {
        const post = docSnap.data();
        const likes = post.likes || 0;
        const comments = post.commentsList?.length || 0;
        const gifts = post.giftCount || 0;

        tLikes += likes;
        tComments += comments;
        tGifts += gifts;

        // 🔥 TRACK SPONSORED POST METRICS SPECIFICALLY
        if (post.isSponsored) {
          tSponsored += 1;
          tSponsoredEngagement += likes + comments;
        }
      });

      setTotalLikes(tLikes);
      setTotalComments(tComments);
      setTotalGifts(tGifts);
      setTotalPosts(postsSnap.size);
      setSponsoredPosts(tSponsored);
      setSponsoredEngagement(tSponsoredEngagement);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawalHistory = async (uid) => {
    try {
      const q = query(
        collection(db, "withdrawals"),
        where("userId", "==", uid),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setWithdrawalHistory(data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const fetchTransactions = async (uid) => {
    try {
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", uid),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      setTransactions(data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getTransactionStyle = (type) => {
    switch (type) {
      case "deposit":
        return {
          icon: "💰",
          color: "text-green-400",
          bg: "bg-green-500/10",
          label: "Deposit",
        };
      case "gift_received":
        return {
          icon: "🎁",
          color: "text-pink-400",
          bg: "bg-pink-500/10",
          label: "Gift Received",
        };
      case "conversion":
        return {
          icon: "🔄",
          color: "text-orange-400",
          bg: "bg-orange-500/10",
          label: "Converted to Coins",
        };
      case "withdrawal":
        return {
          icon: "💸",
          color: "text-blue-400",
          bg: "bg-blue-500/10",
          label: "Withdrawal",
        };
      case "refund":
        return {
          icon: "↩️",
          color: "text-yellow-400",
          bg: "bg-yellow-500/10",
          label: "Refund",
        };
      default:
        return {
          icon: "📄",
          color: "text-gray-400",
          bg: "bg-gray-500/10",
          label: "Transaction",
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Creator Dashboard</h1>
          <p className="text-gray-400">
            Track your performance, ad campaigns, and withdraw funds securely.
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
            Min: ₦3,000 • Max: ₦50,000 per request
          </p>
        </div>

        {/* 🔥 CONTENT & AD PERFORMANCE SECTION (NEW!) */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            📈 Content & Ad Performance
          </h2>

          {/* Top Row: Profile & Total Posts */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[#111] border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">Profile Views</p>
              <p className="text-2xl font-bold text-white">
                {profileViews.toLocaleString()}
              </p>
            </div>
            <div className="bg-[#111] border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">Total Posts</p>
              <p className="text-2xl font-bold text-white">{totalPosts}</p>
            </div>
          </div>

          {/* Middle Row: Engagement Metrics */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-[#111] border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-xl mb-1">❤️</p>
              <p className="text-lg font-bold text-white">{totalLikes}</p>
              <p className="text-[10px] text-gray-500">Likes</p>
            </div>
            <div className="bg-[#111] border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-xl mb-1">💬</p>
              <p className="text-lg font-bold text-white">{totalComments}</p>
              <p className="text-[10px] text-gray-500">Comments</p>
            </div>
            <div className="bg-[#111] border border-gray-800 rounded-xl p-3 text-center">
              <p className="text-xl mb-1">🎁</p>
              <p className="text-lg font-bold text-white">{totalGifts}</p>
              <p className="text-[10px] text-gray-500">Gifts</p>
            </div>
          </div>

          {/* Bottom Row: Sponsored Campaigns (The Money Maker!) */}
          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-yellow-400 text-sm font-bold">
                  Active Ad Campaigns
                </p>
                <p className="text-3xl font-bold text-white mt-1">
                  {sponsoredPosts}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-2xl">
                📢
              </div>
            </div>

            <div className="border-t border-yellow-500/20 pt-4">
              <p className="text-gray-400 text-xs mb-1">
                Total Ad Engagement (Likes + Comments on Ads)
              </p>
              <p className="text-xl font-bold text-yellow-400">
                {sponsoredEngagement}
              </p>
            </div>

            {sponsoredPosts === 0 && (
              <div className="mt-4 bg-black/30 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400">
                  No active campaigns yet.
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="mt-2 bg-yellow-500 text-black text-xs font-bold px-4 py-1.5 rounded-full hover:bg-yellow-400 transition"
                >
                  Boost a Post
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 🔥 TRANSACTION HISTORY SECTION */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          📜 Financial Ledger
        </h2>
        {transactions.length === 0 ? (
          <div className="text-center py-8 bg-[#111] border border-gray-800 rounded-2xl mb-8">
            <p className="text-gray-400 text-sm">No financial activity yet.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {transactions.map((tx) => {
              const style = getTransactionStyle(tx.type);
              return (
                <div
                  key={tx.id}
                  className="bg-[#111] border border-gray-800 rounded-xl p-4 flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full ${style.bg} flex items-center justify-center text-xl`}
                    >
                      {style.icon}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        {style.label}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {tx.description || "Transaction"} •{" "}
                        {tx.createdAt?.toDate
                          ? tx.createdAt.toDate().toLocaleDateString()
                          : "Just now"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {tx.amount > 0 && (
                      <p className={`font-bold ${style.color}`}>
                        ₦{tx.amount.toLocaleString()}
                      </p>
                    )}
                    {tx.coins > 0 && (
                      <p className="text-purple-400 text-xs font-bold">
                        🪙 {tx.coins.toLocaleString()} coins
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WITHDRAWAL HISTORY */}
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🏦 Withdrawal Requests
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
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${req.status === "paid" ? "bg-green-500/20 text-green-400 border-green-500/50" : req.status === "rejected" ? "bg-red-500/20 text-red-400 border-red-500/50" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"}`}
                >
                  {req.status === "paid"
                    ? "🟢 Paid"
                    : req.status === "rejected"
                      ? "🔴 Rejected"
                      : "🟡 Pending"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <WithdrawalModal
        isOpen={showWithdrawModal}
        onClose={() => {
          setShowWithdrawModal(false);
          if (user) {
            fetchCreatorStats(user.uid);
            fetchWithdrawalHistory(user.uid);
            fetchTransactions(user.uid);
          }
        }}
        userBalance={walletBalance}
      />
    </div>
  );
}
