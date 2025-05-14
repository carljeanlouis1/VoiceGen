import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioFile } from "@shared/schema";
import { AudioPlayer } from "./audio-player";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Trash2, Download, Music } from "lucide-react";

// Import our new UI components
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui-system/Card";
import { Button } from "@/components/ui-system/Button";
import { COLORS, SHADOWS } from "@/components/ui-system/design-tokens";

export function LibraryGrid() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: audioFiles, isLoading } = useQuery<AudioFile[]>({
    queryKey: ["/api/library"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest(`/api/library/${id}`, { method: "DELETE" });
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} elevated>
            <CardContent className="h-48">
              <div className="animate-pulse bg-zinc-800/50 h-full w-full rounded-lg" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!audioFiles?.length) {
    return (
      <Card gradient elevated>
        <CardContent className="p-12 text-center">
          <Music className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
          <h3 className="text-xl font-medium text-white mb-2">Your Library is Empty</h3>
          <p className="text-zinc-300 max-w-md mx-auto">
            Create content using the Convert or Create pages to see your audio files here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {audioFiles.map((file) => (
        <Card key={file.id} elevated hover>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="font-semibold text-white">{file.title}</div>
            <div className="flex space-x-1">
              <a 
                href={file.audioUrl} 
                download={`${file.title}.mp3`}
                className="block"
              >
                <Button variant="ghost" size="icon">
                  <Download className="h-4 w-4 text-zinc-400 hover:text-white" />
                </Button>
              </a>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4 text-zinc-400 hover:text-white" />
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
            </div>
          </CardHeader>
          <CardContent>
            <AudioPlayer src={file.audioUrl} title={file.title} />
          </CardContent>
          {file.summary && (
            <CardFooter>
              <p className="text-sm text-zinc-300">{file.summary}</p>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}
