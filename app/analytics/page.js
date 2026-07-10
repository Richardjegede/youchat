"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Link from "next/link";

export default function Analytics() {
  const [stats, setStats] = useState({
    followers: 0,
    following: 0,
    totalLikes: 0,
    totalViews: 0,
    totalPosts: 0,
    engagementRate: 0,
    topPosts: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const uid = auth.currentUser.uid;

      // Fetch user data
      const userDoc = await getDocs(
        query(collection(db, "users"), where("__name__", "==", uid)),
      );
      const userData = userDoc.docs[0]?.data() || {};

      // Fetch user's posts
      const postsQuery = query(
        collection(db, "feed"),
        where("authorId", "==", uid),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const postsSnap = await getDocs(postsQuery);
      const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Calculate stats
      const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
      const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
      const totalComments = posts.reduce(
        (sum, p) => sum + (p.commentsList?.length || 0),
        0,
      );

      const followers = userData.followers?.length || 0;
      const following = userData.following?.length || 0;

      // Engagement rate = (likes + comments) / followers * 100
      const engagementRate =
        followers > 0
          ? (((totalLikes + totalComments) / followers) * 100).toFixed(2)
          : 0;

      // Top posts (by likes)
      const topPosts = [...posts]
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 5);

      setStats({
        followers,
        following,
        totalLikes,
        totalViews,
        totalPosts: posts.length,
        engagementRate,
        topPosts,
        recentActivity: posts.slice(0, 10),
      });
    } catch (err) {
      console.error("Analytics error:", err);
    } finally {
      setLoading(false);
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
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-4xl mx-auto px-4">
          {/* HEADER */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">📊 Analytics Dashboard</h1>
            <p className="text-gray-400">Track your growth and engagement</p>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Followers</p>
              <p className="text-3xl font-bold text-cyan-400">
                {stats.followers}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Total Likes</p>
              <p className="text-3xl font-bold text-purple-400">
                {stats.totalLikes}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 border border-green-500/30 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Total Views</p>
              <p className="text-3xl font-bold text-green-400">
                {stats.totalViews}
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/30 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Engagement</p>
              <p className="text-3xl font-bold text-orange-400">
                {stats.engagementRate}%
              </p>
            </div>
          </div>

          {/* MORE STATS */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Total Posts</p>
              <p className="text-2xl font-bold">{stats.totalPosts}</p>
            </div>
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
              <p className="text-gray-400 text-sm mb-1">Following</p>
              <p className="text-2xl font-bold">{stats.following}</p>
            </div>
          </div>

          {/* TOP PERFORMING POSTS */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">🔥 Top Performing Posts</h2>
            {stats.topPosts.length === 0 ? (
              <div className="text-center py-12 bg-[#111] border border-gray-800 rounded-2xl">
                <p className="text-gray-400">No posts yet. Start creating!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topPosts.map((post, idx) => (
                  <div
                    key={post.id}
                    className="bg-[#111] border border-gray-800 rounded-xl p-4 flex items-center gap-4"
                  >
                    <div className="text-2xl font-bold text-gray-600">
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold truncate">
                        {post.title || post.content?.substring(0, 50)}
                      </p>
                      <div className="flex gap-4 text-sm text-gray-400 mt-1">
                        <span>❤️ {post.likes || 0} likes</span>
                        <span>
                          💬 {post.commentsList?.length || 0} comments
                        </span>
                      </div>
                    </div>
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VERIFICATION STATUS */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">
                  ✓ Verification Status
                </h3>
                <p className="text-gray-400 text-sm">
                  Get verified to unlock more features
                </p>
              </div>
              <Link
                href="/verify"
                className="bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2 rounded-full font-bold transition"
              >
                Get Verified
              </Link>
            </div>
          </div>

          {/* YOU EARNINGS (Coming Soon) */}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">💰 YouPay Earnings</h3>
                <p className="text-gray-400 text-sm">
                  Earn money from your content (Coming Soon)
                </p>
              </div>
              <div className="text-3xl font-bold text-green-400">₦0</div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
