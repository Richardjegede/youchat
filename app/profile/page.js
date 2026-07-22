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
  getDocs,
  updateDoc,
  arrayUnion,
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

// 🔥 THE ULTIMATE EDUCATIONAL LEVELS LIST (Categorized for clarity)
const EDUCATIONAL_LEVELS = [
  "Junior Secondary (JSS 1 - 3)",
  "Senior Secondary (SSS 1 - 3)",
  "JAMBITE / Awaiting Admission",
  "Foundation / Pre-Degree (JUPEB/IJMB)",
  "University: 100 Level",
  "University: 200 Level",
  "University: 300 Level",
  "University: 400 Level",
  "University: 500+ Level",
  "Polytechnic: ND 1",
  "Polytechnic: ND 2",
  "Polytechnic: HND 1",
  "Polytechnic: HND 2",
  "College of Education: NCE 1",
  "College of Education: NCE 2",
  "College of Education: NCE 3",
  "Postgraduate Diploma (PGD)",
  "Masters Degree",
  "PhD / Doctorate",
  "Self-Taught / Bootcamp Graduate",
  "Alumni / Graduate (Not currently studying)",
];

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

export default function MyProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 🔥 STATE FOR DYNAMIC LISTS
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

  // 🔥 FETCH DYNAMIC METADATA ON LOAD
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
          };
          await setDoc(doc(db, "users", currentUser.uid), basicUser);
          setUser(basicUser);
        }
        const productsQuery = query(
          collection(db, "products"),
          where("sellerId", "==", currentUser.uid),
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

    // 🔥 SELF-LEARNING LOGIC: If the school/course is new, add it to the database!
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

    // Save user profile
    await updateDoc(doc(db, "users", user.id), editData);
    setUser({ ...user, ...editData });
    setIsEditing(false);
    setSaving(false);
  };

  const daysLeft = user?.subscriptionEnd
    ? Math.ceil(
        (new Date(user.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24),
      )
    : 999;
  const isExpiringSoon = user?.isVerified && daysLeft <= 7 && daysLeft > 0;
  const isExpired = user?.isVerified && daysLeft <= 0;

  if (loading)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      {/* COVER */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-purple-600 to-cyan-600 overflow-hidden">
        {user.coverPhoto && (
          <img src={user.coverPhoto} className="w-full h-full object-cover" />
        )}
        <label className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full cursor-pointer text-sm border border-white/20">
          {uploadingCover ? "⏳" : "📷 Change Cover"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
        </label>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* PROFILE HEADER */}
        <div className="mt-8 mb-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-[#0a0a0a] overflow-hidden bg-gray-800 flex items-center justify-center text-4xl font-bold text-cyan-400">
              {user.avatar ? (
                <img src={user.avatar} className="w-full h-full object-cover" />
              ) : (
                user.fullName?.charAt(0).toUpperCase()
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-10 h-10 bg-cyan-500 rounded-full flex items-center justify-center cursor-pointer border-4 border-[#0a0a0a]">
              {uploadingAvatar ? "⏳" : "📷"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </label>
          </div>

          <div className="flex-1 w-full">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {user.fullName || "Campus Student"}
                </h1>
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
              <button
                onClick={() => setIsEditing(true)}
                className="bg-[#1a1a1a] hover:bg-[#222] border border-gray-800 px-4 py-2 rounded-full text-sm font-semibold transition"
              >
                ✏️ Edit Profile
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex">{renderStars(user.rating)}</div>
              <span className="text-sm text-gray-400">
                ({user.rating || "5.0"} / 5.0 • {user.reviewCount || 0} Reviews)
              </span>
            </div>

            <p className="text-gray-300 text-sm md:text-base leading-relaxed pr-8">
              {user.bio || 'Click "Edit Profile" to add a bio...'}
            </p>

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

            <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-400">
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
          </div>
        </div>

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
        <h2 className="text-xl font-bold mb-6">My Active Listings</h2>
        {products.length === 0 ? (
          <div className="text-center py-16 bg-[#111] border border-gray-800/50 rounded-2xl">
            <p className="text-gray-400 mb-4">No items listed yet.</p>
            <Link
              href="/sell"
              className="bg-cyan-500 text-black font-bold px-6 py-2 rounded-full"
            >
              + List Item
            </Link>
          </div>
        ) : (
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
                    <h3 className="font-semibold text-sm truncate">
                      {p.title}
                    </h3>
                    <p className="text-cyan-400 font-bold text-sm">
                      ₦{Number(p.price).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 🔥 EDIT MODAL WITH SELF-LEARNING DATALISTS & ULTIMATE LEVELS */}
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
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  School / Institution (Type to add new)
                </label>
                <input
                  list="schools-datalist"
                  value={editData.school}
                  onChange={(e) =>
                    setEditData({ ...editData, school: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Start typing your school..."
                />
                <datalist id="schools-datalist">
                  {schoolsList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Course / Department (Type to add new)
                </label>
                <input
                  list="courses-datalist"
                  value={editData.department}
                  onChange={(e) =>
                    setEditData({ ...editData, department: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                  placeholder="Start typing your course..."
                />
                <datalist id="courses-datalist">
                  {coursesList.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* 🔥 ULTIMATE EDUCATIONAL LEVELS DROPDOWN */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">
                  Current Educational Level
                </label>
                <select
                  value={editData.yearOfStudy}
                  onChange={(e) =>
                    setEditData({ ...editData, yearOfStudy: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
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
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
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

              {/* 🔥 COMPREHENSIVE COUNTRY CODE DROPDOWN */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Country Code
                </label>
                <select
                  value={editData.countryCode}
                  onChange={(e) =>
                    setEditData({ ...editData, countryCode: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
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
                          CountryCode: e.target.value,
                        })
                      }
                      className="w-24 bg-[#1a1a1a] border border-gray-700 rounded-xl px-2 py-3 text-white focus:border-cyan-400 focus:outline-none text-center"
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
                    className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
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
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none resize-none"
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
