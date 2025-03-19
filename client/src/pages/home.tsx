import { TextToSpeechForm } from "@/components/text-to-speech-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";

export default function Home() {
  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Convert Text to Speech</CardTitle>
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
