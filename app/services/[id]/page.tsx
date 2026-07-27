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
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { updateUserRating } from "../../lib/calculateRating";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";

export default function ServiceDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (id) fetchServiceDetails();
  }, [id]);

  const fetchServiceDetails = async () => {
    setLoading(true);
    try {
      const serviceDoc = await getDoc(doc(db, "services", id as string));
      if (serviceDoc.exists()) {
        setService({ id: serviceDoc.id, ...serviceDoc.data() });

        // Fetch reviews for this service
        const reviewsQuery = query(
          collection(db, "reviews"),
          where("serviceId", "==", id),
        );
        const reviewsSnap = await getDocs(reviewsQuery);
        setReviews(reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      console.error("Error fetching details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewText.trim()) return;

    try {
      // 1. Save the review to the database
      await addDoc(collection(db, "reviews"), {
        serviceId: id,
        userId: user.uid,
        userName: user.displayName || user.email?.split("@")[0],
        rating: reviewRating,
        text: reviewText,
        createdAt: serverTimestamp(),
      });

      // 2. 🔥 TRIGGER THE AVERAGE CALCULATION
      if (service && service.creatorId) {
        await updateUserRating(service.creatorId);
      }

      // 3. Reset form and refresh the page data
      setReviewText("");
      setReviewRating(5);
      fetchServiceDetails();
      alert("Thank you for your testimony!");
    } catch (err) {
      console.error("Error posting review:", err);
      alert("Failed to post review");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  if (!service)
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        Service not found
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
      <div className="max-w-2xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-4 text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Back to Services
        </button>

        {/* Header Image */}
        <div className="h-64 bg-gray-900 rounded-2xl overflow-hidden mb-6 relative">
          {service.imageUrl ? (
            <img
              src={service.imageUrl}
              alt={service.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              ️
            </div>
          )}
          <div className="absolute top-4 left-4 bg-black/80 px-3 py-1 rounded-full text-xs font-bold">
            {service.category}
          </div>
        </div>

        {/* Title & Price */}
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">{service.title}</h1>
          <p className="text-xl font-bold text-cyan-400">
            ₦{Number(service.price).toLocaleString()}
          </p>
        </div>

        {/* Creator Info */}
        <div className="bg-[#111] border border-gray-800 rounded-xl p-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold">
            {service.creatorName?.charAt(0) || "U"}
          </div>
          <div className="flex-1">
            <p className="font-semibold">{service.creatorName}</p>
            <p className="text-xs text-gray-400 flex items-center gap-2">
              📍 {service.location || "Campus"} • 📞 {service.contactInfo}
            </p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-2">About this Service</h2>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
            {service.description}
          </p>
        </div>

        {/* WhatsApp Contact Button */}
        <a
          href={`https://wa.me/${service.contactInfo.replace(/\D/g, "")}?text=Hello, I am interested in your ${service.title} service on YouChat.`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-green-500 hover:bg-green-400 text-black font-bold py-4 rounded-xl text-center mb-8 transition"
        >
          💬 Chat on WhatsApp
        </a>

        {/* Reviews Section */}
        <div className="border-t border-gray-800 pt-6">
          <h2 className="text-lg font-bold mb-4">
            Customer Testimonies ({reviews.length})
          </h2>

          {reviews.length === 0 ? (
            <p className="text-gray-500 text-sm mb-6">
              No reviews yet. Be the first to leave a testimony!
            </p>
          ) : (
            <div className="space-y-4 mb-6">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-[#111] p-4 rounded-xl border border-gray-800"
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold text-sm">{review.userName}</p>
                    <div className="flex text-yellow-400 text-xs">
                      {"⭐".repeat(review.rating)}
                    </div>
                  </div>
                  <p className="text-gray-300 text-sm">{review.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add Review Form */}
          {user && (
            <form
              onSubmit={handleSubmitReview}
              className="bg-[#111] p-4 rounded-xl border border-gray-800"
            >
              <h3 className="font-bold mb-3 text-sm">Leave a Testimony</h3>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 mb-3 text-sm"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (Excellent)</option>
                <option value={4}>⭐⭐⭐⭐ (Good)</option>
                <option value={3}>⭐⭐⭐ (Average)</option>
                <option value={2}>⭐⭐ (Poor)</option>
                <option value={1}>⭐ (Terrible)</option>
              </select>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this service..."
                rows={3}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-2 mb-3 text-sm resize-none"
                required
              />
              <button
                type="submit"
                className="w-full bg-cyan-500 text-black font-bold py-2 rounded-lg text-sm"
              >
                Post Review
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
