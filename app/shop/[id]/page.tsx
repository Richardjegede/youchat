"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";

// 🔥 STAR RATING HELPER
const renderStars = (rating: number, size = "w-4 h-4") => {
  const stars = [];
  const rounded = Math.round(rating || 0);
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <svg
        key={i}
        className={`${size} ${i <= rounded ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>,
    );
  }
  return stars;
};

export default function ShopPage() {
  const { id } = useParams();
  const router = useRouter();
  const shopId = id as string;

  const [shop, setShop] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  const [editData, setEditData] = useState({
    name: "",
    category: "",
    phoneNumber: "",
    location: "",
    description: "",
  });

  useEffect(() => {
    if (!shopId) return;
    const fetchShopData = async () => {
      try {
        const shopDoc = await getDoc(doc(db, "shops", shopId));
        if (shopDoc.exists()) {
          const shopData = { id: shopDoc.id, ...shopDoc.data() };
          setShop(shopData);
          setEditData({
            name: shopData.name || "",
            category: shopData.category || "",
            phoneNumber: shopData.phoneNumber || "",
            location: shopData.location || "",
            description: shopData.description || "",
          });

          if (shopData.ownerId) {
            const userDoc = await getDoc(doc(db, "users", shopData.ownerId));
            if (userDoc.exists()) setOwner(userDoc.data());
          }

          const productsQuery = query(
            collection(db, "products"),
            where("shopId", "==", shopId),
          );
          let productsSnapshot = await getDocs(productsQuery);

          if (productsSnapshot.empty && shopData.ownerId) {
            const fallbackQuery = query(
              collection(db, "products"),
              where("sellerId", "==", shopData.ownerId),
            );
            productsSnapshot = await getDocs(fallbackQuery);
          }
          setProducts(
            productsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          );
        }
      } catch (err) {
        console.error("Error fetching shop data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchShopData();
  }, [shopId]);

  const activeProducts = products.filter((p) => p.status !== "sold").length;
  const soldProducts = products.filter((p) => p.status === "sold");
  const totalRevenue = soldProducts.reduce(
    (sum, p) => sum + (Number(p.price) || 0),
    0,
  );

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShop(true);
    try {
      await updateDoc(doc(db, "shops", shopId), editData);
      setShop({ ...shop, ...editData });
      setShowEditModal(false);
      alert("✅ Shop details updated!");
    } catch (err) {
      console.error(err);
      alert("Failed to update shop.");
    } finally {
      setSavingShop(false);
    }
  };

  const handleDeleteShop = async () => {
    try {
      for (const p of products) await deleteDoc(doc(db, "products", p.id));
      await deleteDoc(doc(db, "shops", shopId));
      alert("🗑️ Shop deleted.");
      router.push("/youbuy");
    } catch (err) {
      console.error(err);
      alert("Failed to delete shop.");
    }
  };

  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !shop) return;
    const currentMedia = shop.mediaGallery?.length || 0;
    if (shop.plan === "free") {
      alert("⚠️ Media upload is only for Premium/Gold plans!");
      return;
    }
    if (currentMedia >= 2) {
      alert("⚠️ Max 2 media allowed. Delete one first.");
      return;
    }

    setUploadingMedia(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", "youbuy-present");
      const resourceType = file.type.startsWith("video") ? "video" : "image";
      data.append("resource_type", resourceType);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/qxd9ghri/${resourceType}/upload`,
        { method: "POST", body: data },
      );
      const result = await res.json();
      if (result.secure_url) {
        const newMedia = { type: resourceType, url: result.secure_url };
        const updated = [...(shop.mediaGallery || []), newMedia];
        await updateDoc(doc(db, "shops", shop.id), { mediaGallery: updated });
        setShop({ ...shop, mediaGallery: updated });
        setShowMediaModal(false);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to upload.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (index: number) => {
    if (
      !confirm(
        "Delete this media permanently? It will be removed from Cloudinary storage.",
      )
    )
      return;
    try {
      const mediaToDelete = shop.mediaGallery[index];

      // 🔥 DELETE FROM CLOUDINARY FIRST
      if (mediaToDelete.url && mediaToDelete.url.includes("cloudinary.com")) {
        await fetch("/api/delete-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: mediaToDelete.url }),
        });
      }

      // 🔥 THEN DELETE FROM FIRESTORE
      const updated = shop.mediaGallery.filter(
        (_: any, i: number) => i !== index,
      );
      await updateDoc(doc(db, "shops", shop.id), { mediaGallery: updated });
      setShop({ ...shop, mediaGallery: updated });
    } catch (err) {
      console.error(err);
      alert("Failed to delete media.");
    }
  };

  const handleRateProduct = async (rating: number) => {
    if (!selectedProduct) return;
    if (auth.currentUser?.uid === shop.ownerId) {
      alert("⚠️ You cannot rate your own shop or products!");
      return;
    }

    setUserRating(rating);
    try {
      const newRatingObj = {
        userId: auth.currentUser?.uid,
        rating,
        createdAt: new Date().toISOString(),
      };
      const existingRatings = selectedProduct.ratings || [];
      const alreadyRatedIndex = existingRatings.findIndex(
        (r: any) => r.userId === auth.currentUser?.uid,
      );
      let allRatings = [...existingRatings];

      if (alreadyRatedIndex !== -1) {
        allRatings[alreadyRatedIndex] = {
          ...allRatings[alreadyRatedIndex],
          rating,
        };
      } else {
        allRatings.push(newRatingObj);
      }

      const avg =
        allRatings.reduce((sum: number, r: any) => sum + r.rating, 0) /
        allRatings.length;

      await updateDoc(doc(db, "products", selectedProduct.id), {
        ratings: allRatings,
        averageRating: avg,
        ratingCount: allRatings.length,
      });

      const shopProductsQuery = query(
        collection(db, "products"),
        where("shopId", "==", shopId),
      );
      const shopProductsSnap = await getDocs(shopProductsQuery);

      let shopTotalRatingSum = 0;
      let shopTotalReviews = 0;

      shopProductsSnap.docs.forEach((docSnap) => {
        const pData = docSnap.data();
        if (pData.ratingCount > 0) {
          shopTotalRatingSum += pData.averageRating * pData.ratingCount;
          shopTotalReviews += pData.ratingCount;
        }
      });

      const shopAvg =
        shopTotalReviews > 0 ? shopTotalRatingSum / shopTotalReviews : 0;

      await updateDoc(doc(db, "shops", shopId), {
        rating: parseFloat(shopAvg.toFixed(1)),
        reviewCount: shopTotalReviews,
      });

      setSelectedProduct({
        ...selectedProduct,
        ratings: allRatings,
        averageRating: avg,
        ratingCount: allRatings.length,
      });
      setShop({
        ...shop,
        rating: parseFloat(shopAvg.toFixed(1)),
        reviewCount: shopTotalReviews,
      });
      alert(`✅ You rated this ${rating} star${rating > 1 ? "s" : ""}!`);
    } catch (err) {
      console.error(err);
      alert("Failed to submit rating.");
    }
  };

  const handleMarkAsSold = async (productId: string) => {
    try {
      await updateDoc(doc(db, "products", productId), { status: "sold" });
      setProducts(
        products.map((p) =>
          p.id === productId ? { ...p, status: "sold" } : p,
        ),
      );
      if (selectedProduct && selectedProduct.id === productId) {
        setSelectedProduct({ ...selectedProduct, status: "sold" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (
      !confirm(
        "Delete this product permanently? This will also remove its images from storage.",
      )
    )
      return;

    try {
      const productToDelete = products.find((p) => p.id === productId);

      if (productToDelete) {
        const imagesToDelete = productToDelete.images || [
          productToDelete.imageUrl,
        ];

        for (const imgUrl of imagesToDelete) {
          if (imgUrl && imgUrl.includes("cloudinary.com")) {
            await fetch("/api/delete-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageUrl: imgUrl }),
            });
          }
        }
      }

      await deleteDoc(doc(db, "products", productId));
      setProducts(products.filter((p) => p.id !== productId));
      if (selectedProduct && selectedProduct.id === productId)
        setShowProductModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to delete product.");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  if (!shop)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        Shop not found.
      </div>
    );

  const isOwner = auth.currentUser?.uid === shop.ownerId;
  const canUploadMedia = shop.plan === "6-month" || shop.plan === "yearly";
  const phoneNumber = shop.phoneNumber || owner?.phoneNumber || "2348000000000";
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi! I found "${selectedProduct?.title || shop.name}" on YouChat.`)}`;
  const chatLink = `/messages/new?userId=${shop.ownerId}&shopId=${shop.id}`;

  return (
    <ProtectedRoute>
      <style jsx global>{`
        body {
          overflow-x: hidden;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 pt-16 no-scrollbar">
        <div
          className="max-w-3xl mx-auto px-4 -mt-2"
          onClick={() => setShowOptions(false)}
        >
          {/* COVER PHOTO */}
          <div className="relative h-32 md:h-40 bg-gradient-to-r from-purple-600 to-cyan-600 overflow-hidden md:rounded-b-2xl">
            {shop.shopCover ? (
              <img
                src={shop.shopCover}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-black/20"></div>
            )}
          </div>

          {/* SHOP INFO */}
          <div className="relative px-4 pb-6">
            <div className="w-24 h-24 rounded-full border-4 border-[#0a0a0a] overflow-hidden bg-gray-800 flex items-center justify-center text-3xl font-bold text-cyan-400 shadow-xl -mt-12 relative z-10">
              {shop.shopLogo ? (
                <img
                  src={shop.shopLogo}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                shop.name?.charAt(0).toUpperCase() || "?"
              )}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <h1 className="text-2xl font-bold">{shop.name}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${shop.plan === "yearly" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : shop.plan === "6-month" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}
              >
                {shop.plan === "yearly"
                  ? "👑 Gold"
                  : shop.plan === "6-month"
                    ? "⭐ Premium"
                    : "Basic"}
              </span>
            </div>

            {shop.rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <div className="flex">
                  {renderStars(shop.rating, "w-4 h-4")}
                </div>
                <span className="text-gray-400 text-xs">
                  ({shop.reviewCount || 0} reviews)
                </span>
              </div>
            )}

            <p className="text-gray-400 text-sm mt-1">
              {shop.category || "General Store"} • {shop.location || "Campus"}
            </p>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap gap-3 mb-8 px-4">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </a>

            {owner && (
              <Link
                href={isOwner ? "/profile" : `/user/${shop.ownerId}`}
                className="flex-1 md:flex-none bg-[#1a1a1a] hover:bg-[#222] border border-gray-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm transition flex items-center justify-center gap-2"
              >
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {isOwner ? "My Profile" : "View Profile"}
              </Link>
            )}

            {isOwner && (
              <Link
                href={`/sell?shopId=${shop.id}`}
                className="flex-1 md:flex-none bg-cyan-500 hover:bg-cyan-400 text-black px-5 py-2.5 rounded-full font-bold text-sm transition flex items-center justify-center gap-1"
              >
                + List Product
              </Link>
            )}
          </div>

          {/* ANALYTICS */}
          {isOwner && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-[#111] border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">
                  {activeProducts}
                </p>
                <p className="text-gray-400 text-xs uppercase">Active Items</p>
              </div>
              <div className="bg-[#111] border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-cyan-400">
                  {soldProducts.length}
                </p>
                <p className="text-gray-400 text-xs uppercase">Items Sold</p>
              </div>
              <div className="bg-[#111] border border-gray-800 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {totalRevenue.toLocaleString()}
                </p>
                <p className="text-gray-400 text-xs uppercase">Est. Revenue</p>
              </div>
            </div>
          )}

          {/* COMPACT MEDIA GALLERY */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Shop Gallery</h2>
              {isOwner &&
                canUploadMedia &&
                (shop.mediaGallery?.length || 0) < 2 && (
                  <button
                    onClick={() => setShowMediaModal(true)}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold px-4 py-2 rounded-full transition"
                  >
                    + Add Media
                  </button>
                )}
            </div>
            {shop.mediaGallery && shop.mediaGallery.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {shop.mediaGallery.map((media: any, idx: number) => (
                  <div
                    key={idx}
                    className="relative aspect-square bg-gray-900 rounded-lg overflow-hidden group cursor-pointer"
                    onClick={() => {
                      setSelectedMedia(media);
                      setShowMediaViewer(true);
                    }}
                  >
                    {media.type === "video" ? (
                      <video
                        src={media.url}
                        className="w-full h-full object-cover"
                        muted
                        loop
                      />
                    ) : (
                      <img
                        src={media.url}
                        alt="Gallery"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {isOwner && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteMedia(idx);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
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
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#111] border border-gray-800 rounded-xl border-dashed">
                <p className="text-gray-500 text-sm">
                  {isOwner && !canUploadMedia
                    ? "⚠️ Upgrade to Premium/Gold to add media!"
                    : "No media uploaded yet."}
                </p>
              </div>
            )}
          </div>

          {/* HORIZONTAL PRODUCT LIST */}
          <h2 className="text-2xl font-bold mb-4">Shop Inventory</h2>
          {products.length === 0 ? (
            <div className="text-center py-12 bg-[#111] border border-gray-800 rounded-xl">
              <p className="text-gray-400 mb-4">
                This shop is setting up inventory.
              </p>
              {isOwner && (
                <Link
                  href={`/sell?shopId=${shop.id}`}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 py-2 rounded-full inline-block transition"
                >
                  + List Your First Product
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {products
                .filter((p) => p.status !== "sold")
                .map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setUserRating(0);
                      setShowProductModal(true);
                    }}
                    className="flex gap-4 bg-[#111] border border-gray-800 rounded-xl p-3 cursor-pointer hover:border-cyan-500 transition group"
                  >
                    <div className="w-24 h-24 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                      <div>
                        <h3 className="font-bold text-white text-base truncate mb-1">
                          {product.title}
                        </h3>
                        <p className="text-gray-400 text-xs line-clamp-2">
                          {product.description || "No description available."}
                        </p>
                        {product.averageRating > 0 ? (
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex">
                              {renderStars(product.averageRating, "w-3 h-3")}
                            </div>
                            <span className="text-gray-500 text-[10px]">
                              ({product.ratingCount || 0})
                            </span>
                          </div>
                        ) : (
                          <p className="text-gray-600 text-[10px] mt-1">
                            No ratings yet
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-end mt-2">
                        <p className="text-cyan-400 font-bold text-lg">
                          ₦{Number(product.price).toLocaleString()}
                        </p>
                        <span className="text-gray-500 text-xs group-hover:text-cyan-400 transition">
                          View →
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* MEDIA VIEWER MODAL */}
        {showMediaViewer && selectedMedia && (
          <div
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setShowMediaViewer(false)}
          >
            <button
              onClick={() => setShowMediaViewer(false)}
              className="absolute top-4 right-4 text-white bg-black/50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/80 z-10"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div
              className="relative max-w-sm md:max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-square bg-gray-900 rounded-2xl overflow-hidden">
                {selectedMedia.type === "video" ? (
                  <video
                    src={selectedMedia.url}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedMedia.url}
                    alt="Full view"
                    className="w-full h-full object-contain"
                  />
                )}
                <button className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm transition">
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
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  Favorite
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCT DETAILS MODAL */}
        {showProductModal && selectedProduct && (
          <div
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setShowProductModal(false)}
          >
            <button
              onClick={() => setShowProductModal(false)}
              className="absolute top-4 right-4 text-white bg-black/50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/80 z-10"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div
              className="bg-[#111] border border-gray-800 rounded-2xl max-w-sm md:max-w-md w-full max-h-[85vh] overflow-y-auto no-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-video bg-gray-900 rounded-t-2xl overflow-hidden">
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.title}
                  className="w-full h-full object-cover"
                />
                <button className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm transition">
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
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                  Favorite
                </button>
              </div>

              <div className="p-5">
                <h2 className="text-xl font-bold mb-1">
                  {selectedProduct.title}
                </h2>
                <p className="text-cyan-400 font-bold text-2xl mb-3">
                  ₦{Number(selectedProduct.price).toLocaleString()}
                </p>

                <p className="text-gray-400 text-xs mb-3 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {shop.location || "Campus"}
                </p>

                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                  {selectedProduct.description || "No description available."}
                </p>

                <div className="mb-4 p-3 bg-[#1a1a1a] rounded-xl border border-gray-800">
                  <p className="text-xs text-gray-400 mb-2">
                    Rate this product:
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => handleRateProduct(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="transition transform hover:scale-110"
                        >
                          <svg
                            className={`w-6 h-6 ${(hoverRating || userRating) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      ({selectedProduct.ratingCount || 0} reviews)
                    </span>
                  </div>
                </div>

                {isOwner && (
                  <div className="grid grid-cols-3 gap-2 mb-4 pt-4 border-t border-gray-800">
                    <button
                      onClick={() => {
                        handleMarkAsSold(selectedProduct.id);
                        setShowProductModal(false);
                      }}
                      className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 py-2 rounded-lg text-sm font-bold transition"
                    >
                      Mark Sold
                    </button>
                    <button
                      onClick={() => alert("Edit feature coming soon!")}
                      className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 py-2 rounded-lg text-sm font-bold transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDeleteProduct(selectedProduct.id);
                        setShowProductModal(false);
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2 rounded-lg text-sm font-bold transition"
                    >
                      Delete
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    href={chatLink}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black py-2.5 rounded-full font-bold text-sm text-center flex items-center justify-center gap-1"
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
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                    Message
                  </Link>
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-500 hover:bg-green-600 text-white w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EDIT MODAL */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Edit Shop Details</h2>
              <form onSubmit={handleSaveShop} className="space-y-4">
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  placeholder="Shop Name"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
                <input
                  type="text"
                  value={editData.category}
                  onChange={(e) =>
                    setEditData({ ...editData, category: e.target.value })
                  }
                  placeholder="Category"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
                <input
                  type="tel"
                  value={editData.phoneNumber}
                  onChange={(e) =>
                    setEditData({ ...editData, phoneNumber: e.target.value })
                  }
                  placeholder="WhatsApp Number"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
                <input
                  type="text"
                  value={editData.location}
                  onChange={(e) =>
                    setEditData({ ...editData, location: e.target.value })
                  }
                  placeholder="Location"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
                <textarea
                  value={editData.description}
                  onChange={(e) =>
                    setEditData({ ...editData, description: e.target.value })
                  }
                  placeholder="Description"
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl p-3 text-white"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingShop}
                    className="flex-1 bg-cyan-500 text-black py-3 rounded-xl font-bold"
                  >
                    {savingShop ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#151515] border border-red-500/30 rounded-2xl p-6 max-w-md w-full text-center">
              <div className="text-5xl mb-4">🗑️</div>
              <h2 className="text-xl font-bold mb-2 text-red-400">
                Delete Shop Permanently?
              </h2>
              <p className="text-gray-400 text-sm mb-6">
                This will delete "{shop.name}" and all its products.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteShop}
                  className="flex-1 bg-red-500 text-white py-3 rounded-xl font-bold"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showMediaModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Add Shop Media</h2>
              <p className="text-gray-400 text-sm mb-4">
                Upload images or videos. (Max 2 for your plan)
              </p>
              <label className="block w-full border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-cyan-500 transition cursor-pointer bg-[#1a1a1a]">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleAddMedia}
                  className="hidden"
                  disabled={uploadingMedia}
                />
                {uploadingMedia ? (
                  <p className="text-cyan-400">Uploading...</p>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📁</div>
                    <p className="text-gray-400 text-sm">Click to select</p>
                  </>
                )}
              </label>
              <button
                onClick={() => setShowMediaModal(false)}
                className="w-full mt-4 bg-[#1a1a1a] py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
