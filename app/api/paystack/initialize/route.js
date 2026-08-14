import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, amount, metadata } = body;

    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return NextResponse.json(
        { status: false, message: "Paystack key missing!" },
        { status: 500 },
      );
    }

    // 🔥 DYNAMIC CALLBACK URL: Automatically detects localhost OR Vercel!
    const callbackUrl = `${request.nextUrl.origin}/gifts/callback`;

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          amount: amount, // 🔥 REMEMBER: Paystack expects amount in KOBO (e.g., 500 Naira = 50000)
          metadata: metadata,
          callback_url: callbackUrl, // 🔥 DYNAMIC URL IS USED HERE
        }),
      },
    );

    const data = await response.json();

    if (data.status) {
      return NextResponse.json({
        status: true,
        authorization_url: data.data.authorization_url,
      });
    } else {
      return NextResponse.json(
        { status: false, message: data.message },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Paystack initialize error:", error);
    return NextResponse.json(
      { status: false, message: "Server Error" },
      { status: 500 },
    );
  }
}
