"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";

export default function CreateServicePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState(""); // ✅ Independent location
  const [contactInfo, setContactInfo] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const defaultCategories = [
    "Tutoring",
    "Freelance",
    "Campus Services",
    "Event Planning",
    "Technical Support",
    "Graphic Design",
    "Laundry & Cleaning",
    "Food Delivery",
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else router.push("/login");
    });
    return () => unsubscribe();
  }, [router]);

  const uploadToCloudinary = async (file: File) => {
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "youbuy-present");

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/qxd9ghri/image/upload`,
        { method: "POST", body: data },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      let finalImageUrl = "";
      if (imageFile) {
        finalImageUrl = await uploadToCloudinary(imageFile);
        if (!finalImageUrl) {
          setLoading(false);
          return;
        }
      }

      let creatorName = user.email?.split("@")[0] || "Anonymous";
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().fullName) {
        creatorName = userDoc.data().fullName;
      }

      // 🔥 SAVE TO FIRESTORE WITH LOCATION
      await addDoc(collection(db, "services"), {
        title: title.trim(),
        category: category.trim() || "Other",
        description: description.trim(),
        price: Number(price),
        location: location.trim(), // ✅ This is being saved!
        contactInfo: contactInfo.trim(),
        imageUrl: finalImageUrl,
        creatorId: user.uid,
        creatorName: creatorName,
        createdAt: serverTimestamp(),
        status: "active",
      });

      alert("Service posted successfully! ");
      router.push("/services"); // ✅ Redirects to services page
      router.refresh(); // ✅ Forces a refresh
    } catch (error) {
      console.error("Error creating service:", error);
      alert("Failed to post service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 flex justify-center pt-24 pb-20">
      <div className="w-full max-w-2xl bg-[#151515] rounded-2xl p-6 border border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-cyan-400">Offer a Service</h1>
          <Link
            href="/services"
            className="text-gray-400 hover:text-white text-sm"
          >
            Cancel
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Service Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
              placeholder="e.g., JAMB Math Tutorial"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Category (Type your own)
              </label>
              <input
                list="category-options"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                placeholder="e.g., Graphic Design"
                required
              />
              <datalist id="category-options">
                {defaultCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Price (₦) *
              </label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                placeholder="2000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Shop/Service Location *
            </label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
              placeholder="e.g., UNILAG, Yaba, Lagos"
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
              rows={4}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition resize-none"
              placeholder="Describe your service..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              WhatsApp / Phone *
            </label>
            <input
              type="text"
              required
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
              placeholder="08012345678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Image (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center bg-[#1a1a1a] hover:border-cyan-500 transition cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="hidden"
                id="service-image"
              />
              <label htmlFor="service-image" className="cursor-pointer block">
                {imageFile ? (
                  <p className="text-cyan-400 font-semibold">
                    {imageFile.name}
                  </p>
                ) : (
                  <>
                    <div className="text-2xl mb-1">📸</div>
                    <p className="text-gray-400 text-xs">
                      {uploading ? "Uploading..." : "Click to upload"}
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition disabled:opacity-50 mt-4"
          >
            {loading || uploading ? "Posting..." : "Post Service"}
          </button>
        </form>
      </div>
    </div>
  );
}
