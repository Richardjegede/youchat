"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function ProtectedRoute({ children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The Bouncer checks if the user is logged in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // No login? Send them to the login page!
        router.push("/login");
      } else {
        // Logged in? Let them in!
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Show a cool loading screen while the bouncer checks
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <div className="text-4xl font-bold mb-4">
          You<span className="text-cyan-400">Chat</span>
        </div>
        <p className="text-gray-400 text-sm mb-2">
          The African Student Super App
        </p>
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 mt-4 text-sm">Verifying your identity...</p>
      </div>
    );
  }

  // If logged in, show the actual page
  return <>{children}</>;
}
