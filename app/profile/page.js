"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import Link from "next/link";

// 🔥 COMPREHENSIVE AFRICAN COUNTRY CODES
const AFRICAN_COUNTRY_CODES = [
  { country: "Nigeria", code: "+234", flag: "🇳🇬" },
  { country: "Ghana", code: "+233", flag: "🇬🇭" },
  { country: "Kenya", code: "+254", flag: "🇰🇪" },
  { country: "South Africa", code: "+27", flag: "🇿🇦" },
  { country: "Egypt", code: "+20", flag: "🇪🇬" },
  { country: "Tanzania", code: "+255", flag: "🇹🇿" },
  { country: "Uganda", code: "+256", flag: "🇺🇬" },
  { country: "Ethiopia", code: "+251", flag: "🇪🇹" },
  { country: "Senegal", code: "+221", flag: "🇸🇳" },
  { country: "Rwanda", code: "+250", flag: "🇷🇼" },
  { country: "Cameroon", code: "+237", flag: "🇨🇲" },
  { country: "Ivory Coast", code: "+225", flag: "🇨🇮" },
  { country: "Algeria", code: "+213", flag: "🇩🇿" },
  { country: "Morocco", code: "+212", flag: "🇲🇦" },
  { country: "Tunisia", code: "+216", flag: "🇹🇳" },
  { country: "Zambia", code: "+260", flag: "🇿🇲" },
  { country: "Zimbabwe", code: "+263", flag: "🇿🇼" },
  { country: "Botswana", code: "+267", flag: "🇧🇼" },
  { country: "Namibia", code: "+264", flag: "🇳🇦" },
  { country: "Mozambique", code: "+258", flag: "🇲🇿" },
  { country: "Angola", code: "+244", flag: "🇦🇴" },
  { country: "DRC", code: "+243", flag: "🇨🇩" },
  { country: "Mali", code: "+223", flag: "🇲🇱" },
  { country: "Burkina Faso", code: "+226", flag: "🇧🇫" },
  { country: "Niger", code: "+227", flag: "🇳🇪" },
  { country: "Chad", code: "+235", flag: "🇹🇩" },
  { country: "Sudan", code: "+249", flag: "🇸🇩" },
  { country: "Somalia", code: "+252", flag: "🇸🇴" },
  { country: "Madagascar", code: "+261", flag: "🇲🇬" },
  { country: "Mauritius", code: "+230", flag: "🇲🇺" },
];

// 🔥 THE ULTIMATE EDUCATIONAL LEVELS LIST
const EDUCATIONAL_LEVELS = [
  "Junior Secondary ",
  "Senior Secondary ",
  "JAMBITE ",
  "Pre-Degree (JUPEB/IJMB)",
  "100 Level",
  "200 Level",
  "300 Level",
  "400 Level",
  "500+ Level",
  "ND 1",
  "ND 2",
  "HND 1",
  "HND 2",
  "NCE 1",
  "NCE 2",
  "NCE 3",
  "NYSC Copper",
  "Postgraduate Diploma (PGD)",
  "Masters Degree",
  "PhD / Doctorate",
  "Self-Taught / Bootcamp Graduate",
  "Alumni / Graduate",
  "Bussiness Owner",
  "CEO",
];

