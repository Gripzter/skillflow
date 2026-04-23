import Link from "next/link";

export default function FoundersPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 text-white">
      <h1 className="text-3xl font-bold">Founders Program — Coming Soon</h1>
      <Link href="/dashboard" className="mt-6 inline-block text-sm font-medium text-teal hover:underline">
        Back to Dashboard
      </Link>
    </main>
  );
}
