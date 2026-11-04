import { handleAction } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return handleAction(action, req);
}
