"use client";

import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";

export default function WithdrawalModal({ isOpen, onClose, userBalance }: any) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen && auth.currentUser) {
      checkExistingBankDetails();
    }
  }, [isOpen]);

  const checkExistingBankDetails = async () => {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser!.uid));
    if (userDoc.exists() && userDoc.data().bankDetails) {
      const bank = userDoc.data().bankDetails;
      setAccountNumber(bank.accountNumber);
      setBankName(bank.bankName);
      setAccountName(bank.accountName);
      setStep(2);
    } else {
      setStep(1);
    }
  };

  const handleSaveBankDetails = async () => {
    if (!accountNumber || !bankName || !accountName) {
      alert("Please fill in all bank details.");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser!.uid), {
        bankDetails: { accountNumber, bankName, accountName },
        isBankLocked: true,
      });
      setStep(2);
    } catch (err) {
      console.error(err);
      alert("Failed to save bank details.");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseInt(amount);

    if (withdrawAmount < 3000) {
      alert("Minimum withdrawal is ₦3,000.");
      return;
    }
    if (withdrawAmount > 50000) {
      alert("Maximum withdrawal per request is ₦50,000.");
      return;
    }
    if (withdrawAmount > userBalance) {
      alert("Insufficient balance.");
      return;
    }

    setLoading(true);
    try {
      // 1. Create Withdrawal Request in Database
      await addDoc(collection(db, "withdrawals"), {
        userId: auth.currentUser!.uid,
        userName: auth.currentUser!.displayName || "User",
        amount: withdrawAmount,
        bankDetails: { accountNumber, bankName, accountName },
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // 🔥 LOG WITHDRAWAL REQUEST TRANSACTION
      await addDoc(collection(db, "transactions"), {
        userId: auth.currentUser!.uid,
        type: "withdrawal",
        amount: withdrawAmount,
        description: `Withdrawal request to ${bankName}`,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // 2. Deduct from User's Wallet IMMEDIATELY
      await updateDoc(doc(db, "users", auth.currentUser!.uid), {
        walletBalance: userBalance - withdrawAmount,
      });

      alert(
        "✅ Withdrawal request submitted successfully! Funds will be sent within 24 hours.",
      );
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to process withdrawal.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#151515] border border-gray-800 rounded-2xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {step === 1 ? "Add Bank Account" : "Withdraw Funds"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            &times;
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              🔒 For your security, this account will be permanently locked to
              your profile.
            </p>
            <input
              type="text"
              placeholder="Account Name (Must match your ID)"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Account Number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Bank Name (e.g., GTBank, Access)"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            />
            <button
              onClick={handleSaveBankDetails}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition disabled:bg-gray-600"
            >
              {loading ? "Locking Account..." : "Save & Continue"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Sending to:</p>
              <p className="text-white font-bold">{accountName}</p>
              <p className="text-gray-400 text-sm">
                {accountNumber} • {bankName}
              </p>
            </div>
            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
              <p className="text-xs text-gray-400 mb-1">Available Balance:</p>
              <p className="text-2xl font-bold text-cyan-400">
                ₦{userBalance.toLocaleString()}
              </p>
            </div>
            <input
              type="number"
              placeholder="Enter amount (Min ₦3,000 - Max ₦50,000)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:outline-none"
            />
            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
            >
              {loading ? "Processing..." : "Confirm Withdrawal"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
