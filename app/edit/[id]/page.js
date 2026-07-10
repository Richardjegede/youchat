"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // 2 dots because we are inside edit/[id]
import Link from "next/link";

export default function EditListing() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    campus: "",
    sellerPhone: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState("");

  // 1. FETCH EXISTING DATA ON PAGE LOAD
  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            title: data.title || "",
            category: data.category || "",
            price: data.price?.toString() || "",
            description: data.description || "",
            campus: data.campus || "",
            sellerPhone: data.sellerPhone || "",
          });
          setOriginalImageUrl(data.imageUrl || "");
          setImagePreview(data.imageUrl || "");
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, router]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let finalImageUrl = originalImageUrl; // Keep old image by default

      // Upload new image ONLY if user selected a new one
      if (imageFile) {
        const data = new FormData();
        data.append("file", imageFile);
        data.append("upload_preset", "youbuy-present");

        const uploadRes = await fetch(
          "https://api.cloudinary.com/v1_1/qxd9ghri/image/upload",
          { method: "POST", body: data },
        );
        const uploadData = await uploadRes.json();
        if (uploadData.secure_url) {
          finalImageUrl = uploadData.secure_url;
        }
      }

      // UPDATE FIRESTORE
      const productRef = doc(db, "products", id);
      await updateDoc(productRef, {
        title: formData.title,
        category: formData.category,
        price: Number(formData.price),
        description: formData.description,
        campus: formData.campus,
        sellerPhone: formData.sellerPhone,
        imageUrl: finalImageUrl,
        updatedAt: new Date().toISOString(),
      });

      console.log("✅ Listing updated successfully!");
      router.push("/dashboard"); // Auto-redirect to dashboard
    } catch (err) {
      console.error("Error updating listing:", err);
      alert("Failed to update listing. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pt-20">
        <p className="text-xl text-gray-400">Loading listing details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 pb-20">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="text-cyan-400 hover:text-cyan-300 mb-6 inline-block"
        >
          ← Back to Dashboard
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold mb-2">Edit Listing</h1>
        <p className="text-gray-400 mb-8">
          Update your item details, price, or contact info.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8 space-y-6"
        >
          {/* IMAGE UPLOAD */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Product Photo
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
                <p className="text-gray-400">Click to change photo</p>
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
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              required
            />
          </div>

          {/* CATEGORY & PRICE */}
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
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                required
              />
            </div>
          </div>

          {/* CAMPUS & PHONE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Campus / Institution
              </label>
              <select
                name="campus"
                value={formData.campus}
                onChange={handleChange}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                required
              >
                <option value="">Select campus</option>
                <option value="UNILAG">UNILAG</option>
                <option value="UI">UI</option>
                <option value="FUTA">FUTA</option>
                <option value="UNIBEN">UNIBEN</option>
                <option value="OAU">OAU</option>
                <option value="Other">Other</option>
              </select>
            </div>
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
            </div>
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
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition resize-none"
              required
            ></textarea>
          </div>

          {/* SAVE BUTTON */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-bold py-4 rounded-lg transition transform hover:scale-[1.02] text-lg"
          >
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
