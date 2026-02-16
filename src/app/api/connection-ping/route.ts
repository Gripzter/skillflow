/**
 * Minimal ping endpoint for connection quality testing.
 * Returns a tiny JSON payload to measure round-trip time.
 */
export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET() {
  return Response.json({ t: Date.now() }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });
}
