import LandingNav from "@/components/landing/LandingNav";
import LiveTicker from "@/components/landing/LiveTicker";
import Hero from "@/components/landing/Hero";
import GamesGrid from "@/components/landing/GamesGrid";
import RankLadder from "@/components/landing/RankLadder";
import FoundersSection from "@/components/landing/FoundersSection";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

type LandingPageProps = {
  foundersRemaining: number | null;
  foundersClosed: boolean;
};

export default function LandingPage({ foundersRemaining, foundersClosed }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0E0E12] text-white">
      <LandingNav />
      <LiveTicker />
      <main>
        <Hero />
        <GamesGrid />
        <RankLadder />
        <FoundersSection remaining={foundersRemaining} closed={foundersClosed} />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
