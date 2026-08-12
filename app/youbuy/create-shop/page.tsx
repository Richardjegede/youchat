"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "../../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function CreateShopPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPlan = searchParams.get("plan"); // Gets 'free', '6-month', or 'yearly'

  const [user, setUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [shopName, setShopName] = useState("");
  const [category, setCategory] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<
    "free" | "6-month" | "yearly"
  >("free");
  const [shopLogo, setShopLogo] = useState("");
  const [shopCover, setShopCover] = useState("");

  // Auto-select the plan based on URL
  useEffect(() => {
    if (urlPlan === "free" || urlPlan === "6-month" || urlPlan === "yearly") {
      setSelectedPlan(urlPlan);
    }
  }, [urlPlan]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) setCoinBalance(userDoc.data().coinBalance || 0);
      } else {
        router.push("/login");
      }
      setLoading(false);
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
        "https://api.cloudinary.com/v1_1/qxd9ghri/image/upload",
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

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Max 5MB.");
      return;
    }
    const url = await uploadToCloudinary(file);
    if (url) {
      if (type === "logo") setShopLogo(url);
      if (type === "cover") setShopCover(url);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !shopName.trim() || !category.trim()) return;
    setSubmitting(true);

    try {
      // 🔥 1. VALIDATION: Check shop limits BEFORE creating
      const existingShopsQuery = query(
        collection(db, "shops"),
        where("ownerId", "==", user.uid),
      );
      const existingShopsSnap = await getDocs(existingShopsQuery);
      const existingShops = existingShopsSnap.docs.map((doc) => doc.data());

      const basicShops = existingShops.filter((s: any) => s.plan === "free");
      const totalShops = existingShops.length;

      // Block if user already has a basic shop and is trying to create another
      if (selectedPlan === "free" && basicShops.length > 0) {
        alert(
          "⚠️ Basic plan allows only 1 shop. You already have a basic shop!\n\nPlease upgrade to Premium or Gold to create more shops, or delete your existing basic shop first.",
        );
        setSubmitting(false);
        router.push("/youbuy/plans");
        return;
      }

      // Block if user has reached max 3 shops
      if (totalShops >= 3) {
        alert(
          "⚠️ You've reached the maximum limit of 3 shops!\n\nPlease delete a shop before creating a new one.",
        );
        setSubmitting(false);
        router.push("/profile");
        return;
      }

      // 🔥 2. CONTINUE WITH CREATION LOGIC
      let planCost = 0;
      let expiryDate: any = null;
      const now = new Date();

      if (selectedPlan === "6-month") {
        planCost = 5000;
        expiryDate = new Date(now.setMonth(now.getMonth() + 6));
      } else if (selectedPlan === "yearly") {
        planCost = 9000;
        expiryDate = new Date(now.setFullYear(now.getFullYear() + 1));
      }

      // 🔥 3. WALLET REDIRECT LOGIC
      if (planCost > 0 && coinBalance < planCost) {
        alert(
          `⚠️ Insufficient Coins! You need ${planCost} coins for the ${selectedPlan} plan.\n\nRedirecting you to your wallet to top up...`,
        );
        router.push("/gifts");
        setSubmitting(false);
        return;
      }

      // 🔥 4. CREATE THE SHOP
      const shopRef = await addDoc(collection(db, "shops"), {
        name: shopName,
        category: category,
        ownerId: user.uid,
        phoneNumber: phoneNumber,
        location: shopLocation,
        plan: selectedPlan,
        status: "active",
        productCount: 0,
        shopLogo: shopLogo || "https://via.placeholder.com/150",
        shopCover: shopCover || "",
        startDate: serverTimestamp(),
        expiryDate: expiryDate,
        createdAt: serverTimestamp(),
      });

      // 🔥 5. DEDUCT COINS IF PAID PLAN
      if (planCost > 0) {
        await updateDoc(doc(db, "users", user.uid), {
          coinBalance: increment(-planCost),
        });
        await addDoc(collection(db, "transactions"), {
          userId: user.uid,
          type: "shop_subscription",
          amount: 0,
          coins: -planCost,
          description: `Purchased ${selectedPlan} Shop Plan`,
          shopId: shopRef.id,
          status: "completed",
          createdAt: serverTimestamp(),
        });
      }

      alert(`🎉 Shop "${shopName}" created successfully!`);
      router.push(`/shop/${shopRef.id}`);
    } catch (error) {
      console.error("Error creating shop:", error);
      alert("Failed to create shop. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 flex justify-center pt-24 pb-24">
        <div className="w-full max-w-3xl bg-[#151515] rounded-2xl p-6 border border-gray-800">
          <h1 className="text-2xl font-bold mb-2 text-cyan-400">
            🏪 Open Your Shop
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Showcase your products to thousands of students.
          </p>

          <form onSubmit={handleCreateShop} className="space-y-6">
            {/* 🔥 SMART PLAN SELECTION: Only show cards if NO plan was pre-selected */}
            {!urlPlan && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  Choose Your Plan
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["free", "6-month", "yearly"].map((plan) => (
                    <div
                      key={plan}
                      onClick={() => setSelectedPlan(plan as any)}
                      className={`cursor-pointer border-2 rounded-xl p-4 transition ${
                        selectedPlan === plan
                          ? plan === "free"
                            ? "border-cyan-500 bg-cyan-500/10"
                            : plan === "6-month"
                              ? "border-yellow-500 bg-yellow-500/10"
                              : "border-purple-500 bg-purple-500/10"
                          : "border-gray-700 bg-[#1a1a1a] hover:border-gray-500"
                      }`}
                    >
                      <h3 className="font-bold text-lg capitalize">
                        {plan === "6-month"
                          ? "⭐ 6 Months"
                          : plan === "yearly"
                            ? "👑 Yearly"
                            : " Free"}
                      </h3>
                      <p
                        className={`text-2xl font-bold mt-1 ${plan === "free" ? "text-white" : plan === "6-month" ? "text-yellow-400" : "text-purple-400"}`}
                      >
                        {plan === "free"
                          ? "0"
                          : plan === "6-month"
                            ? "🪙 5,000"
                            : "🪙 9,000"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🔥 SELECTED PLAN BADGE: Shows ONLY if a plan was pre-selected via URL */}
            {urlPlan && (
              <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Selected Plan</p>
                  <h3 className="text-xl font-bold text-white capitalize">
                    {urlPlan === "6-month"
                      ? "⭐ 6 Months Premium"
                      : urlPlan === "yearly"
                        ? "👑 Yearly Gold"
                        : "🆓 Free Basic"}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Cost</p>
                  <p
                    className={`text-2xl font-bold ${urlPlan === "free" ? "text-white" : urlPlan === "6-month" ? "text-yellow-400" : "text-purple-400"}`}
                  >
                    {urlPlan === "free"
                      ? "0"
                      : urlPlan === "6-month"
                        ? "🪙 5,000"
                        : "🪙 9,000"}
                  </p>
                </div>
              </div>
            )}

            {/* SHOP DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                  placeholder="e.g., Lagos Fashion Hub"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Indicate Your Category *
                </label>
                <input
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                  placeholder="e.g., Fashion, Food, Electronics"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  WhatsApp Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                  placeholder="08012345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Shop Location *
                </label>
                <input
                  type="text"
                  required
                  value={shopLocation}
                  onChange={(e) => setShopLocation(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition"
                  placeholder="e.g., UNILAG, Oshodi"
                />
              </div>
            </div>

            {/* IMAGE UPLOADS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Shop Logo
                </label>
                <div className="border-2 border-dashed border-gray-700 rounded-xl p-4 text-center bg-[#1a1a1a] hover:border-cyan-500 transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, "logo")}
                    className="hidden"
                    id="logo-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="logo-upload" className="cursor-pointer block">
                    {shopLogo ? (
                      <img
                        src={shopLogo}
                        alt="Logo"
                        className="w-16 h-16 rounded-full mx-auto object-cover"
                      />
                    ) : (
                      <>
                        <div className="text-2xl mb-1">🖼️</div>
                        <p className="text-gray-400 text-xs">
                          {uploading ? "Uploading..." : "Click to upload logo"}
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
                  <label
                    htmlFor="cover-upload"
                    className="cursor-pointer block"
                  >
                    {shopCover ? (
                      <img
                        src={shopCover}
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
              disabled={submitting || uploading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-cyan-500/20"
            >
              {submitting
                ? "Creating Your Shop..."
                : uploading
                  ? "Uploading Images..."
                  : `Launch Shop (${selectedPlan === "free" ? "Free" : selectedPlan === "6-month" ? "5,000 Coins" : "9,000 Coins"})`}
            </button>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
