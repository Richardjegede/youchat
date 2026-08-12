"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

export default function PaymentCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const processPayment = async () => {
      const reference = searchParams.get("reference");

      if (!reference) {
        setStatus("❌ Invalid payment");
        setTimeout(() => router.push("/gifts"), 2000);
        return;
      }

      try {
        // Simple verification
        const res = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await res.json();

        if (data.status && data.data?.status === "success") {
          const amount = data.data.amount / 100;
          const coins = amount / 10;

          // Update balance
          const user = auth.currentUser;
          if (user) {
            await updateDoc(doc(db, "users", user.uid), {
              coinBalance: increment(coins),
            });

            setStatus(`✅ Success! ${coins} coins added`);
            setTimeout(() => router.push("/gifts"), 2000);
          } else {
            setStatus("❌ Not logged in");
            setTimeout(() => router.push("/login"), 2000);
          }
        } else {
          setStatus("❌ Payment failed");
          setTimeout(() => router.push("/gifts"), 2000);
        }
      } catch (err) {
        console.error(err);
        setStatus("❌ Error occurred");
        setTimeout(() => router.push("/gifts"), 2000);
      }
    };

    processPayment();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h1 className="text-xl font-bold">{status}</h1>
      </div>
    </div>
  );
}
