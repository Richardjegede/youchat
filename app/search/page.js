"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [results, setResults] = useState({ users: [], feed: [] });
  const [loading, setLoading] = useState(false);
  const [discoverItems, setDiscoverItems] = useState([]);

  const tabs = [
    { id: "all", label: "All" },
    { id: "people", label: "People" },
    { id: "social", label: "Posts" },
    { id: "product", label: "Products" },
    { id: "video", label: "Videos" },
  ];

  // Fetch Discover items on load
  useEffect(() => {
    fetchDiscover();
  }, []);

  // Search when query changes
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setResults({ users: [], feed: [] });
      return;
    }

    const timer = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const performSearch = async () => {
    setLoading(true);
    const q = searchQuery.toLowerCase().trim();
    try {
      // Search Users
      const usersSnap = await getDocs(
        query(collection(db, "users"), limit(50)),
      );
      const matchedUsers = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (u) =>
            u.fullName?.toLowerCase().includes(q) ||
            u.username?.toLowerCase().includes(q) ||
            u.school?.toLowerCase().includes(q),
        );

      // Search Feed
      const feedSnap = await getDocs(
        query(collection(db, "feed"), orderBy("createdAt", "desc"), limit(100)),
      );
      const matchedFeed = feedSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => {
          const text =
            `${item.title} ${item.content} ${item.authorName} ${item.videoCaption || ""}`.toLowerCase();
          if (activeTab === "all") return text.includes(q);
          return item.type === activeTab && text.includes(q);
        });

      setResults({ users: matchedUsers, feed: matchedFeed });
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscover = async () => {
    try {
      const q = query(
        collection(db, "feed"),
        orderBy("createdAt", "desc"),
        limit(12),
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      setDiscoverItems(items);
    } catch (err) {
      console.error("Discover fetch error:", err);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-3xl mx-auto px-4">
          {/* SEARCH BAR */}
          <div className="sticky top-16 z-30 bg-[#0a0a0a]/95 backdrop-blur-md py-4 mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people, posts, products..."
                className="w-full bg-[#1a1a1a] border border-gray-800 rounded-full px-5 py-3 pl-12 text-white focus:outline-none focus:border-cyan-400 transition"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* TABS */}
            <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-black scale-105"
                      : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* SEARCH RESULTS */}
          {searchQuery.trim().length >= 2 && (
            <div className="mb-10">
              <h2 className="text-lg font-bold mb-4 text-gray-300">
                {loading ? "Searching..." : `Results for "${searchQuery}"`}
              </h2>

              {results.users.length === 0 &&
                results.feed.length === 0 &&
                !loading && (
                  <div className="text-center py-12 bg-[#111] border border-gray-800 rounded-2xl">
                    <p className="text-4xl mb-3">🔍</p>
                    <p className="text-gray-400">No results found</p>
                  </div>
                )}

              {/* People Results */}
              {(activeTab === "all" || activeTab === "people") &&
                results.users.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">
                      👥 People
                    </h3>
                    <div className="space-y-2">
                      {results.users.map((user) => (
                        <Link
                          key={user.id}
                          href={`/user/${user.id}`}
                          className="block"
                        >
                          <div className="bg-[#111] border border-gray-800 rounded-xl p-3 flex items-center gap-3 hover:border-cyan-500 transition">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-sm">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                user.fullName?.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-white">
                                {user.fullName || "User"}
                              </p>
                              <p className="text-xs text-gray-400">
                                {user.school || "Campus"}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              {/* Feed Results */}
              {(activeTab === "all" || activeTab !== "people") &&
                results.feed.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-3">
                      📱 Content
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {results.feed.map((item) => (
                        <Link
                          key={item.id}
                          href={
                            item.type === "product" ? `/item/${item.id}` : `/`
                          }
                          className="block"
                        >
                          <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500 transition">
                            {item.imageUrl && (
                              <img
                                src={item.imageUrl}
                                className="w-full h-32 object-cover"
                              />
                            )}
                            {item.videoUrl && (
                              <video
                                src={item.videoUrl}
                                className="w-full h-32 object-cover"
                              />
                            )}
                            <div className="p-3">
                              <p className="text-xs text-cyan-400 font-bold uppercase">
                                {item.type}
                              </p>
                              <h4 className="font-semibold text-sm truncate">
                                {item.title || item.content?.substring(0, 40)}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                By {item.authorName}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* DISCOVER SECTION */}
          {!searchQuery && (
            <div>
              <h2 className="text-xl font-bold mb-4">🔥 Discover</h2>
              <p className="text-gray-400 text-sm mb-6">
                Trending posts on campus
              </p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {discoverItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.type === "product" ? `/item/${item.id}` : `/`}
                    className="block"
                  >
                    <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500 transition group">
                      <div className="relative h-32 overflow-hidden">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        )}
                        {item.videoUrl && (
                          <video
                            src={item.videoUrl}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span className="absolute top-2 left-2 bg-black/70 text-xs px-2 py-1 rounded">
                          {item.type}
                        </span>
                      </div>
                      <div className="p-3">
                        <h4 className="font-semibold text-sm truncate">
                          {item.title || item.content?.substring(0, 30)}
                        </h4>
                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                          <span>❤️ {item.likes || 0}</span>
                          <span>👤 {item.authorName}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
