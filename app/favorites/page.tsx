"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Favorites() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!auth.currentUser) {
        router.push("/login");
        return;
      }

      try {
        // 1. Get all favorite IDs for this user
        const favQuery = query(
          collection(db, "favorites"),
          where("userId", "==", auth.currentUser.uid),
        );
        const favSnapshot = await getDocs(favQuery);

        // 2. Fetch the actual product details for each ID
        const productPromises = favSnapshot.docs.map(async (favDoc) => {
          const productId = favDoc.data().productId;
          const productDoc = await getDoc(doc(db, "products", productId));
          if (productDoc.exists()) {
            return { id: productDoc.id, ...productDoc.data() };
          }
          return null;
        });

        const productsData = (await Promise.all(productPromises)).filter(
          (p) => p !== null,
        );
        setProducts(productsData);
      } catch (err) {
        console.error("Error fetching favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 md:px-8 pb-20">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          My Saved Items ❤️
        </h1>
        <p className="text-gray-400 mb-8">
          Items you're keeping an eye on. Waiting for allowance? We got you.
        </p>

        {loading ? (
          <p className="text-center text-gray-400 py-20">
            Loading your saved items...
          </p>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-gray-800 rounded-xl">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-2xl font-bold text-gray-300 mb-2">
              No saved items yet
            </h2>
            <p className="text-gray-400 mb-6">
              Browse the marketplace and click the heart icon to save items
              here!
            </p>
            <Link
              href="/feed"
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-3 rounded-full inline-block transition"
            >
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Link
                href={`/item/${product.id}`}
                key={product.id}
                className="block"
              >
                <div className="bg-[#111] border border-gray-800 rounded-xl overflow-hidden hover:border-cyan-500 transition cursor-pointer group h-full">
                  <div className="relative h-48 overflow-hidden bg-gray-900">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-xs font-semibold px-2 py-1 rounded-md text-white">
                      {product.category}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-white font-semibold text-lg truncate mb-1">
                      {product.title}
                    </h3>
                    <p className="text-cyan-400 font-bold text-xl mb-3">
                      ₦{Number(product.price).toLocaleString()}
                    </p>
                    <div className="flex items-center justify-between text-sm text-gray-400 border-t border-gray-800 pt-3">
                      <span>{product.campus}</span>
                      <span className="text-green-400 text-xs font-medium">
                        Verified
                      </span>
                    </div>
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