// 🔥 HELPER: RENDER STARS (Starts at 0, not 5)
const renderStars = (rating) => {
  const stars = [];
  const roundedRating = Math.round(rating || 0);
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

export default function MyProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [shops, setShops] = useState([]); // 🔥 NEW: User's shops
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");

  const [schoolsList, setSchoolsList] = useState([]);
  const [coursesList, setCoursesList] = useState([]);
  const [editData, setEditData] = useState({
    fullName: "",
    username: "",
    birthday: "",
    department: "",
    stateOfOrigin: "",
    status: "Single",
    school: "",
    hobbies: "",
    bio: "",
    yearOfStudy: "",
    instagram: "",
    twitter: "",
    skills: "",
    countryCode: "+234",
    phoneNumber: "",
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const metaDoc = await getDoc(doc(db, "app_metadata", "defaults"));
        if (metaDoc.exists()) {
          setSchoolsList(metaDoc.data().schools || []);
          setCoursesList(metaDoc.data().courses || []);
        } else {
          const defaultSchools = [
            "University of Lagos (UNILAG)",
            "University of Ibadan (UI)",
            "Obafemi Awolowo University (OAU)",
            "University of Benin (UNIBEN)",
            "Federal University of Technology Akure (FUTA)",
          ];
          const defaultCourses = [
            "Computer Science",
            "Medicine & Surgery",
            "Law",
            "Accounting",
            "Business Administration",
            "Mass Communication",
            "Engineering",
          ];
          await setDoc(doc(db, "app_metadata", "defaults"), {
            schools: defaultSchools,
            courses: defaultCourses,
          });
          setSchoolsList(defaultSchools);
          setCoursesList(defaultCourses);
        }
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = { id: currentUser.uid, ...userDoc.data() };
          setUser(userData);
          setEditData({
            fullName: userData.fullName || "",
            username: userData.username || "",
            birthday: userData.birthday || "",
            department: userData.department || "",
            stateOfOrigin: userData.stateOfOrigin || "",
            status: userData.status || "Single",
            school: userData.school || "",
            hobbies: userData.hobbies || "",
            bio: userData.bio || "",
            yearOfStudy: userData.yearOfStudy || "",
            instagram: userData.instagram || "",
            twitter: userData.twitter || "",
            skills: userData.skills || "",
            countryCode: userData.countryCode || "+234",
            phoneNumber: userData.phoneNumber || "",
          });
        } else {
          const basicUser = {
            id: currentUser.uid,
            fullName: "Student",
            email: currentUser.email,
            rating: 0,
            reviewCount: 0,
          };
          await setDoc(doc(db, "users", currentUser.uid), basicUser);
          setUser(basicUser);
        }

        // ✅ 1. Fetch User's Feed Posts
        const postsQuery = query(
          collection(db, "feed"),
          where("authorId", "==", currentUser.uid),
          orderBy("createdAt", "desc"),
        );
        const postsSnap = await getDocs(postsQuery);
        setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // ✅ 2. Fetch Physical Products
        const productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", currentUser.uid),
        );
        const productsSnap = await getDocs(productsQuery);
        setProducts(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // ✅ 3. Fetch Digital Services
        const servicesQuery = query(
          collection(db, "services"),
          where("creatorId", "==", currentUser.uid),
        );
        const servicesSnap = await getDocs(servicesQuery);
        setServices(servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // 🔥 4. Fetch User's Shops
        const shopsQuery = query(
          collection(db, "shops"),
          where("ownerId", "==", currentUser.uid),
        );
        const shopsSnap = await getDocs(shopsQuery);
        setShops(shopsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const uploadImage = async (file) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "youbuy-present");
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/qxd9ghri/image/upload",
      { method: "POST", body: data },
    );
    return (await res.json()).secure_url;
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadImage(file);
    await updateDoc(doc(db, "users", user.id), { avatar: url });
    setUser({ ...user, avatar: url });
    setUploadingAvatar(false);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCover(true);
    const url = await uploadImage(file);
    await updateDoc(doc(db, "users", user.id), { coverPhoto: url });
    setUser({ ...user, coverPhoto: url });
    setUploadingCover(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const userDoc = await getDoc(doc(db, "users", user.id));
      const userData = userDoc.data();
      const now = new Date();

      if (userData.profileLockedUntil) {
        const lockDate = userData.profileLockedUntil.toDate
          ? userData.profileLockedUntil.toDate()
          : new Date(userData.profileLockedUntil);

        if (now < lockDate) {
          const daysLeft = Math.ceil((lockDate - now) / (1000 * 60 * 60 * 24));
          alert(
            `⏰ Profile edits are locked for ${daysLeft} more days to prevent frequent changes.`,
          );
          setSaving(false);
          setIsEditing(false);
          return;
        }
      }

      if (editData.school && !schoolsList.includes(editData.school)) {
        await updateDoc(doc(db, "app_metadata", "defaults"), {
          schools: arrayUnion(editData.school),
        });
      }
      if (editData.department && !coursesList.includes(editData.department)) {
        await updateDoc(doc(db, "app_metadata", "defaults"), {
          courses: arrayUnion(editData.department),
        });
      }

      const lockUntil = !userData.profileLockedUntil
        ? new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)
        : userData.profileLockedUntil;

      await updateDoc(doc(db, "users", user.id), {
        ...editData,
        profileLockedUntil: lockUntil,
      });

      setUser({ ...user, ...editData });
      setIsEditing(false);
      alert("✅ Profile updated successfully! You can edit again in 45 days.");
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const daysLeft = user?.subscriptionEnd
    ? Math.ceil(
        (new Date(user.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24),
      )
    : 999;
  const isExpiringSoon = user?.isVerified && daysLeft <= 7 && daysLeft > 0;
  const isExpired = user?.isVerified && daysLeft <= 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* COVER */}
      <div className="relative h-40 md:h-56 bg-gradient-to-r from-purple-600 to-cyan-600 overflow-hidden">
        {user.coverPhoto && (
          <img src={user.coverPhoto} className="w-full h-full object-cover" />
        )}
        <label className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full cursor-pointer text-xs border border-white/20">
          {uploadingCover ? "⏳" : "📷 Change Cover"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
        </label>
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
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center cursor-pointer border-4 border-[#0a0a0a] text-sm">
              {uploadingAvatar ? "⏳" : "📷"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
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

          <div className="flex items-center gap-2 mb-3">
            <div className="flex">{renderStars(user.rating)}</div>
            <span className="text-xs text-gray-400">
              ({user.rating ? user.rating.toFixed(1) : "0.0"} •{" "}
              {user.reviewCount || 0} Reviews)
            </span>
          </div>

          <p className="text-gray-300 text-sm mb-4 max-w-md">
            {user.bio || 'Click "Edit Profile" to add a bio...'}
          </p>

          <button
            onClick={() => setIsEditing(true)}
            className="mb-6 bg-[#1a1a1a] hover:bg-[#222] border border-gray-700 text-white px-6 py-2 rounded-full font-bold text-sm transition flex items-center gap-2 mx-auto"
          >
            ✏️ Edit Profile
          </button>

          {isExpiringSoon && (
            <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
              <span className="text-yellow-400 text-sm font-semibold">
                ⚠️ Your verification expires in {daysLeft} days!
              </span>
              <Link
                href="/verify"
                className="text-xs bg-yellow-500 text-black px-3 py-1 rounded-full font-bold hover:bg-yellow-400 transition"
              >
                Renew Now
              </Link>
            </div>
          )}
          {isExpired && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between">
              <span className="text-red-400 text-sm font-semibold">
                🚫 Your verification has expired.
              </span>
              <Link
                href="/verify"
                className="text-xs bg-red-500 text-white px-3 py-1 rounded-full font-bold hover:bg-red-400 transition"
              >
                Renew Now
              </Link>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mb-6 text-xs text-gray-400">
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
          </div>

          {/* STATS */}
          <div className="flex justify-around w-full border-y border-gray-800/50 py-4 mb-6">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{posts.length}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                Posts
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{shops.length}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">
                Shops
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

        {/* ✅ TAB NAVIGATION (NOW INCLUDES SHOPS) */}
        <div className="flex border-b border-gray-800 mb-4 sticky top-16 bg-[#0a0a0a]/95 backdrop-blur-md z-10">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${activeTab === "posts" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-500"}`}
          >
            📝 Posts
          </button>
          <button
            onClick={() => setActiveTab("shops")}
            className={`flex-1 py-3 text-sm font-semibold transition border-b-2 ${activeTab === "shops" ? "border-cyan-400 text-cyan-400" : "border-transparent text-gray-500"}`}
          >
            🏪 Shops
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

        {/* ✅ TAB CONTENT: POSTS */}
        {activeTab === "posts" && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm">
                  No posts yet. Share your thoughts!
                </p>
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

        {/* 🔥 TAB CONTENT: SHOPS (OWNER ONLY) */}
        {activeTab === "shops" && (
          <div className="space-y-4">
            <div className="text-center py-8 bg-[#111] border border-gray-800/50 rounded-2xl mb-6">
              <h3 className="text-xl font-bold text-white mb-2">
                Manage Your Businesses
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                You currently own {shops.length} shop(s).
              </p>
              <Link
                href="/youbuy/plans"
                className="bg-cyan-500 text-black text-sm font-bold px-6 py-2 rounded-full inline-block hover:bg-cyan-400 transition"
              >
                + Open New Shop
              </Link>
            </div>

            {shops.length === 0 ? (
              <div className="text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm mb-4">
                  You haven't created any shops yet.
                </p>
                <Link
                  href="/youbuy/plans"
                  className="bg-cyan-500 text-black text-xs font-bold px-4 py-2 rounded-full"
                >
                  View Plans
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {shops.map((shop) => (
                  <Link
                    href={`/shop/${shop.id}`}
                    key={shop.id}
                    className="block"
                  >
                    <div className="bg-[#111] border border-gray-800/50 rounded-xl p-4 flex items-center gap-4 hover:border-cyan-500 transition">
                      <div className="w-16 h-16 rounded-xl bg-gray-900 overflow-hidden flex-shrink-0">
                        {shop.shopLogo ? (
                          <img
                            src={shop.shopLogo}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🏪
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white truncate">
                            {shop.name}
                          </h3>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shop.plan === "yearly" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : shop.plan === "6-month" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}
                          >
                            {shop.plan === "yearly"
                              ? " Gold"
                              : shop.plan === "6-month"
                                ? " Premium"
                                : " Basic"}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs">
                          {shop.category} • {shop.productCount || 0} items
                        </p>
                      </div>
                      <div className="text-cyan-400">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ✅ TAB CONTENT: LISTINGS */}
        {activeTab === "listings" && (
          <div className="grid grid-cols-2 gap-3">
            {products.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm mb-3">
                  No items listed yet.
                </p>
                <Link
                  href="/sell"
                  className="bg-cyan-500 text-black text-xs font-bold px-4 py-2 rounded-full"
                >
                  + List Item
                </Link>
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

        {/* ✅ TAB CONTENT: SERVICES */}
        {activeTab === "services" && (
          <div className="grid grid-cols-2 gap-3">
            {services.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-[#111] border border-gray-800/50 rounded-2xl">
                <p className="text-gray-400 text-sm mb-3">
                  No services offered yet.
                </p>
                <Link
                  href="/services/create"
                  className="bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-full"
                >
                  + Offer Service
                </Link>
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

      {/* 🔥 EDIT MODAL */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Edit Profile</h2>
              <button onClick={() => setIsEditing(false)} className="text-2xl">
                &times;
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editData.fullName}
                  onChange={(e) =>
                    setEditData({ ...editData, fullName: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Username (Public Display)
                </label>
                <input
                  type="text"
                  value={editData.username}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      username: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, ""),
                    })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="@yourusername"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be shown on your posts (no spaces allowed)
                </p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  School / Institution
                </label>
                <input
                  list="schools-datalist"
                  value={editData.school}
                  onChange={(e) =>
                    setEditData({ ...editData, school: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Start typing..."
                />
                <datalist id="schools-datalist">
                  {schoolsList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Course / Department
                </label>
                <input
                  list="courses-datalist"
                  value={editData.department}
                  onChange={(e) =>
                    setEditData({ ...editData, department: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Start typing..."
                />
                <datalist id="courses-datalist">
                  {coursesList.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Current Educational Level
                </label>
                <select
                  value={editData.yearOfStudy}
                  onChange={(e) =>
                    setEditData({ ...editData, yearOfStudy: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Select your current level...</option>
                  {EDUCATIONAL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Relationship Status
                </label>
                <select
                  value={editData.status}
                  onChange={(e) =>
                    setEditData({ ...editData, status: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                >
                  {[
                    "Single",
                    "Married",
                    "Divorced",
                    "It's Complicated",
                    "Prefer not to say",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Country Code
                </label>
                <select
                  value={editData.countryCode}
                  onChange={(e) =>
                    setEditData({ ...editData, countryCode: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                >
                  {AFRICAN_COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.country} ({c.code})
                    </option>
                  ))}
                  <option value="other">Other (Manual)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Phone Number
                </label>
                <div className="flex gap-2">
                  {editData.countryCode === "other" ? (
                    <input
                      type="text"
                      value={editData.manualCountryCode || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          countryCode: e.target.value,
                        })
                      }
                      className="w-24 bg-[#1a1a1a] border border-gray-700 rounded-xl px-2 py-3 text-white focus:outline-none focus:border-cyan-400 text-center"
                      placeholder="+234"
                    />
                  ) : (
                    <div className="w-24 bg-[#111] border border-gray-700 rounded-xl px-2 py-3 text-white text-center font-semibold">
                      {editData.countryCode}
                    </div>
                  )}
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={editData.phoneNumber}
                    onChange={(e) =>
                      setEditData({ ...editData, phoneNumber: e.target.value })
                    }
                    className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"
                    placeholder="8012345678"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Bio (Max 180 chars)
                </label>
                <textarea
                  value={editData.bio}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      bio: e.target.value.slice(0, 180),
                    })
                  }
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
                <p className="text-xs text-right text-gray-500 mt-1">
                  {editData.bio.length} / 180
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 bg-cyan-500 text-black py-3 rounded-xl font-bold"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
