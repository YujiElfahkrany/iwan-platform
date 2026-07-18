import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { deleteClassCascade, deleteUserCascade } from "@/lib/adminCascade";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, id } = await req.json();
  if (!type || !id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await connectDB();

  if (type === "class") {
    await deleteClassCascade(id);
    return NextResponse.json({ ok: true });
  }

  if (type === "user") {
    const user = await User.findById(id).lean();
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await deleteUserCascade({ _id: user._id, role: user.role });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
