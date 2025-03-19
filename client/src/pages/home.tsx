
import { TextToSpeechForm } from "@/components/text-to-speech-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { AudioFile } from "@shared/schema";
import { AudioPlayer } from "@/components/audio-player";

export default function Home() {
  const { data: audioFiles } = useQuery<AudioFile[]>({
    queryKey: ["/api/library"],
  });

  const recentFiles = audioFiles?.slice(0, 5) || [];

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <Card className="card-gradient shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Convert Text to Speech</CardTitle>
        </CardHeader>
        <CardContent>
          <TextToSpeechForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/library"] });
            }}
          />
        </CardContent>
      </Card>

      {recentFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Recent Generations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentFiles.map((file) => (
              <div key={file.id} className="space-y-2">
                <h3 className="font-medium">{file.title}</h3>
                <AudioPlayer src={file.audioUrl} title={file.title} />
                {file.artworkUrl && (
                  <img
                    src={file.artworkUrl}
                    alt={`Artwork for ${file.title}`}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
