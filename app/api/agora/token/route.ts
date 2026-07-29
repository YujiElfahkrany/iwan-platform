import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { RtcTokenBuilder, RtcRole, RtmTokenBuilder } from "agora-token";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";

const TOKEN_TTL_SECONDS = 60 * 60 * 3; // 3 hours, covers any session length

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) {
      return NextResponse.json({ error: "Agora is not configured" }, { status: 500 });
    }

    const { bookingId } = await req.json();
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
    }

    await connectDB();
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const isOwner =
      booking.studentId.toString() === session.user.id ||
      booking.teacherId.toString() === session.user.id;
    if (!isOwner || booking.status !== "confirmed") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const channel = booking.meetingRoomName;
    const uid = session.user.id; // string user account

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      TOKEN_TTL_SECONDS,
      TOKEN_TTL_SECONDS
    );

    // Separate RTM token: captions are broadcast over the RTM signalling
    // channel, which does not accept the RTC token.
    const rtmToken = RtmTokenBuilder.buildToken(appId, appCertificate, uid, TOKEN_TTL_SECONDS);

    return NextResponse.json({ appId, channel, token, rtmToken, uid });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
