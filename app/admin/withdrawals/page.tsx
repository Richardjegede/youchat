"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingWithdrawals();
  }, []);

  const fetchPendingWithdrawals = async () => {
    setLoading(true);
    try {
      // 1. Fetch all withdrawals (No orderBy needed here, avoiding the index error)
      const q = query(collection(db, "withdrawals"));
      const snapshot = await getDocs(q);

      // 2. Filter for "pending" and Sort by Date in JavaScript
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((req) => req.status === "pending") // Keep only pending
        .sort((a, b) => {
          // Sort newest first
          const dateA = a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

      setWithdrawals(data);
    } catch (err) {
      console.error("Error fetching withdrawals:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, userId: string, amount: number) => {
    if (
      !confirm(
        `Are you sure you want to approve ₦${amount.toLocaleString()}? Make sure you have manually sent the money via Paystack/Bank first!`,
      )
    ) {
      return;
    }

    setProcessingId(id);
    try {
      // 1. Mark as paid in database
      await updateDoc(doc(db, "withdrawals", id), {
        status: "paid",
        paidAt: serverTimestamp(),
        adminApprovedBy: auth.currentUser?.uid || "admin",
      });
      alert(
        "✅ Marked as Paid! Remember to actually transfer the money to their bank.",
      );
      fetchPendingWithdrawals(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Failed to approve.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, userId: string, amount: number) => {
    if (
      !confirm(
        `Reject this withdrawal? The ₦${amount.toLocaleString()} will be refunded to the user's wallet.`,
      )
    ) {
      return;
    }

    setProcessingId(id);
    try {
      // 1. Mark as rejected
      await updateDoc(doc(db, "withdrawals", id), {
        status: "rejected",
        rejectedAt: serverTimestamp(),
      });

      // 2. 🔥 REFUND THE USER'S WALLET
      await updateDoc(doc(db, "users", userId), {
        walletBalance: increment(amount),
      });

      alert("✅ Withdrawal rejected and funds refunded to user.");
      fetchPendingWithdrawals(); // Refresh list
    } catch (err) {
      console.error(err);
      alert("Failed to reject.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20 pt-24">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">
          🛡️ Admin: Withdrawal Requests
        </h1>
        <p className="text-gray-400 mb-8">
          Review, approve, or reject user withdrawal requests.
        </p>

        {withdrawals.length === 0 ? (
          <div className="text-center py-12 bg-[#111] border border-gray-800 rounded-2xl">
            <p className="text-gray-400">No pending withdrawal requests. 🎉</p>
          </div>
        ) : (
          <div className="space-y-4">
            {withdrawals.map((req) => (
              <div
                key={req.id}
                className="bg-[#111] border border-gray-800 rounded-xl p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {req.userName || "Unknown User"}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      User ID: {req.userId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-green-400">
                      ₦{req.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Requested: {req.createdAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="bg-[#1a1a1a] p-4 rounded-lg mb-4 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Bank Details:</p>
                  <p className="text-white font-semibold">
                    {req.bankDetails?.accountName}
                  </p>
                  <p className="text-gray-300">
                    {req.bankDetails?.accountNumber} •{" "}
                    {req.bankDetails?.bankName}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleReject(req.id, req.userId, req.amount)}
                    disabled={processingId === req.id}
                    className="flex-1 bg-red-500/20 text-red-400 border border-red-500/50 py-3 rounded-xl font-bold hover:bg-red-500/30 transition disabled:opacity-50"
                  >
                    {processingId === req.id
                      ? "Processing..."
                      : "Reject & Refund"}
                  </button>
                  <button
                    onClick={() =>
                      handleApprove(req.id, req.userId, req.amount)
                    }
                    disabled={processingId === req.id}
                    className="flex-1 bg-green-500 text-black py-3 rounded-xl font-bold hover:bg-green-400 transition disabled:opacity-50"
                  >
                    {processingId === req.id
                      ? "Processing..."
                      : "Approve & Mark Paid"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
