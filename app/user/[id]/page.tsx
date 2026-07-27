"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  increment,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
// 🔥 IMPORT THE GIFT MODAL (Adjust path if your folder structure is different)
import GiftSelectorModal from "../../components/GiftSelectorModal";

// 🔥 HELPER: RENDER STARS
const renderStars = (rating: number) => {
  const stars = [];
  const roundedRating = Math.round(rating || 0);
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <svg
        key={i}
        className={`w-4 h-4 ${i <= roundedRating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
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
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");

  // 🔥 NEW STATE FOR GIFT MODAL
  const [showGiftModal, setShowGiftModal] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchPublicProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", id as string));
        if (userDoc.exists()) {
          setUser({ id: userDoc.id, ...userDoc.data() });
          // Increment profile views
          await updateDoc(doc(db, "users", id as string), {
            profileViews: increment(1),
          });
        } else {
          setLoading(false);
          return;
        }

        // 1. Fetch User's Feed Posts
        const postsQuery = query(
          collection(db, "feed"),
          where("authorId", "==", id),
          orderBy("createdAt", "desc"),
        );
        const postsSnap = await getDocs(postsQuery);
        setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 2. Fetch Physical Products
        const productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", id),
        );
        const productsSnap = await getDocs(productsQuery);
        setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 3. Fetch Digital Services
        const servicesQuery = query(
          collection(db, "services"),
          where("creatorId", "==", id),
        );
        const servicesSnap = await getDocs(servicesQuery);
        setServices(servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        User not found.
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === user.id;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* COVER */}
      <div className="relative h-40 md:h-56 bg-gradient-to-r from-purple-600 to-cyan-600 overflow-hidden">
        {user.coverPhoto && (
          <img src={user.coverPhoto} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* PROFILE HEADER */}
        <div className="mt-[-40px] mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full border-4 border-[#0a0a0a] overflow-hidden bg-gray-800 flex items-center justify-center text-3xl font-bold text-cyan-400">
              {user.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" />
              ) : (
                user.fullName?.charAt(0).toUpperCase()
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold">
              {user.fullName || "Campus Student"}
            </h1>
            {user.isVerified && (
              <svg
                className="w-5 h-5 text-cyan-400"
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

          <div className="flex items-center gap-2 mb-3">
            <div className="flex">{renderStars(user.rating)}</div>
            <span className="text-xs text-gray-400">
              ({user.rating ? user.rating.toFixed(1) : "0.0"} •{" "}
              {user.reviewCount || 0} Reviews)
            </span>
          </div>

          <p className="text-gray-300 text-sm mb-4 max-w-md">
            {user.bio || "No bio yet."}
          </p>

          {/* 🔥 MESSAGE & GIFT BUTTONS */}
          {!isOwnProfile && currentUser && (
            <div className="flex gap-3 mb-6 w-full max-w-xs mx-auto">
              <Link
                href={`/messages/new?userId=${user.id}`}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#222] text-white px-4 py-2.5 rounded-full font-bold text-sm transition flex items-center justify-center gap-2 border border-gray-700"
              >
                💬 Message
              </Link>
              <button
                onClick={() => setShowGiftModal(true)}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white px-4 py-2.5 rounded-full font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
              >
                🎁 Send Gift
              </button>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3 mb-6 text-xs text-gray-400">
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
            {user.yearOfStudy && (
              <span className="bg-[#111] px-3 py-1 rounded-full">
                🎒 {user.yearOfStudy}
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

          {/* 🔥 STATS (Now includes GIFTS RECEIVED!) */}
          <div className="flex justify-around w-full border-y border-gray-800/50 py-4 mb-6">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{posts.length}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                Posts
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-pink-400">
                {user.totalGiftsReceived || 0}
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                Gifts
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">
                {user.followers?.length || 0}
              </p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                Followers
              </p>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex border-b border-gray-800 mb-4 sticky top-16 bg-[#0a0a0a]/95 backdrop-blur-md z-10">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${activeTab === "posts" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-500"}`}
          >
            📝 Posts
          </button>
          <button
            onClick={() => setActiveTab("listings")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${activeTab === "listings" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-500"}`}
          >
            🛒 Listings
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${activeTab === "services" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-500"}`}
          >
            🛠️ Services
          </button>
        </div>

        {/* TAB CONTENT: POSTS */}
        {activeTab === "posts" && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm">No posts yet.</p>
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="bg-[#111] border border-gray-800/50 rounded-xl p-4"
                >
                  <p className="text-gray-100 text-sm mb-2">{post.content}</p>
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      className="w-full h-48 object-cover rounded-lg mb-2"
                    />
                  )}
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>❤️ {post.likes || 0}</span>
                    <span>💬 {post.commentsList?.length || 0}</span>
                    <span>
                      {post.createdAt?.toDate
                        ? post.createdAt.toDate().toLocaleDateString()
                        : "Recently"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB CONTENT: LISTINGS */}
        {activeTab === "listings" && (
          <div className="grid grid-cols-2 gap-3">
            {products.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm">No items listed yet.</p>
              </div>
            ) : (
              products.map((p) => (
                <Link href={`/item/${p.id}`} key={p.id} className="block">
                  <div className="bg-[#111] border border-gray-800/50 rounded-xl overflow-hidden hover:border-cyan-500 transition">
                    <div className="aspect-square bg-gray-900 relative">
                      <img
                        src={p.imageUrl}
                        className="w-full h-full object-cover"
                      />
                      {p.status === "sold" && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                            SOLD
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <h3 className="font-semibold text-xs truncate">
                        {p.title}
                      </h3>
                      <p className="text-cyan-400 font-bold text-xs">
                        ₦{Number(p.price).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* TAB CONTENT: SERVICES */}
        {activeTab === "services" && (
          <div className="grid grid-cols-2 gap-3">
            {services.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm">
                  No services offered yet.
                </p>
              </div>
            ) : (
              services.map((service) => (
                <Link
                  href={`/services/${service.id}`}
                  key={service.id}
                  className="block"
                >
                  <div className="bg-[#111] border border-gray-800/50 rounded-xl overflow-hidden hover:border-cyan-500 transition">
                    <div className="aspect-square bg-gray-900 relative">
                      {service.imageUrl ? (
                        <img
                          src={service.imageUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">
                          🛠️
                        </div>
                      )}
                      <span className="absolute top-1 left-1 bg-black/70 text-[9px] font-bold px-1.5 py-0.5 rounded text-white">
                        {service.category}
                      </span>
                    </div>
                    <div className="p-2">
                      <h3 className="font-semibold text-xs truncate">
                        {service.title}
                      </h3>
                      <p className="text-cyan-400 font-bold text-xs">
                        ₦{Number(service.price).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* 🔥 GIFT SELECTOR MODAL INTEGRATION */}
      <GiftSelectorModal
        isOpen={showGiftModal}
        onClose={() => setShowGiftModal(false)}
        recipientId={user.id}
        recipientName={user.fullName || user.username}
        postId={null} // Profile gifting doesn't tie to a specific post
      />
    </div>
  );
}
