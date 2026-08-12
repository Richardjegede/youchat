"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { auth, db } from "../lib/firebase";
import Link from "next/link";

// 🔥 GLOBAL COUNTRY CODES (Self-learning - users can add custom ones)
const POPULAR_COUNTRY_CODES = [
  { country: "Nigeria", code: "+234", flag: "🇳🇬" },
  { country: "Ghana", code: "+233", flag: "🇬🇭" },
  { country: "Kenya", code: "+254", flag: "🇰🇪" },
  { country: "South Africa", code: "+27", flag: "🇿🇦" },
  { country: "USA", code: "+1", flag: "🇺🇸" },
  { country: "UK", code: "+44", flag: "🇬🇧" },
  { country: "Canada", code: "+1", flag: "🇦" },
  { country: "Egypt", code: "+20", flag: "🇪🇬" },
  { country: "India", code: "+91", flag: "🇮🇳" },
  { country: "Other", code: "custom", flag: "" },
];

export default function Register() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const referralCodeFromUrl = searchParams.get("ref");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [customCountryCode, setCustomCountryCode] = useState("");
  const [userCountry, setUserCountry] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    countryCode: "+234",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 1. Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }

    // 2. Basic password strength check
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    // 3. Validate username
    if (formData.username.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    try {
      // 4. CHECK FOR DUPLICATE ACCOUNTS
      const usersRef = collection(db, "users");

      // Check Email
      const emailQuery = query(usersRef, where("email", "==", formData.email));
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        setError("This email is already registered. Please log in.");
        setLoading(false);
        return;
      }

      // Check Username
      const usernameQuery = query(
        usersRef,
        where("username", "==", formData.username),
      );
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        setError("This username is already taken. Please choose another.");
        setLoading(false);
        return;
      }

      // Check Phone Number
      const phoneQuery = query(
        usersRef,
        where("phoneNumber", "==", formData.phoneNumber),
      );
      const phoneSnapshot = await getDocs(phoneQuery);
      if (!phoneSnapshot.empty) {
        setError("This Phone Number is already registered.");
        setLoading(false);
        return;
      }

      // 5. Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password,
      );
      const user = userCredential.user;

      // 6. Generate unique referral code
      const referralCode = user.uid.substring(0, 8).toUpperCase();

      // 7. Save details in Firestore
      await setDoc(doc(db, "users", user.uid), {
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        countryCode:
          formData.countryCode === "custom"
            ? customCountryCode
            : formData.countryCode,
        country: userCountry,
        referralCode: referralCode,
        totalReferrals: 0,
        referredBy: null,
        coinBalance: 0,
        walletBalance: 0,
        isEmailVerified: false,
        profileLockedUntil: null, // Will be set after first edit
        createdAt: serverTimestamp(),
        followers: [],
        following: [],
      });

      // 8. PROCESS REFERRAL IF EXISTS
      if (referralCodeFromUrl) {
        const referrerQuery = query(
          collection(db, "users"),
          where("referralCode", "==", referralCodeFromUrl),
        );
        const referrerSnapshot = await getDocs(referrerQuery);

        if (!referrerSnapshot.empty) {
          const referrerDoc = referrerSnapshot.docs[0];
          const referrerId = referrerDoc.id;

          // Reward the NEW user (100 coins)
          await updateDoc(doc(db, "users", user.uid), {
            coinBalance: increment(100),
            referredBy: referrerId,
          });

          // Reward the REFERRER (100 coins + increment count)
          await updateDoc(doc(db, "users", referrerId), {
            coinBalance: increment(100),
            totalReferrals: increment(1),
          });

          // Log the referral transaction for referrer
          await addDoc(collection(db, "transactions"), {
            userId: referrerId,
            type: "referral_reward",
            amount: 0,
            coins: 100,
            description: `Earned 100 coins from referring a friend`,
            status: "completed",
            createdAt: serverTimestamp(),
          });

          // Log for the new user
          await addDoc(collection(db, "transactions"), {
            userId: user.uid,
            type: "referral_bonus",
            amount: 0,
            coins: 100,
            description: `Received 100 coins signup bonus from referral`,
            status: "completed",
            createdAt: serverTimestamp(),
          });
        }
      }

      // 9. Send the verification email
      await sendEmailVerification(user);

      // 10. Success! Redirect them
      alert(
        "✅ Account created successfully! Please check your email to verify your account.",
      );
      router.push("/login");
    } catch (err) {
      console.error("Signup error:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please log in.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(
          "Failed to create account. Please check your details and try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md bg-[#111] border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold">
            You<span className="text-cyan-400">Chat</span>
          </Link>
          <h2 className="text-2xl font-bold mt-4">Create Your Account</h2>
          <p className="text-gray-400 text-sm mt-2">
            Join students and creators worldwide. 🌍
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Full Name (For Withdrawals)
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              placeholder="John Doe"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Username (Public Display)
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              placeholder="@johndoe"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be shown publicly on your posts
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              placeholder="john@example.com"
              required
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Country</label>
            <input
              type="text"
              value={userCountry}
              onChange={(e) => setUserCountry(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
              placeholder="Nigeria"
              required
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Phone Number
            </label>
            <div className="flex gap-2">
              <select
                name="countryCode"
                value={formData.countryCode}
                onChange={handleChange}
                className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-3 text-white focus:outline-none focus:border-cyan-400 transition w-28"
              >
                {POPULAR_COUNTRY_CODES.map((c, index) => (
                  <option key={`${c.code}-${index}`} value={c.code}>
                    {c.flag} {c.country} ({c.code})
                  </option>
                ))}
              </select>
              {formData.countryCode === "custom" && (
                <input
                  type="text"
                  value={customCountryCode}
                  onChange={(e) => setCustomCountryCode(e.target.value)}
                  placeholder="+234"
                  className="w-24 bg-[#1a1a1a] border border-gray-700 rounded-lg px-2 py-3 text-white focus:outline-none focus:border-cyan-400 text-center"
                />
              )}
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="8012345678"
                className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              📱 Additional charges may apply for SMS verification
            </p>
          </div>

          {/* Password */}
          <div className="relative">
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-white"
            >
              {showPassword ? "" : "👁️"}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <label className="block text-sm text-gray-400 mb-1">
              Confirm Password
            </label>
            <input
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-9 text-gray-400 hover:text-white"
            >
              {showConfirmPassword ? "🙈" : "👁️"}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition transform hover:scale-[1.02] mt-2"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
