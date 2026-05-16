import { redirect } from "next/navigation";

export default function SkillPointsRedirectPage() {
  redirect("/play?sp=1");
}
