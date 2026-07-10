"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";

//  THIS IS THE MAGIC LINE - LOADS PAYSTACK ONLY IN BROWSER!
const PaystackButton = dynamic(
  () => import("react-paystack").then((mod) => mod.PaystackButton),
  { ssr: false },
);

export default function Verification() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        setUser(userDoc.data());
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const config = {
    reference: `YouChat_Verify_${Date.now()}`,
    email: auth.currentUser?.email || "",
    amount: 1000 * 100, // ₦1,000 in kobo
    publicKey: pk_test_4aea2dad66c9b34c758635932358cf968e81f54c, //  USE TEST KEY FOR NOW!
  };

  const onSuccess = async (reference) => {
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        isVerified: true,
        verifiedAt: new Date(),
        verificationReference: reference.reference,
        verificationAmount: 1000,
      });

      alert(" Congratulations! You are now verified!");
      router.push("/analytics");
    } catch (err) {
      console.error("Verification error:", err);
      alert(
        "Payment successful but verification failed. Please contact support.",
      );
    }
  };

  const onClose = () => {
    alert("Payment cancelled. You can try again anytime!");
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
      <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-20">
        <div className="max-w-2xl mx-auto px-4">
          {/* HEADER */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Get Verified ✓</h1>
            <p className="text-gray-400">Join the elite creators on YouChat</p>
          </div>

          {/* BENEFITS */}
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30 rounded-2xl p-8 mb-8">
            <h2 className="text-xl font-bold mb-6 text-center">
              What You Get:
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <p className="font-semibold">Blue Checkmark Badge</p>
                  <p className="text-sm text-gray-400">
                    Show authenticity on your profile
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">📈</span>
                <div>
                  <p className="font-semibold">Priority in Search</p>
                  <p className="text-sm text-gray-400">
                    Appear first when people search
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <p className="font-semibold">20% Higher Earnings</p>
                  <p className="text-sm text-gray-400">
                    Get paid more for your content
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl"></span>
                <div>
                  <p className="font-semibold">Exclusive Features</p>
                  <p className="text-sm text-gray-400">
                    Access premium tools & analytics
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PRICING */}
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-8 mb-8">
            <div className="text-center mb-6">
              <p className="text-gray-400 mb-2">Price</p>
              <p className="text-5xl font-bold text-cyan-400">₦1,000</p>
              <p className="text-sm text-gray-500 mt-2">
                Per month (auto-renewal)
              </p>
            </div>

            {/* REQUIREMENTS */}
            <div className="border-t border-gray-800 pt-6 mb-6">
              <p className="text-sm font-semibold mb-3">Requirements:</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <span
                    className={
                      user?.fullName ? "text-green-400" : "text-red-400"
                    }
                  >
                    {user?.fullName ? "✓" : "✗"}
                  </span>
                  Complete profile (name, bio)
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={user?.avatar ? "text-green-400" : "text-red-400"}
                  >
                    {user?.avatar ? "✓" : "✗"}
                  </span>
                  Profile picture uploaded
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={
                      (user?.followers?.length || 0) >= 100
                        ? "text-green-400"
                        : "text-red-400"
                    }
                  >
                    {(user?.followers?.length || 0) >= 100 ? "✓" : "✗"}
                  </span>
                  At least 100 followers ({user?.followers?.length || 0}/100)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-gray-400">️</span>
                  Account age 30+ days
                </li>
              </ul>
            </div>

            {/* PAY BUTTON - NOW SAFE WITH DYNAMIC IMPORT! */}
            <Suspense
              fallback={
                <button
                  disabled
                  className="w-full bg-gray-700 text-white font-bold py-4 rounded-xl"
                >
                  Loading Payment...
                </button>
              }
            >
              <PaystackButton
                {...config}
                onSuccess={onSuccess}
                onClose={onClose}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-600 text-white font-bold py-4 rounded-xl transition text-lg"
                disabled={
                  !user?.fullName ||
                  !user?.avatar ||
                  (user?.followers?.length || 0) < 100
                }
              />
            </Suspense>

            <p className="text-xs text-gray-500 text-center mt-4">
              Secure payment powered by Paystack
            </p>
          </div>

          {/* ALREADY VERIFIED */}
          {user?.isVerified && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
              <p className="text-green-400 text-xl font-bold mb-2">
                ✓ You're Already Verified!
              </p>
              <p className="text-gray-400">Your verification is active.</p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
