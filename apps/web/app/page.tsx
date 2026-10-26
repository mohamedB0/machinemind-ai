"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import FeatureSection from "@/components/landing/FeatureSection";
import HowItWorks from "@/components/landing/HowItWorks";
import ProductPreview from "@/components/landing/ProductPreview";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && token) router.replace("/dashboard");
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="typing-dot w-2.5 h-2.5 bg-accent" />
          <span className="font-mono text-xs tracking-[0.2em] text-lo">INITIALIZING</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen scroll-smooth bg-bg text-ink">
      <Navbar />
      <main>
        <HeroSection />
        <FeatureSection />
        <HowItWorks />
        <ProductPreview />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
