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

// 🔥 HELPER: RENDER 5 STARS
const renderStars = (rating) => {
  const stars = [];
  const roundedRating = Math.round(rating || 5.0);
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <svg
        key={i}
        className={`w-5 h-5 ${i <= roundedRating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>,
    );
  }
  return stars;
};

export default function PublicProfile() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchPublicProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", id));
        if (userDoc.exists()) setUser({ id, ...userDoc.data() });
        await updateDoc(doc(db, "users", id), { profileViews: increment(1) });
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
        {/* PUBLIC PROFILE HEADER */}
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
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold">
                {user.fullName || "Campus Student"}
              </h1>
              {/* 🔥 BLUE TICK FOR PUBLIC VIEW */}
              {user.isVerified && (
                <svg
                  className="w-6 h-6 text-cyan-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  title="Verified Student"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <p className="text-gray-400 text-sm mb-2">
              @{user.username || "student"}
            </p>

            {/* 🔥 5-STAR RATING DISPLAY */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex">{renderStars(user.rating)}</div>
              <span className="text-sm text-gray-400">
                ({user.rating || "5.0"} / 5.0 • {user.reviewCount || 0} Reviews)
              </span>
            </div>

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

        {/* BIO */}
        <p className="text-gray-300 mt-6 mb-8 bg-[#111] p-4 rounded-xl border border-gray-800">
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
