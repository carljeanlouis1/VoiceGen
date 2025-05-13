import { TextToSpeechForm } from "@/components/text-to-speech-form";
import { queryClient } from "@/lib/queryClient";
import { AppLayout } from "@/components/ui-system/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui-system/Card";
import { COLORS } from "@/components/ui-system/design-tokens";

export default function Convert() {
  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#0A84FF] to-[#30D158] bg-clip-text text-transparent">
            Convert Text to Speech
          </h1>
          <p className="text-zinc-400 max-w-2xl">
            Transform your text into natural-sounding speech with our advanced AI voice technology
          </p>
        </header>
        
        <Card gradient elevated>
          <CardContent>
            <TextToSpeechForm
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/library"] });
              }}
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}