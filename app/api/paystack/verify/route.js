import { NextResponse } from "next/server";
import { db } from "../../../lib/firebase"; // Adjust to "../../../../lib/firebase" if your lib folder is outside 'app'
import { doc, updateDoc, increment } from "firebase/firestore";

// 🔥 THIS MUST BE A GET REQUEST TO MATCH YOUR FETCH CALL
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference");

    if (!reference) {
      return NextResponse.json(
        { status: false, message: "Reference is required" },
        { status: 400 },
      );
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { status: false, message: "Paystack key missing" },
        { status: 500 },
      );
    }

    // 1. Verify with Paystack
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );

    const data = await response.json();

    // 2. If successful, securely update Firestore from the server
    if (data.status && data.data && data.data.status === "success") {
      const metadata = data.data.metadata || {};
      const userId = metadata.userId;
      const coinsToAdd = parseFloat(metadata.coinsToAdd) || 0;

      if (userId && coinsToAdd > 0) {
        await updateDoc(doc(db, "users", userId), {
          coinBalance: increment(coinsToAdd),
        });
      }

      return NextResponse.json({ status: true, data: data.data });
    } else {
      return NextResponse.json(
        { status: false, message: data.message || "Verification failed" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Paystack verify error:", error);
    return NextResponse.json(
      { status: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
