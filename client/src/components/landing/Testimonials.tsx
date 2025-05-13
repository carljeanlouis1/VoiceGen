import { TESTIMONIALS, STATS } from "./constants";

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 px-8 bg-gradient-to-b from-zinc-900 to-black">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6">
          <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            What Creators Say
          </span>
        </h2>
        
        <p className="text-center text-zinc-400 mb-16 max-w-2xl mx-auto">
          VoiceGen is being used by content creators around the world to transform how they produce and share ideas.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* CUSTOMIZE: Update testimonials in constants.ts */}
          {TESTIMONIALS.map((testimonial) => (
            <div 
              key={testimonial.id}
              className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8 transition-all hover:border-zinc-700"
            >
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 rounded-full bg-zinc-700 mr-4"></div>
                <div>
                  <h4 className="font-medium">{testimonial.name}</h4>
                  <p className="text-sm text-zinc-500">{testimonial.role}</p>
                </div>
              </div>
              
              <p className="text-zinc-400">
                "{testimonial.quote}"
              </p>
            </div>
          ))}
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 text-center">
          {/* CUSTOMIZE: Update stats in constants.ts */}
          {STATS.map((stat, index) => (
            <div key={index}>
              <h3 className="text-3xl md:text-4xl font-bold text-white">{stat.value}</h3>
              <p className="text-zinc-400 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}