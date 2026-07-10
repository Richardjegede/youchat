"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() });
        } else {
          console.log("No such product!");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pt-20">
        <p className="text-xl text-gray-400">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pt-20">
        <p className="text-xl text-red-400">Product not found.</p>
      </div>
    );
  }

  // Convert Nigerian phone number to international format
  const formatPhoneNumber = (phone) => {
    if (!phone) return "2348000000000"; // Fallback

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, "");

    // If starts with 0, replace with 234 (Nigeria country code)
    if (cleaned.startsWith("0")) {
      cleaned = "234" + cleaned.substring(1);
    }

    // If starts with 234, it's already correct
    // If starts with something else, assume it's correct

    return cleaned;
  };

  // Generate WhatsApp message
  const whatsappMessage = `Hi! I'm interested in your "${product.title}" listed for ₦${Number(product.price).toLocaleString()} on YouBuy. Is it still available?`;
  const formattedPhone = formatPhoneNumber(product.sellerPhone);
  const whatsappLink = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
  return (
    <div className="min-h-screen bg-black text-white pt-24 px-4 pb-20">
      <div className="max-w-5xl mx-auto">
        {/* BACK BUTTON */}
        <Link
          href="/feed"
          className="text-cyan-400 hover:text-cyan-300 mb-6 inline-block"
        >
          ← Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* PRODUCT IMAGE */}
          <div className="rounded-2xl overflow-hidden border border-gray-800 bg-[#111]">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-[400px] object-cover"
            />
          </div>

          {/* PRODUCT INFO */}
          <div className="flex flex-col justify-center">
            <span className="text-cyan-400 font-semibold text-sm uppercase tracking-wide mb-2">
              {product.category} • {product.campus}
            </span>

            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {product.title}
            </h1>

            <p className="text-4xl font-bold text-white mb-6">
              ₦{Number(product.price).toLocaleString()}
            </p>

            <div className="border-t border-gray-800 pt-6 mb-6">
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-gray-400 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* SELLER INFO & CONTACT */}
            <div className="bg-[#111] border border-gray-800 rounded-xl p-5 mb-6">
              <h3 className="text-sm text-gray-500 uppercase mb-2">
                Seller Information
              </h3>
              <p className="text-white font-semibold mb-1">Verified Student</p>
              <p className="text-gray-400 text-sm mb-4">
                {product.sellerEmail}
              </p>

              <div className="flex flex-col gap-3">
                {/* NEW: VISIT SHOP BUTTON */}
                <Link
                  href={`/shop/${product.sellerId}`}
                  className="block w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg text-center transition transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  🏪 Visit Seller's Shop
                </Link>

                {/* WHATSAPP BUTTON */}
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg text-center transition transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  Chat on WhatsApp
                </a>
              </div>
            </div>

            {/* WARNING */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-200">
              <p className="font-semibold mb-1">⚠️ Safety Reminder</p>
              <p className="text-xs">
                Meet in public places on campus. Never send money before seeing
                the item.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
