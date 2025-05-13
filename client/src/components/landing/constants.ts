// Landing page configuration and content
// Customize these values to update the landing page content without changing component code

// Color theme
export const THEME = {
  // CUSTOMIZE: Update these colors to match your brand
  primary: "#0A84FF",     // Apple iOS blue
  secondary: "#30D158",   // Apple iOS green
  accent: "#FF453A",      // Apple iOS red
  background: {
    from: "zinc-900",     // Gradient start
    via: "zinc-800",      // Gradient middle
    to: "black"           // Gradient end
  },
  text: {
    primary: "zinc-200",  // Default text color
    secondary: "zinc-400" // Secondary text color
  }
};

// Hero section
export const HERO = {
  // CUSTOMIZE: Update the headline and subheadline
  headline: "Your Voice, Amplified.",
  subheadline: "VoiceGen turns any text into rich, AI-generated podcasts, voice clips, or long-form articles. Just type, and transform.",
  ctaText: "Start Creating",
  
  // CUSTOMIZE: Update the audio sample path
  audioSample: "/voice-samples/shimmer.mp3" // Path to the audio file to play in the hero section
};

// Feature section
export const FEATURES = [
  // CUSTOMIZE: Update feature content
  {
    id: "podcast-generation",
    title: "Podcast Generation",
    description: "Transform any topic into a complete podcast script with automated research, compelling storytelling, and natural dialogue.",
    icon: "Headphones",
    color: THEME.primary
  },
  {
    id: "text-to-speech",
    title: "Lifelike Text-to-Speech",
    description: "Choose from premium voices with natural inflection and emotion. Seamlessly convert long texts with perfect pronunciation.",
    icon: "Volume2",
    color: THEME.secondary
  },
  {
    id: "ai-content",
    title: "AI Content Creation",
    description: "Generate articles, scripts, and stories with a powerful multi-modal AI that understands context and can search the web.",
    icon: "MessageSquareText",
    color: THEME.accent
  }
];

// Example section
export const EXAMPLES = {
  // CUSTOMIZE: Update example content
  before: {
    title: "Raw Text",
    content: "The impact of quantum computing on cybersecurity represents one of the most significant technological challenges of our time. As quantum computers become more powerful...",
    description: "Plain text has limited engagement potential and requires active reading."
  },
  after: {
    title: "VoiceGen Audio",
    audioSample: "/voice-samples/shimmer.mp3", // Path to the audio file to play
    description: "Transformed into engaging, professional audio with natural voice inflection."
  }
};

// Testimonials section
export const TESTIMONIALS = [
  // CUSTOMIZE: Update testimonial content
  {
    id: 1,
    name: "Jamie Chen",
    role: "Content Creator",
    quote: "VoiceGen has cut my podcast production time in half. The AI does the research while I focus on making the content unique. Game changer."
  },
  {
    id: 2,
    name: "Marcus Johnson",
    role: "Digital Marketer",
    quote: "I'm creating audio content in multiple voices for our marketing campaigns. The quality is indistinguishable from professional voice actors."
  },
  {
    id: 3,
    name: "Sophia Rodriguez",
    role: "Educator",
    quote: "My students engage more with audio learning materials. VoiceGen helps me create accessible content for different learning styles."
  }
];

// Stats section
export const STATS = [
  // CUSTOMIZE: Update statistics
  { value: "600k+", label: "Minutes Generated" },
  { value: "12,500+", label: "Active Users" },
  { value: "88%", label: "Time Saved" },
  { value: "6", label: "Premium Voices" }
];

// CTA section
export const CTA = {
  // CUSTOMIZE: Update CTA content
  title: "Ready to amplify your content?",
  description: "Join thousands of creators using VoiceGen to transform how they produce and share ideas.",
  buttonText: "Start Creating for Free" 
};

// Footer links
export const FOOTER_LINKS = [
  // CUSTOMIZE: Update footer links
  { text: "Privacy", href: "#" },
  { text: "Terms", href: "#" },
  { text: "Contact", href: "#" }
];