"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import Link from "next/link";

export default function PublicProfile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchPublicProfile = async () => {
      try {
        // Fetch User
        const userDoc = await getDoc(doc(db, "users", id));
        if (userDoc.exists()) setUser({ id, ...userDoc.data() });

        // Increment Profile Views (The "Extra" Feature!)
        await updateDoc(doc(db, "users", id), { profileViews: increment(1) });

        // Fetch Products
        const productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", id),
        );
        setProducts(
          (await getDocs(productsQuery)).docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })),
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicProfile();
  }, [id]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        Loading...
      </div>
    );
  if (!user)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        User not found.
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* Cover */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-purple-600 to-cyan-600 overflow-hidden">
        {user.coverPhoto && (
          <img src={user.coverPhoto} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* PUBLIC PROFILE HEADER - FIXED LAYOUT */}
        <div className="mt-8 mb-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-[#0a0a0a] overflow-hidden bg-gray-800 flex items-center justify-center text-4xl font-bold text-cyan-400">
              {user.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" />
              ) : (
                user.fullName?.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div className="flex-1 w-full">
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {user.fullName || "Campus Student"}
            </h1>
            <p className="text-gray-400 text-sm mb-2">
              @{user.username || "student"}
            </p>

            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
              {user.school && (
                <span className="bg-[#111] px-3 py-1 rounded-full">
                  🎓 {user.school}
                </span>
              )}
              {user.department && (
                <span className="bg-[#111] px-3 py-1 rounded-full">
                  📚 {user.department}
                </span>
              )}
              {user.status && (
                <span className="bg-[#111] px-3 py-1 rounded-full">
                  💍 {user.status}
                </span>
              )}
              {user.profileViews && (
                <span className="bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full">
                  👁️ {user.profileViews} Views
                </span>
              )}
            </div>
          </div>
        </div>
        {/* MESSAGE BUTTON */}
        {auth.currentUser && user.id !== auth.currentUser.uid && (
          <Link
            href={`/messages/new?userId=${user.id}`}
            className="mt-4 bg-cyan-500 hover:bg-cyan-400 text-black px-6 py-2 rounded-full font-bold transition inline-block"
          >
            💬 Message
          </Link>
        )}
        {/* BIO - ONLY ONCE! */}
        <p className="text-gray-300 mb-8 bg-[#111] p-4 rounded-xl border border-gray-800">
          {user.bio || "No bio yet."}
        </p>

        {/* STATS */}
        <div className="grid grid-cols-3 gap-4 mb-8 border-y border-gray-800/50 py-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{products.length}</p>
            <p className="text-gray-400 text-xs uppercase tracking-wide">
              Listings
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {user.followers?.length || 0}
            </p>
            <p className="text-gray-400 text-xs uppercase tracking-wide">
              Followers
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {user.following?.length || 0}
            </p>
            <p className="text-gray-400 text-xs uppercase tracking-wide">
              Following
            </p>
          </div>
        </div>

        {/* LISTINGS */}
        <h2 className="text-xl font-bold mb-6">{user.fullName}'s Listings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <Link href={`/item/${p.id}`} key={p.id} className="block">
              <div className="bg-[#111] border border-gray-800/50 rounded-xl overflow-hidden hover:border-cyan-500 transition">
                <div className="h-40 bg-gray-900">
                  <img
                    src={p.imageUrl}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                  <p className="text-cyan-400 font-bold text-sm">
                    ₦{Number(p.price).toLocaleString()}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
