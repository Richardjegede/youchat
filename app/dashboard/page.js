"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
        fetchUserProducts(currentUser.uid);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchUserProducts = async (userId) => {
    try {
      const q = query(
        collection(db, "products"),
        where("sellerId", "==", userId),
      );
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsData);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;

    try {
      await deleteDoc(doc(db, "products", productId));
      setProducts(products.filter((p) => p.id !== productId));
      console.log("✅ Listing deleted successfully!");
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to delete listing.");
    }
  };

  const handleMarkAsSold = async (productId) => {
    if (!confirm("Mark this item as sold?")) return;

    try {
      await updateDoc(doc(db, "products", productId), {
        status: "sold",
        soldAt: serverTimestamp(),
      });

      // Update local state
      setProducts(
        products.map((p) =>
          p.id === productId ? { ...p, status: "sold" } : p,
        ),
      );

      console.log("✅ Item marked as sold!");
    } catch (err) {
      console.error("Error marking as sold:", err);
      alert("Failed to update listing.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pt-20">
        <p className="text-xl text-gray-400">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 pb-20">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">My Dashboard</h1>
          <p className="text-gray-400">
            Manage your listings and track your sales.
          </p>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Total Listings</p>
            <p className="text-3xl font-bold text-cyan-400">
              {products.length}
            </p>
          </div>
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Active Listings</p>
            <p className="text-3xl font-bold text-green-400">
              {products.filter((p) => p.status !== "sold").length}
            </p>
          </div>
          <div className="bg-[#111] border border-gray-800 rounded-xl p-6">
            <p className="text-gray-400 text-sm mb-1">Sold Items</p>
            <p className="text-3xl font-bold text-yellow-400">
              {products.filter((p) => p.status === "sold").length}
            </p>
          </div>
        </div>

        {/* ACTION BUTTON */}
        <div className="mb-8">
          <Link
            href="/sell"
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-full inline-block transition transform hover:scale-105"
          >
            + List a New Item
          </Link>
        </div>

        {/* MY LISTINGS */}
        <h2 className="text-2xl font-bold mb-6">My Listings</h2>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-xl">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-bold text-gray-300 mb-2">
              No listings yet
            </h3>
            <p className="text-gray-400 mb-6">
              Start selling by listing your first item!
            </p>
            <Link
              href="/sell"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-full inline-block transition"
            >
              + List Your First Item
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div
                key={product.id}
                className={`bg-[#111] border rounded-xl overflow-hidden transition ${
                  product.status === "sold"
                    ? "border-gray-700 opacity-60"
                    : "border-gray-800 hover:border-cyan-500"
                }`}
              >
                {/* Image */}
                <div className="relative h-48 overflow-hidden bg-gray-900">
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-md text-white">
                    {product.category}
                  </span>

                  {/* SOLD BADGE ON IMAGE */}
                  {product.status === "sold" && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="bg-red-500 text-white font-bold text-xl px-4 py-2 rounded-lg transform -rotate-12 border-2 border-white">
                        SOLD
                      </div>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-white font-semibold text-lg truncate mb-1">
                    {product.title}
                  </h3>
                  <p className="text-cyan-400 font-bold text-xl mb-3">
                    ₦{Number(product.price).toLocaleString()}
                  </p>

                  <div className="flex gap-2">
                    <Link
                      href={`/item/${product.id}`}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-center py-2 rounded-lg text-sm font-semibold transition"
                    >
                      View
                    </Link>

                    {/* NEW EDIT BUTTON */}
                    <Link
                      href={`/edit/${product.id}`}
                      className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-center py-2 rounded-lg text-sm font-semibold transition"
                    >
                      Edit
                    </Link>

                    {product.status === "sold" ? (
                      <div className="flex-1 bg-green-500/10 text-green-400 py-2 rounded-lg text-sm font-semibold text-center">
                        ✓ Sold
                      </div>
                    ) : (
                      <button
                        onClick={() => handleMarkAsSold(product.id)}
                        className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        Mark Sold
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(product.id)}
                      className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-sm font-semibold transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
