"use client";

import LandingNavbar from "./LandingNavbar";
import LandingHero from "./LandingHero";
import GameShowcase from "./GameShowcase";
import HowItWorksSection from "./HowItWorksSection";
import StatsSection from "./StatsSection";
import WhySkillFlow from "./WhySkillFlow";
import FinalCTASection from "./FinalCTASection";
import LandingFooter from "./LandingFooter";
import ScrollReveal from "./ScrollReveal";

export default function LandingPage() {
  return (
    <>
      <LandingNavbar />
      <main>
        <LandingHero />
        <ScrollReveal>
          <GameShowcase />
        </ScrollReveal>
        <ScrollReveal>
          <HowItWorksSection />
        </ScrollReveal>
        <ScrollReveal>
          <StatsSection />
        </ScrollReveal>
        <ScrollReveal>
          <WhySkillFlow />
        </ScrollReveal>
        <ScrollReveal>
          <FinalCTASection />
        </ScrollReveal>
        <LandingFooter />
      </main>
    </>
  );
}
