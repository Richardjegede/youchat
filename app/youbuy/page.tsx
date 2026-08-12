"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import Link from "next/link";
import ProtectedRoute from "../components/ProtectedRoute";

export default function YouBuyPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      // Fetch up to 50 shops (we will filter/sort client-side for the premium logic)
      const q = query(
        collection(db, "shops"),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const snapshot = await getDocs(q);
      const shopsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 🔥 SORTING LOGIC: Premium (Yearly/6-month) first, then Free
      shopsData.sort((a, b) => {
        const getWeight = (plan: string) =>
          plan === "yearly" ? 3 : plan === "6-month" ? 2 : 1;
        return getWeight(b.plan) - getWeight(a.plan);
      });

      setShops(shopsData);
    } catch (err) {
      console.error("Error fetching shops:", err);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    "All",
    "Fashion",
    "Electronics",
    "Food",
    "Services",
    "Textbooks",
    "Hostel Items",
  ];

  const filteredShops = shops.filter((shop) => {
    const matchesSearch =
      shop.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || shop.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-24 px-4">
        <div className="max-w-3xl mx-auto">
          {/* HEADER */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                YouBuy Marketplace
              </h1>
              <p className="text-gray-400 text-sm">
                Find trusted student shops
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Link
                href="/sell"
                className="flex-1 sm:flex-none bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2 rounded-full font-bold text-sm transition flex items-center justify-center gap-1"
              >
                <span>💰</span> Sell Item
              </Link>
              <Link
                href="/youbuy/plans"
                className="flex-1 sm:flex-none bg-green-500 hover:bg-green-400 text-black px-5 py-2 rounded-full font-bold text-sm transition flex items-center justify-center gap-1"
              >
                <span>🏪</span> Open Shop
              </Link>
            </div>
          </div>
          {/* SEARCH BAR */}
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shops by name or category..."
              className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl px-5 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          {/* CATEGORY PILLS */}
          <div className="flex gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? "bg-cyan-500 text-black"
                    : "bg-[#1a1a1a] text-gray-400 hover:bg-[#222] border border-gray-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* SHOPS LIST */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredShops.length === 0 ? (
            <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
              <p className="text-gray-400 mb-4">No shops found yet.</p>
              <Link
                href="/youbuy/create-shop"
                className="bg-cyan-500 text-black font-bold px-6 py-2 rounded-full"
              >
                Be the first to open a shop!
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredShops.slice(0, 20).map((shop) => {
                // 🔥 PLAN BADGE LOGIC
                const planBadge =
                  shop.plan === "yearly"
                    ? { text: "👑 Gold", color: "text-purple-400" }
                    : shop.plan === "6-month"
                      ? { text: "⭐ Premium", color: "text-yellow-400" }
                      : { text: " Basic", color: "text-gray-400" };

                return (
                  <Link
                    href={`/shop/${shop.id}`}
                    key={shop.id}
                    className="block group"
                  >
                    <div className="bg-[#111] border border-gray-800 rounded-xl p-4 flex items-center gap-4 hover:border-cyan-500 transition cursor-pointer">
                      {/* LEFT: SHOP LOGO */}
                      <div className="w-20 h-20 rounded-xl bg-gray-900 flex-shrink-0 overflow-hidden border border-gray-800 group-hover:border-cyan-500/50 transition">
                        {shop.shopLogo ? (
                          <img
                            src={shop.shopLogo}
                            alt={shop.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🏪
                          </div>
                        )}
                      </div>

                      {/* MIDDLE: SHOP INFO */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white text-lg truncate group-hover:text-cyan-400 transition">
                            {shop.name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-700 bg-[#0a0a0a] ${planBadge.color}`}
                          >
                            {planBadge.text}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm truncate mb-1">
                          {shop.category || "General Store"}
                        </p>

                        {/* 🔥 REAL DYNAMIC RATING DISPLAY (Replaces the mock stars) */}
                        {shop.rating > 0 ? (
                          <div className="flex items-center gap-1 mb-1">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                  key={star}
                                  className={`w-3 h-3 ${star <= Math.round(shop.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="text-gray-500 text-[10px]">
                              ({shop.reviewCount || 0})
                            </span>
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs mb-1">
                            No ratings yet
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{shop.location || "Campus"}</span>
                        </div>
                      </div>

                      {/* RIGHT: PRODUCT COUNT */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-cyan-400 font-bold text-lg">
                          {shop.productCount || 0}
                        </p>
                        <p className="text-gray-500 text-[10px] uppercase">
                          Items
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
