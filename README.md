# VoiceGen

VoiceGen is an advanced AI-powered web application that provides intelligent, interactive multimedia content creation, search, and audio generation using multiple AI models and APIs.

## Project Overview

VoiceGen combines the power of multiple cutting-edge AI models (OpenAI's GPT-4o, Anthropic's Claude 3.7 Sonnet, Google's Gemini 2.5 Pro, and Perplexity Sonar Pro) to create a versatile platform for text-to-speech conversion, AI-driven content creation, and AI-enhanced web search.

## Key Features

- **Text-to-Speech Conversion**: Convert any text to high-quality speech using multiple voice options
- **Multi-Model AI Chat**: Interact with Claude 3.7 Sonnet, GPT-4o, or Gemini 2.5 Pro 
- **AI-Powered Web Search**: Get comprehensive search results using Perplexity's Sonar Pro API
- **Podcast Creation**: Generate research-backed podcasts with "Arion Vale" persona, supporting multi-part episodes
- **Content Generation**: Create articles, stories, scripts, and more using AI with optional image analysis
- **Real-time Processing**: Progress tracking for long audio generation tasks
- **Personal Audio Library**: Save and manage your generated audio files
- **Background Processing**: Handle large text inputs up to 60 minutes of audio
- **Artwork Generation**: Create custom artwork for audio files

## Technologies Used

### Frontend
- React with TypeScript
- Tailwind CSS with shadcn/ui component library
- TanStack React Query for API data fetching
- Custom audio player with full playback controls

### Backend
- Node.js with Express
- OpenAI API (GPT-4o for content generation, TTS-1 for text-to-speech)
- Anthropic API (Claude 3.7 Sonnet for content generation)
- Google Gemini API (Gemini 2.5 Pro for content and image analysis)
- Perplexity API (Sonar Pro for web search and research)
- File-based storage for large audio files

## Environment Variables

The application requires the following API keys to be set as environment variables:

- `OPENAI_API_KEY`: API key for OpenAI (GPT-4o, DALL·E, and text-to-speech)
- `ANTHROPIC_API_KEY`: API key for Anthropic's Claude models
- `GEMINI_API_KEY`: API key for Google's Gemini models
- `PERPLEXITY_API_KEY`: API key for Perplexity's search API

## How to Run

1. Clone the repository
2. Install dependencies with `npm install`
3. Set the required environment variables
4. Run the development server with `npm run dev`
5. The application will be available at `http://localhost:5000`

## Example Usage

### Text-to-Speech Conversion
1. Navigate to the Convert page
2. Enter or paste your text
3. Select a voice
4. Click "Convert to Speech"
5. Listen to or download the generated audio

### AI-Powered Web Search
1. Go to the Search page
2. Enter your search query
3. View comprehensive results with citations
4. Follow up with related questions

### Podcast Generation
1. Navigate to the Create page
2. Select "Podcast Creation"
3. Enter a topic and select options (voice, length, parts)
4. Click "Generate Single Part" or "Auto-Generate All Parts"
5. The research-based script will be generated with the option to convert to audio

### Multi-Model Chat
1. Go to the Chat page
2. Select your preferred AI model (Claude, GPT, or Gemini)
3. Start chatting with advanced AI assistance

## License

MIT