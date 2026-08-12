"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";

export default function PaymentCallback() {
  const router = useRouter();
  const [status, setStatus] = useState("Verifying transaction securely...");
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processPayment = async () => {
      // 🔥 WE ARE USING WINDOW.LOCATION, NOT useSearchParams!
      const urlParams = new URLSearchParams(window.location.search);
      const reference = urlParams.get("reference");

      if (!reference) {
        setStatus("❌ Invalid payment link.");
        setIsProcessing(false);
        setTimeout(() => router.push("/gifts"), 3000);
        return;
      }

      const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
          unsubscribe();
          resolve(currentUser);
        });
        setTimeout(() => {
          unsubscribe();
          resolve(auth.currentUser);
        }, 2000);
      });

      if (!user) {
        setStatus("❌ Session expired. Please log in.");
        setIsProcessing(false);
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      try {
        setStatus("✅ Contacting Paystack server...");

        const res = await fetch(`/api/paystack/verify?reference=${reference}`);
        const data = await res.json();

        if (data.status && data.data && data.data.status === "success") {
          const amountPaid = data.data.amount / 100;
          const coinsToAdd = amountPaid / 10;

          setStatus(`🎉 Success! ${coinsToAdd} coins added to your wallet.`);
          setIsProcessing(false);

          setTimeout(() => {
            router.push("/gifts");
          }, 2500);
        } else {
          setStatus("❌ Payment verification failed.");
          setIsProcessing(false);
          setTimeout(() => router.push("/gifts"), 3000);
        }
      } catch (err) {
        console.error("Callback error:", err);
        setStatus("❌ Network error. Please contact support.");
        setIsProcessing(false);
        setTimeout(() => router.push("/gifts"), 3000);
      }
    };

    processPayment();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center text-white">
      {isProcessing && (
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-6"></div>
      )}
      {!isProcessing && <div className="text-6xl mb-6">✅</div>}
      <h1 className="text-2xl font-bold mb-2 text-center px-4">{status}</h1>
      <p className="text-gray-400 text-sm">Please do not close this window.</p>
    </div>
  );
}
