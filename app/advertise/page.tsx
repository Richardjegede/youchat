"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import ProtectedRoute from "../components/ProtectedRoute";

export default function Advertise() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [adCaption, setAdCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    console.log("👤 Current User:", user?.uid);
    console.log("💰 Coin Balance:", coinBalance);
    console.log("📦 Selected Package:", selectedPackage);
    console.log(" Uploaded URLs:", uploadedUrls);
  }, [user, coinBalance, selectedPackage, uploadedUrls]);

  const packages = [
    {
      id: "feed_boost",
      name: "🚀 Feed Boost (Carousel)",
      priceCoins: 100,
      desc: "Pin a multi-image/video carousel to the top of the feed for 24 hours.",
    },
    {
      id: "story_sponsor",
      name: " Story Sponsor (Swipeable)",
      priceCoins: 100,
      desc: "Appear in the main Story carousel for 24 hours. Users can swipe through your media.",
    },
    {
      id: "custom_campaign",
      name: "🏢 Custom Campaign",
      priceCoins: 0,
      desc: "Contact admin for banner ads and bulk promotions.",
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const images = selectedFiles.filter((f) => f.type.startsWith("image/"));
      const videos = selectedFiles.filter((f) => f.type.startsWith("video/"));

      if (selectedPackage === "story_sponsor") {
        if (images.length > 8) {
          alert("Max 8 images for Story Ads!");
          return;
        }
        if (videos.length > 4) {
          alert("Max 4 videos for Story Ads!");
          return;
        }
      } else if (selectedPackage === "feed_boost") {
        if (selectedFiles.length > 10) {
          alert("Max 10 files for Feed Ads!");
          return;
        }
      }

      setFiles(selectedFiles);
      setUploadedUrls([]);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      alert("Please select files first!");
      return;
    }

    setUploading(true);
    const urls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(` Uploading file ${i + 1}:`, file.name);

        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", "youbuy-present");
        data.append("cloud_name", "qxd9ghri");

        const resourceType = file.type.startsWith("video") ? "video" : "image";
        data.append("resource_type", resourceType);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/qxd9ghri/${resourceType}/upload`,
          { method: "POST", body: data },
        );

        if (!res.ok) {
          const errorText = await res.text();
          console.error("❌ Cloudinary Error:", errorText);
          alert(`Upload failed: ${errorText}`);
          setUploading(false);
          return;
        }

        const result = await res.json();
        console.log("✅ Success:", result.secure_url);

        if (result.secure_url) {
          urls.push(result.secure_url);
        }
      }

      setUploadedUrls(urls);
      alert(`✅ Successfully uploaded ${urls.length} files!`);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload files.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitAd = async () => {
    if (!user) {
      alert("❌ No user logged in!");
      return;
    }
    if (!selectedPackage || selectedPackage === "custom_campaign") {
      alert("For custom campaigns, please contact support@youchat.com");
      return;
    }
    if (!adCaption.trim()) {
      alert("Please enter a caption for your ad.");
      return;
    }
    if (uploadedUrls.length === 0) {
      alert(" No files uploaded! Please click 'Upload Files' first.");
      return;
    }

    const pkg = packages.find((p) => p.id === selectedPackage);
    if (!pkg) return;

    console.log(
      "📊 Coin Balance:",
      coinBalance,
      "Package Cost:",
      pkg.priceCoins,
    );

    if (coinBalance < pkg.priceCoins) {
      alert(
        `Insufficient coins! You need ${pkg.priceCoins} coins. Current balance: ${coinBalance}`,
      );
      return;
    }

    console.log("✅ All checks passed, creating ad...");
    setSubmitting(true);

    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mediaItems = uploadedUrls.map((url) => ({
        url,
        type:
          url.includes("video") || url.includes("upload/video")
            ? "video"
            : "image",
      }));

      console.log("🚀 Creating ad with package:", selectedPackage);
      console.log("📦 Media items:", mediaItems);

      if (selectedPackage === "feed_boost") {
        const docRef = await addDoc(collection(db, "feed"), {
          type: "sponsored",
          authorName: "Sponsored",
          authorUsername: "sponsored",
          authorId: user.uid,
          isSponsored: true,
          sponsoredUntil: expiresAt,
          expiresAt: expiresAt,
          createdAt: serverTimestamp(),
          likes: 0,
          commentsList: [],
          giftCount: 0,
          mediaItems: mediaItems,
          content: adCaption,
        });
        console.log("✅ Feed ad created with ID:", docRef.id);
      } else if (selectedPackage === "story_sponsor") {
        const docRef = await addDoc(collection(db, "stories"), {
          userId: "sponsored_system",
          userName: "Sponsored",
          userAvatar: "📢",
          isSponsored: true,
          sponsoredUntil: expiresAt,
          expiresAt: expiresAt, // 🔥 CRITICAL: Added so query can find it
          createdAt: serverTimestamp(),
          viewers: [],
          mediaItems: mediaItems,
          mediaUrl: uploadedUrls[0],
          mediaType: mediaItems[0].type,
        });
        console.log("✅ Story ad created with ID:", docRef.id);
        console.log("📝 Saved with expiresAt:", expiresAt);
      }

      console.log("💰 Deducting", pkg.priceCoins, "coins from user", user.uid);

      await updateDoc(doc(db, "users", user.uid), {
        coinBalance: increment(-pkg.priceCoins),
      });

      await addDoc(collection(db, "transactions"), {
        userId: user.uid,
        type: "ad_purchase",
        amount: 0,
        coins: -pkg.priceCoins,
        description: `Purchased ${pkg.name}`,
        status: "completed",
        createdAt: serverTimestamp(),
      });

      alert(`🚀 Ad activated successfully! It is now live.`);
      router.push("/");

      setSelectedPackage(null);
      setFiles([]);
      setUploadedUrls([]);
      setAdCaption("");
      setCoinBalance((prev: number) => prev - pkg.priceCoins);
    } catch (err: any) {
      console.error("❌ Ad submission error:", err);
      alert(`Failed to activate ad. Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
        <div className="max-w-2xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">📢 Advertise on YouChat</h1>
          <p className="text-gray-400 mb-6">
            Everyone is born a star, so rise and grow your brand.
          </p>

          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-6 mb-8 shadow-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-yellow-100 mb-1">Your Ad Budget</p>
                <p className="text-3xl font-bold text-white">
                  🪙 {coinBalance.toLocaleString()} Coins
                </p>
              </div>
              <button
                onClick={() => router.push("/gifts")}
                className="bg-white text-orange-600 px-4 py-2 rounded-full font-bold text-sm hover:bg-gray-100 transition"
              >
                + Buy Coins
              </button>
            </div>
          </div>

          <h2 className="text-xl font-bold mb-4">Choose a Package</h2>
          <div className="space-y-4 mb-8">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => {
                  setSelectedPackage(pkg.id);
                  setFiles([]);
                  setUploadedUrls([]);
                }}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition ${
                  selectedPackage === pkg.id
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-gray-800 bg-[#111] hover:border-gray-600"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-white">{pkg.name}</h3>
                  {pkg.priceCoins > 0 ? (
                    <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
                      {pkg.priceCoins} Coins
                    </span>
                  ) : (
                    <span className="bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded-full">
                      Contact Admin
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-sm">{pkg.desc}</p>
              </div>
            ))}
          </div>

          {selectedPackage && selectedPackage !== "custom_campaign" && (
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4">Build Your Ad</h3>
              <div className="mb-6">
                <label className="block text-xs text-gray-400 mb-2">
                  Upload Media (Max{" "}
                  {selectedPackage === "story_sponsor"
                    ? "8 images / 4 videos"
                    : "10 files"}
                  )
                </label>
                <input
                  id="ad-file-upload"
                  name="ad-file-upload"
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-700 rounded-xl p-6 text-center hover:border-yellow-500 transition bg-[#1a1a1a]"
                >
                  <div className="text-3xl mb-2">📁</div>
                  <p className="text-gray-400 text-sm">
                    {files.length > 0
                      ? `${files.length} file(s) selected`
                      : "Click to select images/videos from your device"}
                  </p>
                </button>

                {files.length > 0 && uploadedUrls.length === 0 && (
                  <button
                    onClick={uploadFiles}
                    disabled={uploading}
                    className="w-full mt-4 bg-cyan-500 text-black font-bold py-3 rounded-xl transition disabled:opacity-50"
                  >
                    {uploading
                      ? "Uploading to Cloud..."
                      : `Upload ${files.length} Files`}
                  </button>
                )}

                {uploadedUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {uploadedUrls.map((url, i) => (
                      <div
                        key={i}
                        className="aspect-square bg-gray-900 rounded-lg overflow-hidden relative"
                      >
                        {url.includes("video") ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img
                            src={url}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                          {i + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-xs text-gray-400 mb-1">
                  Ad Caption *
                </label>
                <textarea
                  value={adCaption}
                  onChange={(e) => setAdCaption(e.target.value)}
                  placeholder="What do you want to promote?"
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleSubmitAd}
                disabled={
                  submitting || uploadedUrls.length === 0 || !adCaption.trim()
                }
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-black font-bold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Activating Ad..."
                  : `Launch Ad for ${packages.find((p) => p.id === selectedPackage)?.priceCoins} Coins`}
              </button>
            </div>
          )}

          {selectedPackage === "custom_campaign" && (
            <div className="bg-[#111] border border-gray-800 rounded-2xl p-6 text-center">
              <p className="text-gray-300 mb-4">
                For large-scale campaigns, banner ads, or special partnerships,
                please reach out to us directly.
              </p>
              <a
                href="mailto:support@youchat.com"
                className="inline-block bg-cyan-500 text-black font-bold px-6 py-3 rounded-xl hover:bg-cyan-400 transition"
              >
                ✉️ Email Support
              </a>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
