"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs, // 🔥 ADDED for counting groups
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";

export default function CreateGroupPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("School Information");
  const [privacy, setPrivacy] = useState("private");
  const [groupIcon, setGroupIcon] = useState("");
  const [coverPhoto, setCoverPhoto] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  const uploadToCloudinary = async (file: File, resourceType: string) => {
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "youbuy-present");

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/qxd9ghri/${resourceType}/upload`,
        {
          method: "POST",
          body: data,
        },
      );
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      return result.secure_url;
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "icon" | "cover",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Max size is 5MB.");
      return;
    }
    const url = await uploadToCloudinary(file, "image");
    if (url) {
      if (type === "icon") setGroupIcon(url);
      if (type === "cover") setCoverPhoto(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // 🔥 ANTI-SPAM CHECK: Max 3 groups per user
      const groupsQuery = query(
        collection(db, "groups"),
        where("createdBy", "==", user.uid),
      );
      const snapshot = await getDocs(groupsQuery);

      if (snapshot.size >= 3) {
        alert(
          "⚠️ Limit Reached: You can only create a maximum of 3 groups to prevent spam. Please manage your existing groups.",
        );
        setLoading(false);
        return;
      }

      let creatorName = user.email?.split("@")[0] || "Anonymous";
      let avatar = null;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        if (userDoc.data().fullName) creatorName = userDoc.data().fullName;
        if (userDoc.data().avatar) avatar = userDoc.data().avatar;
      }

      let inviteCode = null;
      if (privacy === "secret") {
        inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      }

      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        description: description,
        category: category,
        privacy: privacy,
        inviteCode: inviteCode,
        groupIcon: groupIcon || "https://via.placeholder.com/150",
        coverPhoto: coverPhoto || "",
        createdBy: user.uid,
        creatorName: creatorName,
        creatorAvatar: avatar,
        memberCount: 1,
        createdAt: serverTimestamp(),
        settings: {
          allowMemberPosts: true,
          allowMediaSharing: true,
          announcementMode: false,
        },
      });

      await setDoc(doc(db, "groups", groupRef.id, "members", user.uid), {
        userId: user.uid,
        role: "admin",
        joinedAt: serverTimestamp(),
        notificationsEnabled: true,
      });

      if (privacy === "secret" && inviteCode) {
        alert(
          `🔒 Secret Group Created!\n\nYour Invite Code is: ${inviteCode}\n\nYou can also copy this code anytime from the group page.`,
        );
      } else {
        alert("Group created successfully! 🎉");
      }

      router.push(`/groups/${groupRef.id}`);
    } catch (error) {
      console.error("Error creating group:", error);
      alert("Failed to create group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... (Keep your existing JSX return statement exactly as it was, it's perfect!)
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 flex justify-center pt-24">
      <div className="w-full max-w-2xl bg-[#151515] rounded-2xl p-6 border border-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-cyan-400">
          Create New Group
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
              placeholder="e.g., UNILAG Computer Science Gist"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Description *
            </label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition resize-none"
              placeholder="What is this group about?"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
              >
                <option>School Information</option>
                <option>Department Gist</option>
                <option>Tutorials / Study Group</option>
                <option>Excos / Executive Meeting</option>
                <option>Event Planning</option>
                <option>Business / Entrepreneurship</option>
                <option>Office / Workplace</option>
                <option>Prayer / Religious Meeting</option>
                <option>Networking</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Privacy
              </label>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
              >
                <option value="public">Public (Anyone can find & join)</option>
                <option value="private">
                  Private (Invite only, Admin approval)
                </option>
                <option value="secret">
                  Secret (Hidden, Invite code only)
                </option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Group Icon
              </label>
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center bg-[#1a1a1a] hover:border-cyan-500 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "icon")}
                  className="hidden"
                  id="icon-upload"
                  disabled={uploading}
                />
                <label htmlFor="icon-upload" className="cursor-pointer block">
                  {groupIcon ? (
                    <img
                      src={groupIcon}
                      alt="Icon"
                      className="w-16 h-16 rounded-full mx-auto object-cover"
                    />
                  ) : (
                    <>
                      <div className="text-2xl mb-1">🖼️</div>
                      <p className="text-gray-400 text-xs">
                        {uploading ? "Uploading..." : "Click to upload icon"}
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Cover Photo
              </label>
              <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center bg-[#1a1a1a] hover:border-cyan-500 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "cover")}
                  className="hidden"
                  id="cover-upload"
                  disabled={uploading}
                />
                <label htmlFor="cover-upload" className="cursor-pointer block">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto}
                      alt="Cover"
                      className="w-full h-24 rounded-lg mx-auto object-cover"
                    />
                  ) : (
                    <>
                      <div className="text-2xl mb-1">🏞️</div>
                      <p className="text-gray-400 text-xs">
                        {uploading ? "Uploading..." : "Click to upload cover"}
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            {loading
              ? "Creating Group..."
              : uploading
                ? "Uploading Images..."
                : "Create Group"}
          </button>
        </form>
      </div>
    </div>
  );
}
