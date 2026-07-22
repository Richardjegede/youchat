"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";

// THIS IS THE MAGIC LINE - LOADS PAYSTACK ONLY IN BROWSER!
const PaystackButton = dynamic(
  () => import("react-paystack").then((mod) => mod.PaystackButton),
  { ssr: false },
);

export default function Verification() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState("monthly"); // 'monthly' or 'yearly'

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

  // DYNAMIC PRICING
  const price = selectedPlan === "monthly" ? 1000 : 10000;

  const config = {
    reference: `YouChat_Verify_${Date.now()}`,
    email: auth.currentUser?.email || "",
    amount: price * 100, // Convert Naira to Kobo dynamically
    // TODO: CHANGE THIS TO YOUR pk_live_ KEY WHEN READY!
    publicKey: "pk_test_4aea2dad66c9b34c758635932358cf968e81f54c",
  };

  const onSuccess = async (reference) => {
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        isVerified: true,
        verifiedAt: new Date(),
        verificationReference: reference.reference,
        verificationAmount: price,
        verificationPlan: selectedPlan,
        subscriptionEnd: new Date(
          Date.now() +
            (selectedPlan === "monthly" ? 30 : 365) * 24 * 60 * 60 * 1000,
        ), // Add 30 days or 365 days
        authorizationCode: reference.authorization_code, // 🔥 SAVE THIS!
      });

      alert("🎉 Congratulations! You are now verified!");
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

  // CHECK REQUIREMENTS (TEMPORARILY DISABLED FOR TESTING)
  const hasName = true; // !!user?.fullName;
  const hasAvatar = true; // !!user?.avatar;
  const hasFollowers = true; // (user?.followers?.length || 0) >= 100;
  const requirementsMet = true; // hasName && hasAvatar && hasFollowers;

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

          {/* PRICING TOGGLE */}
          <div className="mb-8">
            <div className="bg-[#1a1a1a] rounded-xl p-1 flex gap-1 border border-gray-800">
              <button
                onClick={() => setSelectedPlan("monthly")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
                  selectedPlan === "monthly"
                    ? "bg-cyan-500 text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedPlan("yearly")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition ${
                  selectedPlan === "yearly"
                    ? "bg-cyan-500 text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Yearly
              </button>
            </div>
            {selectedPlan === "yearly" && (
              <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                <span className="text-green-400 text-sm font-semibold">
                  💰 Save ₦2,000/year (₦833/month equivalent!)
                </span>
              </div>
            )}
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
            </div>
          </div>

          {/* PRICING & REQUIREMENTS */}
          <div className="bg-[#111] border border-gray-800 rounded-2xl p-8 mb-8">
            <div className="text-center mb-6">
              <p className="text-gray-400 mb-2">Price</p>
              <p className="text-5xl font-bold text-cyan-400">
                ₦{price.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Per {selectedPlan} (auto-renewal)
              </p>
            </div>

            {/* REQUIREMENTS CHECKLIST */}
            <div className="border-t border-gray-800 pt-6 mb-6">
              <p className="text-sm font-semibold mb-3">Requirements:</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2">
                  <span className={hasName ? "text-green-400" : "text-red-400"}>
                    {hasName ? "✓" : "✗"}
                  </span>
                  Complete profile (name, bio)
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={hasAvatar ? "text-green-400" : "text-red-400"}
                  >
                    {hasAvatar ? "✓" : "✗"}
                  </span>
                  Profile picture uploaded
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={hasFollowers ? "text-green-400" : "text-red-400"}
                  >
                    {hasFollowers ? "✓" : "✗"}
                  </span>
                  At least 100 followers ({user?.followers?.length || 0}/100)
                </li>
              </ul>

              {/* WARNING IF REQUIREMENTS NOT MET */}
              {!requirementsMet && (
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400">
                  ⚠️ Please complete your profile and reach 100 followers to
                  unlock the payment button.
                </div>
              )}
            </div>

            {/* PAY BUTTON */}
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
                text="Pay Now & Get Verified ✓"
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition text-lg"
                disabled={!requirementsMet} // This is why it was grayed out!
              />
            </Suspense>

            <p className="text-xs text-gray-500 text-center mt-4">
              Secure payment powered by Paystack
            </p>
          </div>

          {/* ALREADY VERIFIED MESSAGE */}
          {user?.isVerified && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center">
              <p className="text-green-400 text-xl font-bold mb-2">
                ✓ You're Already Verified!
              </p>
              <p className="text-gray-400">
                Your {user.verificationPlan || "monthly"} verification is
                active.
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
