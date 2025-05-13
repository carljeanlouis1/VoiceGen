import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { CTA, THEME } from "./constants";

export function CTASection() {
  const [, navigate] = useLocation();
  
  return (
    <section className="py-24 px-8">
      <div className="container mx-auto max-w-3xl">
        <div className={`bg-gradient-to-r from-[${THEME.primary}]/10 to-[${THEME.secondary}]/10 backdrop-blur-sm border border-zinc-800 rounded-3xl p-8 md:p-16 text-center`}>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {/* CUSTOMIZE: Update CTA title in constants.ts */}
            {CTA.title}
          </h2>
          
          <p className="text-xl text-zinc-400 mb-8 max-w-xl mx-auto">
            {/* CUSTOMIZE: Update CTA description in constants.ts */}
            {CTA.description}
          </p>
          
          <Link href="/convert">
            <Button 
              size="lg"
              className="rounded-full bg-white text-black hover:bg-white/90 transition-all py-6 px-8 text-lg"
            >
              {/* CUSTOMIZE: Update CTA button text in constants.ts */}
              {CTA.buttonText}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}