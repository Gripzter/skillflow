import { redirect } from "next/navigation";

export default function PlayMatchRedirectPage({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/match/${params.id}`);
}
