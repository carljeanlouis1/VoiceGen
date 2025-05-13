import { 
  Headphones, 
  Volume2, 
  MessageSquareText,
  Layers,
  Sparkles,
  Zap
} from "lucide-react";
import { FEATURES } from "./constants";

// Map string icon names to actual icon components
const iconMap = {
  "Headphones": Headphones,
  "Volume2": Volume2,
  "MessageSquareText": MessageSquareText,
  "Layers": Layers,
  "Sparkles": Sparkles,
  "Zap": Zap
};

export function Features() {
  return (
    <section id="features" className="py-24 px-8 bg-black">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Create with Intelligence
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {FEATURES.map((feature) => {
            // Dynamically get the icon component
            const IconComponent = iconMap[feature.icon as keyof typeof iconMap] || MessageSquareText;
            
            return (
              <div 
                key={feature.id}
                className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 transition-all hover:border-[color:var(--hover-border)] hover:bg-zinc-900/70"
                style={{ '--hover-border': `${feature.color}50` } as React.CSSProperties}
              >
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${feature.color}10` }}
                >
                  <IconComponent 
                    className="h-8 w-8" 
                    style={{ color: feature.color }}
                  />
                </div>
                
                <h3 className="text-xl font-semibold mb-4">
                  {feature.title}
                </h3>
                <p className="text-zinc-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}