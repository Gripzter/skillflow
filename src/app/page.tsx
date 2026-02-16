import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Games from "@/components/Games";
import Stats from "@/components/Stats";
import FAQ from "@/components/FAQ";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import ScrollReveal from "@/components/ScrollReveal";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ScrollReveal>
          <HowItWorks />
        </ScrollReveal>
        <ScrollReveal delay={1}>
          <Games />
        </ScrollReveal>
        <ScrollReveal>
          <Stats />
        </ScrollReveal>
        <ScrollReveal delay={1}>
          <FAQ />
        </ScrollReveal>
        <ScrollReveal>
          <FinalCTA />
        </ScrollReveal>
        <Footer />
      </main>
    </>
  );
}
