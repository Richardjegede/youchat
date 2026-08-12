"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import ProtectedRoute from "../../components/ProtectedRoute";

export default function PlansPage() {
  const router = useRouter();
  const [userShops, setUserShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserShops = async () => {
      if (!auth.currentUser) return;

      try {
        const q = query(
          collection(db, "shops"),
          where("ownerId", "==", auth.currentUser.uid),
        );
        const snapshot = await getDocs(q);
        const shops = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUserShops(shops);
      } catch (err) {
        console.error("Error fetching shops:", err);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) fetchUserShops();
      else router.push("/login");
    });

    return () => unsubscribe();
  }, [router]);

  //  SHOP LIMIT LOGIC
  const basicShopCount = userShops.filter((s) => s.plan === "free").length;
  const totalShopCount = userShops.length;
  const hasBasicShop = basicShopCount > 0;
  const maxShopsReached = totalShopCount >= 3;

  const plans = [
    {
      id: "free",
      name: "Starter Shop",
      price: "₦0",
      coins: "0 Coins",
      color: "border-gray-700 hover:border-cyan-500",
      btnColor: "bg-gray-700 hover:bg-gray-600 text-white",
      disabled: hasBasicShop || maxShopsReached,
      disabledText: hasBasicShop
        ? "Already have a Basic shop"
        : maxShopsReached
          ? "Max shops reached"
          : "",
      features: [
        "1 Shop Allowed",
        "1 Product/Day",
        "1 Image per Product",
        "Basic Listing",
      ],
    },
    {
      id: "6-month",
      name: "⭐ Premium Shop",
      price: "2,500",
      coins: "5,000 Coins",
      color: "border-yellow-500 bg-yellow-500/5",
      btnColor: "bg-yellow-500 hover:bg-yellow-400 text-black",
      popular: true,
      disabled: maxShopsReached,
      disabledText: maxShopsReached ? "Max shops reached" : "",
      features: [
        "2 Shops Allowed",
        "5 Products/Day",
        "5 Images per Product",
        "⭐ Verified Badge",
        "Featured in Feed (3x/week)",
      ],
    },
    {
      id: "yearly",
      name: "👑 Gold Empire",
      price: "₦4,500",
      coins: "9,000 Coins",
      color: "border-purple-500 bg-purple-500/5",
      btnColor: "bg-purple-500 hover:bg-purple-400 text-white",
      disabled: maxShopsReached,
      disabledText: maxShopsReached ? "Max shops reached" : "",
      features: [
        "3 Shops Allowed",
        "Unlimited Products/Day",
        "10 Images per Product",
        "👑 Gold Verified Badge",
        "Daily Feed Visibility",
        "Priority Support",
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-24 pb-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">Choose Your Shop Plan</h1>
          <p className="text-gray-400 mb-4">
            You currently have{" "}
            <span className="text-cyan-400 font-bold">{totalShopCount}</span>{" "}
            shop(s)
            {hasBasicShop && (
              <span className="text-yellow-400"> (1 Basic shop active)</span>
            )}
          </p>

          {maxShopsReached && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8">
              <p className="text-red-400 font-bold">
                ⚠️ You've reached the maximum of 3 shops!
              </p>
              <p className="text-gray-400 text-sm mt-1">
                Delete a shop to create a new one, or upgrade your existing
                shops.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative border-2 rounded-2xl p-6 transition ${plan.color} flex flex-col ${plan.disabled ? "opacity-50 grayscale" : ""}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <p className="text-3xl font-bold">{plan.price}</p>
                  <p className="text-sm text-gray-400">{plan.coins}</p>
                </div>
                <ul className="text-left space-y-3 mb-8 flex-1">
                  {plan.features.map((feat, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-300"
                    >
                      <span className="text-cyan-400 mt-0.5">✓</span> {feat}
                    </li>
                  ))}
                </ul>

                {plan.disabled ? (
                  <button
                    disabled
                    className={`w-full py-3 rounded-xl font-bold transition cursor-not-allowed ${plan.disabled ? "bg-gray-700 text-gray-400" : plan.btnColor}`}
                  >
                    {plan.disabledText}
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      router.push(`/youbuy/create-shop?plan=${plan.id}`)
                    }
                    className={`w-full py-3 rounded-xl font-bold transition ${plan.btnColor}`}
                  >
                    Select Plan
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
