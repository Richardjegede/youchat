"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../lib/firebase"; // 2 dots because we are inside shop/[sellerId]
import Link from "next/link";

export default function ShopPage() {
  const { sellerId } = useParams();
  const router = useRouter();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sellerId) return;

    const fetchShopData = async () => {
      try {
        // 1. Fetch Seller Profile
        const userDoc = await getDoc(doc(db, "users", sellerId));
        if (userDoc.exists()) {
          setSeller({ id: sellerId, ...userDoc.data() });
        } else {
          // Fallback if user doc doesn't exist
          setSeller({
            id: sellerId,
            fullName: "Campus Seller",
            email: "seller@youbuy.com",
          });
        }

        // 2. Fetch ALL Products from this Seller
        const productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", sellerId),
        );
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProducts(productsData);
      } catch (err) {
        console.error("Error fetching shop data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchShopData();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pt-20">
        <p className="text-xl text-gray-400">Loading shop...</p>
      </div>
    );
  }

  if (!seller) return null;

  // Format WhatsApp link
  const whatsappMessage = `Hi! I found your shop on YouBuy and I'm interested in your items.`;
  const whatsappLink = `https://wa.me/${seller.phone ? "234" + seller.phone.substring(1) : "2348000000000"}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="min-h-screen bg-black text-white pb-20">
      {/* SHOP BANNER */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-purple-600 to-cyan-600">
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* SHOP INFO */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative -mt-16 mb-8 flex flex-col md:flex-row items-start md:items-end gap-4">
          {/* AVATAR */}
          <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-gray-800 flex items-center justify-center text-4xl font-bold text-cyan-400">
            {seller.fullName ? seller.fullName.charAt(0).toUpperCase() : "?"}
          </div>

          {/* NAME & DETAILS */}
          <div className="flex-1 mb-2">
            <h1 className="text-3xl font-bold">
              {seller.fullName || "Campus Seller"}
            </h1>
            <p className="text-gray-400">@{seller.username || "seller"}</p>
            <p className="text-cyan-400 text-sm mt-1">
              {seller.department || "Student"} • {seller.campus || "Campus"}
            </p>
          </div>

          {/* CONTACT BUTTONS */}
          <div className="flex gap-3 mb-4 md:mb-0">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-full font-semibold transition flex items-center gap-2"
            >
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* BIO */}
        {seller.bio && (
          <div className="mb-8 bg-[#111] border border-gray-800 rounded-xl p-4">
            <p className="text-gray-300">{seller.bio}</p>
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 gap-4 mb-8 border-y border-gray-800 py-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{products.length}</p>
            <p className="text-gray-400 text-sm">Items for Sale</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {products.filter((p) => p.status === "sold").length}
            </p>
            <p className="text-gray-400 text-sm">Items Sold</p>
          </div>
        </div>

        {/* SHOP LISTINGS */}
        <h2 className="text-2xl font-bold mb-6">Shop Inventory</h2>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-xl">
            <div className="text-6xl mb-4">🏪</div>
            <p className="text-gray-400 mb-6">This shop is currently empty.</p>
            <Link
              href="/feed"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-full inline-block transition"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Link
                href={`/item/${product.id}`}
                key={product.id}
                className="block"
              >
                <div
                  className={`bg-[#111] border rounded-xl overflow-hidden transition cursor-pointer group h-full relative ${
                    product.status === "sold"
                      ? "border-gray-700 opacity-60"
                      : "border-gray-800 hover:border-cyan-500"
                  }`}
                >
                  {product.status === "sold" && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                      <span className="bg-red-500 text-white font-bold px-4 py-2 rounded-lg">
                        SOLD
                      </span>
                    </div>
                  )}
                  <div className="relative h-48 overflow-hidden bg-gray-900">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-md text-white">
                      {product.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg truncate">
                      {product.title}
                    </h3>
                    <p className="text-cyan-400 font-bold text-xl">
                      ₦{Number(product.price).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
