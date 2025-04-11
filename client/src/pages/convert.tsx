import { TextToSpeechForm } from "@/components/text-to-speech-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";

export default function Convert() {
  return (
    <div className="container max-w-4xl py-8">
      <Card className="card-gradient shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Convert Text to Speech</CardTitle>
          <CardDescription>
            Transform your text into natural-sounding speech with our advanced AI voice technology
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TextToSpeechForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/library"] });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}