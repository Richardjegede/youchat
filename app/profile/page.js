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
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import Link from "next/link";

// DATA FOR DROPDOWNS
const AFRICAN_SCHOOLS = [
  "University of Lagos (UNILAG)",
  "University of Ibadan (UI)",
  "Obafemi Awolowo University (OAU)",
  "University of Benin (UNIBEN)",
  "Federal University of Technology Akure (FUTA)",
  "University of Ghana (Legon)",
  "University of Nairobi",
  "University of Cape Town",
  "Other",
];

const COURSES = [
  "Computer Science",
  "Medicine & Surgery",
  "Law",
  "Accounting",
  "Business Administration",
  "Mass Communication",
  "Engineering",
  "Pharmacy",
  "Architecture",
  "Political Science",
  "Other",
];

export default function MyProfile() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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
  });

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
    await updateDoc(doc(db, "users", user.id), editData);
    setUser({ ...user, ...editData });
    setIsEditing(false);
    setSaving(false);
  };

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
          {uploadingCover ? "⏳" : " Change Cover"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
        </label>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* PROFILE HEADER - NOW MOVED DOWN */}
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
              {uploadingAvatar ? "" : "📷"}
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
              {/* NAME */}
              <Link
                href={`/user/${user.id}`}
                className="text-2xl md:text-3xl font-bold hover:text-cyan-400 transition cursor-pointer"
              >
                {user.fullName || "Campus Student"}
              </Link>
              <button
                onClick={() => setIsEditing(true)}
                className="bg-[#1a1a1a] hover:bg-[#222] border border-gray-800 px-4 py-2 rounded-full text-sm font-semibold transition"
              >
                ✏️ Edit Profile
              </button>
            </div>

            <p className="text-gray-300 text-sm md:text-base leading-relaxed pr-8">
              {user.bio || 'Click "Edit Profile" to add a bio...'}
            </p>

            {/* TAGS */}
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-400">
              {user.school && (
                <span className="hover:text-cyan-400 cursor-pointer transition bg-[#111] px-3 py-1 rounded-full">
                  🎓 {user.school}
                </span>
              )}
              {user.department && (
                <span className="hover:text-cyan-400 cursor-pointer transition bg-[#111] px-3 py-1 rounded-full">
                  📚 {user.department}
                </span>
              )}
              {user.yearOfStudy && (
                <span className="hover:text-cyan-400 cursor-pointer transition bg-[#111] px-3 py-1 rounded-full">
                  🎒 {user.yearOfStudy} Level
                </span>
              )}
              {user.status && (
                <span className="hover:text-cyan-400 cursor-pointer transition bg-[#111] px-3 py-1 rounded-full">
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
        {/* LISTINGS (Same as before) */}
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

      {/* EDIT MODAL (With Dropdowns) */}
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
                  School / Institution
                </label>
                <select
                  value={editData.school}
                  onChange={(e) =>
                    setEditData({ ...editData, school: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">Select School</option>
                  {AFRICAN_SCHOOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Course / Department
                </label>
                <select
                  value={editData.department}
                  onChange={(e) =>
                    setEditData({ ...editData, department: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">Select Course</option>
                  {COURSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Year of Study
                </label>
                <select
                  value={editData.yearOfStudy}
                  onChange={(e) =>
                    setEditData({ ...editData, yearOfStudy: e.target.value })
                  }
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">Select Level</option>
                  {["100", "200", "300", "400", "500", "Postgrad"].map((l) => (
                    <option key={l} value={l}>
                      {l} Level
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
