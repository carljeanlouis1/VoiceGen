import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioFile } from "@shared/schema";
import { AudioPlayer } from "./audio-player";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function LibraryGrid() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: audioFiles, isLoading } = useQuery<AudioFile[]>({
    queryKey: ["/api/library"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({
        title: "Success",
        description: "Audio file deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-48" />
          </Card>
        ))}
      </div>
    );
  }

  if (!audioFiles?.length) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">
          No audio files in your library yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {audioFiles.map((file) => (
        <Card key={file.id}>
          {file.artworkUrl && (
            <div className="relative aspect-square">
              <img
                src={file.artworkUrl}
                alt={`Artwork for ${file.title}`}
                className="object-cover w-full h-full rounded-t-lg"
              />
            </div>
          )}
          <CardHeader>
            <div className="flex justify-between items-start">
              <h3 className="font-semibold">{file.title}</h3>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete audio file?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(file.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
          <CardContent>
            <AudioPlayer src={file.audioUrl} title={file.title} />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {audioFiles.map((file) => (
        <Card key={file.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold">{file.title}</div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Audio File</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{file.title}"? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(file.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent>
            <AudioPlayer src={file.audioUrl} title={file.title} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
