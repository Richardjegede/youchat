"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute"; // 🔥 Kept for bottom nav!

export default function Sell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlShopId = searchParams.get("shopId");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userShops, setUserShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState("");
  const [shopPlan, setShopPlan] = useState<"free" | "6-month" | "yearly">(
    "free",
  );
  const [maxImages, setMaxImages] = useState(10);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    price: "",
    description: "",
    campus: "",
    sellerPhone: "",
  });

  // 🔥 CHANGED TO ARRAYS FOR MULTI-IMAGE
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // 🔥 FETCH USER'S SHOPS ON MOUNT
  useEffect(() => {
    const fetchShops = async () => {
      if (auth.currentUser) {
        try {
          const q = query(
            collection(db, "shops"),
            where("ownerId", "==", auth.currentUser.uid),
          );
          const querySnapshot = await getDocs(q);
          const shopsData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setUserShops(shopsData);

          if (shopsData.length > 0) {
            const defaultShop =
              urlShopId && shopsData.find((s) => s.id === urlShopId)
                ? shopsData.find((s) => s.id === urlShopId)
                : shopsData[0];

            setSelectedShopId(defaultShop.id);
            const plan = defaultShop.plan || "free";
            setShopPlan(plan);

            // 🔥 SET MAX IMAGES BASED ON PLAN
            if (plan === "free") setMaxImages(10);
            else if (plan === "6-month") setMaxImages(15);
            else if (plan === "yearly") setMaxImages(20);
          }
        } catch (err) {
          console.error("Error fetching shops:", err);
        }
      }
    };
    fetchShops();
  }, [urlShopId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔥 HANDLE MULTIPLE IMAGE SELECTION
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = maxImages - imageFiles.length;
    if (files.length > remainingSlots) {
      alert(
        `⚠️ Your ${shopPlan} plan allows a maximum of ${maxImages} images. You can only add ${remainingSlots} more. Delete some to add new ones.`,
      );
      return;
    }

    const newFiles = [...imageFiles, ...files];
    const newPreviews = [
      ...imagePreviews,
      ...files.map((file) => URL.createObjectURL(file)),
    ];

    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  // 🔥 REMOVE AN IMAGE
  const removeImage = (index: number) => {
    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const uploadToCloudinary = async (file: File) => {
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "youbuy-present");
    const res = await fetch(
      "https://api.cloudinary.com/v1_1/qxd9ghri/image/upload",
      {
        method: "POST",
        body: data,
      },
    );
    const uploadData = await res.json();
    return uploadData.secure_url;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      router.push("/login");
      return;
    }
    if (imageFiles.length === 0) {
      alert("Please add at least one image.");
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      // 🔥 UPLOAD ALL IMAGES SIMULTANEOUSLY
      const uploadPromises = imageFiles.map((file) => uploadToCloudinary(file));
      const imageUrls = await Promise.all(uploadPromises);

      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const isSellerVerified = userData.isVerified || false;
      const sellerName = userData.fullName || "Anonymous";

      const docRef = await addDoc(collection(db, "products"), {
        title: formData.title,
        category: formData.category,
        price: Number(formData.price),
        description: formData.description,
        campus: formData.campus,
        images: imageUrls, // 🔥 SAVED AS ARRAY OF IMAGES
        imageUrl: imageUrls[0], // Keep first image as thumbnail for backwards compatibility
        sellerId: auth.currentUser.uid,
        shopId: selectedShopId || null,
        sellerEmail: auth.currentUser.email,
        sellerPhone: formData.sellerPhone,
        sellerName: sellerName,
        isSellerVerified: isSellerVerified,
        status: "available",
        createdAt: serverTimestamp(),
      });

      // 🔥 INCREMENT THE SHOP'S PRODUCT COUNT!
      if (selectedShopId) {
        await updateDoc(doc(db, "shops", selectedShopId), {
          productCount: increment(1),
        });
        router.push(`/shop/${selectedShopId}`);
      } else {
        router.push("/youbuy");
      }
    } catch (err: any) {
      console.error("Error listing item:", err);
      alert("Failed to list item: " + err.message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white pt-24 px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            List an Item for Sale
          </h1>
          <p className="text-gray-400 mb-8">
            Turn your unused items into cash. Reach thousands of verified
            students on your campus.
          </p>

          <form
            onSubmit={handleSubmit}
            className="bg-[#111] border border-gray-800 rounded-2xl p-6 md:p-8 space-y-6"
          >
            {/* 🔥 SHOP SELECTOR */}
            {userShops.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Select Shop to List In
                </label>
                <select
                  value={selectedShopId}
                  onChange={(e) => {
                    setSelectedShopId(e.target.value);
                    const shop = userShops.find((s) => s.id === e.target.value);
                    if (shop) {
                      const plan = shop.plan || "free";
                      setShopPlan(plan);
                      if (plan === "free") setMaxImages(10);
                      else if (plan === "6-month") setMaxImages(15);
                      else if (plan === "yearly") setMaxImages(20);
                    }
                  }}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                  required
                >
                  {userShops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} (
                      {shop.plan === "yearly"
                        ? "Gold"
                        : shop.plan === "6-month"
                          ? "Premium"
                          : "Basic"}
                      )
                    </option>
                  ))}
                </select>
                <p className="text-xs text-cyan-400 mt-1">
                  📸 Your {shopPlan} plan allows up to {maxImages} images per
                  product.
                </p>
              </div>
            )}

            {/* 🔥 MULTI-IMAGE UPLOAD AREA */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Product Photos ({imageFiles.length}/{maxImages})
              </label>

              {/* Image Previews Grid */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
                  {imagePreviews.map((preview, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-700 group"
                    >
                      <img
                        src={preview}
                        alt={`Preview ${index}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Button */}
              {imageFiles.length < maxImages && (
                <div className="relative border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-cyan-500 transition cursor-pointer bg-[#0a0a0a]">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
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
                      Click to add photos
                    </p>
                    <p className="text-gray-600 text-xs">
                      PNG, JPG up to 5MB each
                    </p>
                  </div>
                </div>
              )}
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
                rows={4}
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
              disabled={loading || uploading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-bold py-4 rounded-lg transition transform hover:scale-[1.02] text-lg"
            >
              {uploading
                ? "Uploading Images..."
                : loading
                  ? "Publishing..."
                  : "Publish Listing"}
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
