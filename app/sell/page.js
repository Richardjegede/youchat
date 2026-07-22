"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore"; // 🔥 ADDED doc, getDoc
import { auth, db } from "../lib/firebase";

export default function Sell() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    campus: "",
    sellerPhone: "",
  });

  // NEW: States for Image Upload
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // NEW: Handle Image Selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("✅ 1. Form submitted! Button clicked.");

    // Check if user is logged in
    if (!auth.currentUser) {
      console.log("❌ 2. ERROR: User is NOT logged in!");
      router.push("/login");
      return;
    }
    console.log("✅ 2. User is logged in:", auth.currentUser.email);

    setLoading(true);
    console.log("✅ 3. Loading set to true. Starting Upload...");

    try {
      let imageUrl =
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80"; // Default fallback image

      // 🚀 NEW: UPLOAD IMAGE TO CLOUDINARY
      if (imageFile) {
        console.log("📸 4. Uploading image to Cloudinary...");
        const data = new FormData();
        data.append("file", imageFile);
        data.append("upload_preset", "youbuy-present"); // YOUR EXACT PRESET

        const uploadRes = await fetch(
          "https://api.cloudinary.com/v1_1/qxd9ghri/image/upload", // YOUR EXACT CLOUD NAME
          { method: "POST", body: data },
        );

        const uploadData = await uploadRes.json();
        if (uploadData.secure_url) {
          imageUrl = uploadData.secure_url;
          console.log("🎉 5. Image uploaded successfully! URL:", imageUrl);
        }
      }

      console.log("🔥 6. Fetching user verification status...");

      // 🔥 MAGIC STEP: Check if the seller is verified
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const isSellerVerified = userData.isVerified || false;
      const sellerName = userData.fullName || "Anonymous";

      console.log("🔥 7. Sending data to Firestore...");

      const docRef = await addDoc(collection(db, "products"), {
        title: formData.title,
        category: formData.category,
        price: Number(formData.price),
        description: formData.description,
        campus: formData.campus,
        imageUrl: imageUrl, // Using the Cloudinary URL!
        sellerId: auth.currentUser.uid,
        sellerEmail: auth.currentUser.email,
        sellerPhone: formData.sellerPhone,
        sellerName: sellerName, // 🔥 ADDED: So the feed knows the name
        isSellerVerified: isSellerVerified, // 🔥 THE MAGIC LINE THAT TRIGGERS THE BLUE TICK!
        createdAt: serverTimestamp(),
      });

      console.log("🎉 8. SUCCESS! Document written with ID:", docRef.id);

      // Auto-redirect to feed (No alert, just smooth transition!)
      router.push("/feed");
    } catch (err) {
      console.error("💥 BIG ERROR CAUGHT:", err);
      alert("Failed to list item: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 pb-20">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          List an Item for Sale
        </h1>
        <p className="text-gray-400 mb-8">
          Turn your unused items into cash. Reach thousands of verified students
          on your campus.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8 space-y-6"
        >
          {/* 📸 NEW: BEAUTIFUL IMAGE UPLOAD AREA */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Product Photos
            </label>
            <div className="relative border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-cyan-500 transition cursor-pointer bg-[#0a0a0a]">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 mx-auto rounded-lg object-cover"
                />
              ) : (
                <div>
                  <svg
                    className="w-12 h-12 mx-auto text-gray-500 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-gray-400 text-sm mb-1">
                    Click to upload photo
                  </p>
                  <p className="text-gray-600 text-xs">PNG, JPG up to 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* TITLE */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Item Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., HP Pavilion Laptop (Core i5)"
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              required
            />
          </div>

          {/* CATEGORY & PRICE ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Category
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                required
              >
                <option value="">Select a category</option>
                <option value="Electronics">Electronics</option>
                <option value="Textbooks">Textbooks</option>
                <option value="Hostel Items">Hostel Items</option>
                <option value="Fashion">Fashion</option>
                <option value="Services">Services</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Price (₦)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">
                  ₦
                </span>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                  required
                />
              </div>
            </div>
          </div>

          {/* CAMPUS LOCATION */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Campus Location
            </label>
            <select
              name="campus"
              value={formData.campus}
              onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              required
            >
              <option value="">Where are you selling this?</option>
              <option value="UNILAG">UNILAG (University of Lagos)</option>
              <option value="UI">UI (University of Ibadan)</option>
              <option value="FUTA">
                FUTA (Federal Univ. of Technology, Akure)
              </option>
              <option value="UNIBEN">UNIBEN (University of Benin)</option>
              <option value="OAU">OAU (Obafemi Awolowo University)</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Describe the condition of the item, why you're selling it, and any defects..."
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition resize-none"
              required
            ></textarea>
          </div>

          {/* PHONE NUMBER */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              WhatsApp Number
            </label>
            <input
              type="tel"
              name="sellerPhone"
              value={formData.sellerPhone}
              onChange={handleChange}
              placeholder="08012345678"
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Buyers will contact you on this number
            </p>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-bold py-4 rounded-lg transition transform hover:scale-[1.02] text-lg"
          >
            {loading ? "Uploading & Publishing..." : "Publish Listing"}
          </button>
        </form>
      </div>
    </div>
  );
}
