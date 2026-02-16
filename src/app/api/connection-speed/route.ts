/**
 * Minimal payload for download speed testing (~100KB).
 */
export const dynamic = "force-dynamic";
export const runtime = "edge";

const PAYLOAD_SIZE = 100 * 1024; // 100KB

export async function GET() {
  const buffer = new Uint8Array(PAYLOAD_SIZE);
  const body = new Blob([buffer]);
  return new Response(body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(PAYLOAD_SIZE),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
