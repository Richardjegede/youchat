"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";

const renderStars = (rating: number) => {
  const stars = [];
  const roundedRating = Math.round(rating || 5.0);
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <svg
        key={i}
        className={`w-3 h-3 ${i <= roundedRating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"}`}
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>,
    );
  }
  return stars;
};

export default function ServicesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = [
    "All",
    "Tutoring",
    "Freelance",
    "Campus Services",
    "Event Planning",
    "Technical Support",
    "Laundry & Cleaning",
    "Food Delivery",
    "Graphic Design",
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "services"),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const snapshot = await getDocs(q);

      const servicesData = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };
          const userDoc = await getDoc(doc(db, "users", data.creatorId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            data.creatorName =
              userData.fullName || userData.username || "Unknown";
            data.creatorRating = userData.rating || 5.0;
          }
          return data;
        }),
      );
      setServices(servicesData);
    } catch (err) {
      console.error("Error fetching services:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = category === "All" || service.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Digital Shops</h1>
            <p className="text-gray-400 text-sm">
              Find trusted student services
            </p>
          </div>
          <Link
            href="/services/create"
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-full font-bold text-sm transition"
          >
            + Open Shop
          </Link>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Horizontal Scrollable Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                category === cat
                  ? "bg-cyan-500 text-black"
                  : "bg-[#1a1a1a] text-gray-400 border border-gray-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Compact List View */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400">No services found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredServices.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.id}`}
                className="flex bg-[#111] border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500 transition group"
              >
                {/* Small Image on Left */}
                <div className="w-28 h-28 bg-gray-900 flex-shrink-0 relative">
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      🛠️
                    </div>
                  )}
                  <span className="absolute top-1 left-1 bg-black/80 text-[10px] font-bold px-1.5 py-0.5 rounded text-white">
                    {service.category}
                  </span>
                </div>

                {/* Details in Middle */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white truncate group-hover:text-cyan-400 transition">
                      {service.title}
                    </h3>
                    <p className="text-gray-400 text-xs truncate mt-1">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex justify-between items-end mt-2">
                    <div>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span>👤 {service.creatorName}</span>
                        <span>• {service.location || "Campus"}</span>
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <div className="flex">
                          {renderStars(service.creatorRating)}
                        </div>
                      </div>
                    </div>
                    <p className="font-bold text-cyan-400 text-sm">
                      ₦{Number(service.price).toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
