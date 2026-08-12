import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl || !imageUrl.includes("cloudinary.com")) {
      return NextResponse.json(
        { error: "Invalid or missing Cloudinary URL" },
        { status: 400 },
      );
    }

    // 🔥 BULLETPROOF PUBLIC ID EXTRACTION
    const urlParts = imageUrl.split("/upload/");
    if (urlParts.length < 2) {
      return NextResponse.json(
        { error: "Could not parse URL" },
        { status: 400 },
      );
    }

    let publicId = urlParts[1];
    // Remove version (e.g., v1690000000/)
    publicId = publicId.replace(/^v\d+\//, "");
    // Remove file extension (e.g., .jpg, .png, .mp4)
    publicId = publicId.replace(/\.[^/.]+$/, "");

    console.log("Attempting to delete Cloudinary ID:", publicId); //  Check your terminal!

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    console.log("Cloudinary Deletion Result:", result); // 🔥 Check your terminal!

    if (result.result === "not found") {
      return NextResponse.json(
        { success: false, message: "Image not found in Cloudinary" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Cloudinary deletion error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
