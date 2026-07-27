"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, increment } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function PaymentCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    const processPayment = async () => {
      console.log("🔍 1. Callback started");

      const urlParams = new URL(window.location.href).searchParams;
      const reference = urlParams.get("reference");
      console.log("📝 2. Reference found:", reference);

      if (!reference) {
        setStatus("❌ Payment failed: No reference found.");
        setTimeout(() => router.push("/gifts"), 3000);
        return;
      }

      try {
        setStatus("Verifying user session...");

        // 🔥 ROBUST AUTH CHECK: Wait for Firebase to confirm the user
        const currentUser = await new Promise((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe(); // Stop listening once we get the answer
            resolve(user);
          });
        });

        console.log("👤 3. Current User UID:", currentUser?.uid);

        if (!currentUser) {
          setStatus("❌ User not logged in. Redirecting to login...");
          setTimeout(() => router.push("/login"), 3000);
          return;
        }

        setStatus("Verifying payment with Paystack...");

        // 🔥 VERIFY WITH PAYSTACK
        const res = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await res.json();
        console.log("💳 4. Paystack API Response:", data);

        // 🔥 CHECK IF SUCCESSFUL
        if (data.status && data.data && data.data.status === "success") {
          const amountPaid = data.data.amount / 100;
          const coinsToAdd = amountPaid / 10;

          console.log(
            "💰 5. Amount to add: ₦" + amountPaid,
            "| Coins:",
            coinsToAdd,
          );
          setStatus("Updating your wallet...");

          const userRef = doc(db, "users", currentUser.uid);

          // 🔥 UPDATE FIRESTORE
          await setDoc(
            userRef,
            {
              walletBalance: increment(amountPaid),
              coinBalance: increment(coinsToAdd),
            },
            { merge: true }, // Creates the fields if they don't exist!
          );

          console.log("✅ 6. Firestore updated successfully!");
          setStatus(
            `✅ Success! ₦${amountPaid.toLocaleString()} added to your wallet.`,
          );
        } else {
          console.error("❌ Paystack verification failed:", data);
          setStatus("❌ Payment verification failed.");
        }
      } catch (error) {
        console.error("💥 CRITICAL ERROR in callback:", error);
        setStatus("❌ An error occurred: " + error.message);
      }

      // Redirect back to gift store after 4 seconds
      setTimeout(() => router.push("/gifts"), 4000);
    };

    processPayment();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-2">{status}</h1>
        <p className="text-gray-400 text-sm">
          Check your browser Console (F12) for step-by-step details.
        </p>
      </div>
    </div>
  );
}
