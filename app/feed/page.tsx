"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Feed() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = [
    "All",
    "Electronics",
    "Textbooks",
    "Hostel Items",
    "Fashion",
    "Services",
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Products
        const q = query(
          collection(db, "products"),
          orderBy("createdAt", "desc"),
          limit(50),
        );
        const querySnapshot = await getDocs(q);
        const productsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);
        setFilteredProducts(productsData);

        // 2. Fetch User's Favorites (if logged in)
        if (auth.currentUser) {
          const favQuery = query(
            collection(db, "favorites"),
            where("userId", "==", auth.currentUser.uid),
          );
          const favSnapshot = await getDocs(favQuery);
          const favIds = new Set(
            favSnapshot.docs.map((d) => d.data().productId),
          );
          setFavorites(favIds);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter Logic
  useEffect(() => {
    let filtered = products;
    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    if (selectedCategory !== "All") {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }
    setFilteredProducts(filtered);
  }, [searchQuery, selectedCategory, products]);

  // ❤️ TOGGLE FAVORITE LOGIC
  const handleToggleFavorite = async (
    e: React.MouseEvent,
    productId: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!auth.currentUser) {
      router.push("/login");
      return;
    }

    const favDocRef = doc(
      db,
      "favorites",
      `${auth.currentUser.uid}_${productId}`,
    );

    try {
      if (favorites.has(productId)) {
        await deleteDoc(favDocRef);
        const newFavs = new Set(favorites);
        newFavs.delete(productId);
        setFavorites(newFavs);
      } else {
        await setDoc(favDocRef, {
          userId: auth.currentUser.uid,
          productId: productId,
          createdAt: new Date().toISOString(),
        });
        const newFavs = new Set(favorites);
        newFavs.add(productId);
        setFavorites(newFavs);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 md:px-8 pb-20">
      <div className="max-w-7xl mx-auto mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Campus Marketplace
        </h1>
        <p className="text-gray-400 mb-6">
          Find exactly what you need from verified students.
        </p>

        {/* SEARCH & FILTERS */}
        <div className="relative mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for laptops, textbooks..."
            className="w-full bg-[#111] border border-gray-800 rounded-full px-6 py-4 text-white focus:outline-none focus:border-cyan-400 transition text-lg"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${selectedCategory === cat ? "bg-cyan-500 text-black" : "bg-[#111] text-gray-400 hover:bg-[#222] border border-gray-800"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCT GRID */}
      {loading ? (
        <div className="text-center py-20">
          <p className="text-gray-400">Loading...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">No products found.</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Link
              href={`/item/${product.id}`}
              key={product.id}
              className="block"
            >
              <div
                className={`bg-[#111] border rounded-xl overflow-hidden transition cursor-pointer group h-full relative ${product.status === "sold" ? "border-gray-700 opacity-60" : "border-gray-800 hover:border-cyan-500"}`}
              >
                {product.status === "sold" && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="bg-red-500 text-white font-bold text-2xl px-6 py-3 rounded-lg transform -rotate-12 border-4 border-white">
                      SOLD
                    </div>
                  </div>
                )}

                <div className="relative h-48 overflow-hidden bg-gray-900">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />

                  {/* ❤️ THE HEART BUTTON */}
                  <button
                    onClick={(e) => handleToggleFavorite(e, product.id)}
                    className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm p-2 rounded-full hover:bg-black/80 transition z-20"
                  >
                    <svg
                      className={`w-5 h-5 transition-colors ${favorites.has(product.id) ? "text-red-500 fill-red-500" : "text-white fill-none"}`}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      />
                    </svg>
                  </button>

                  <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-md text-white">
                    {product.category}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg truncate mb-1">
                    {product.title}
                  </h3>
                  <p className="text-cyan-400 font-bold text-xl mb-3">
                    ₦{Number(product.price).toLocaleString()}
                  </p>

                  {/* 🔥 DYNAMIC VERIFIED BADGE (REPLACES HARDCODED TEXT) */}
                  <div className="flex items-center justify-between text-sm text-gray-400 border-t border-gray-800 pt-3">
                    <span>{product.campus || "Campus"}</span>

                    {product.isSellerVerified ? (
                      <div className="flex items-center gap-1 text-cyan-400 font-medium text-xs">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Verified</span>
                      </div>
                    ) : (
                      <span className="text-gray-600 text-xs">Student</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
