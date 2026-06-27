import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { TopUpRequest } from "@/models/TopUpRequest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopUpRequestsTable } from "@/components/admin/TopUpRequestsTable";
import { getTranslations } from "next-intl/server";

export default async function AdminTopUpPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  const t = await getTranslations("admin");

  await connectDB();
  const requests = await TopUpRequest.find({ status: "pending" })
    .sort({ createdAt: 1 })
    .populate("userId", "name email")
    .lean();

  const data = requests.map((r) => ({
    id: r._id.toString(),
    amount: r.amount,
    receiptData: r.receiptData,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    user: {
      id: (r.userId as { _id: { toString(): string } })._id.toString(),
      name: (r.userId as { name: string }).name,
      email: (r.userId as { email: string }).email,
    },
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("topup_requests")}</h1>
        <Badge variant="secondary">{t("pending_count", { n: data.length })}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("pending_receipts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TopUpRequestsTable requests={data} />
        </CardContent>
      </Card>
    </div>
  );
}
