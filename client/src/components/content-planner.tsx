import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Check, ArrowRight } from "lucide-react";
import { ContentPlan } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContentPlannerProps {
  topic: string;
  duration: number;
  onPlanComplete: (plan: ContentPlan) => void;
  onStartResearch: (plan: ContentPlan, subtopicIndex: number) => void;
}

export function ContentPlanner({ 
  topic, 
  duration, 
  onPlanComplete, 
  onStartResearch 
}: ContentPlannerProps) {
  const { toast } = useToast();
  const [isPlanning, setIsPlanning] = useState(false);
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [selectedSubtopic, setSelectedSubtopic] = useState<number | null>(null);
  
  // Generate content plan
  const generatePlan = async () => {
    if (!topic) {
      toast({
        title: "Topic Required",
        description: "Please enter a podcast topic first.",
        variant: "destructive"
      });
      return;
    }
    
    setIsPlanning(true);
    
    try {
      const response = await apiRequest("/api/podcast/plan", {
        method: "POST",
        data: { 
          topic, 
          targetDuration: duration,
          researchDepth: calculateResearchDepth(duration)
        }
      });
      
      setPlan(response);
      setSelectedSubtopic(0); // Select the first subtopic by default
      onPlanComplete(response);
      
      toast({
        title: "Content Plan Generated",
        description: `Created a structured plan for your ${duration}-minute podcast with ${response.subtopics.length} subtopics.`
      });
    } catch (error) {
      console.error("Error generating plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate content plan. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPlanning(false);
    }
  };
  
  // Start research on the selected subtopic
  const startSubtopicResearch = () => {
    if (plan && selectedSubtopic !== null) {
      onStartResearch(plan, selectedSubtopic);
    }
  };
  
  // Calculate how many research prompts to use based on duration
  const calculateResearchDepth = (minutes: number) => {
    if (minutes >= 50) return 4;      // 50-60 min: 4 research prompts
    else if (minutes >= 35) return 3;  // 35-49 min: 3 research prompts
    else if (minutes >= 20) return 2;  // 20-34 min: 2 research prompts
    else return 1;                     // <20 min: 1 research prompt
  };
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Content Planning
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!plan ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Generate a structured content plan for your {duration}-minute podcast on "{topic}"</p>
            <Button 
              onClick={generatePlan} 
              disabled={isPlanning || !topic}
              className="w-full"
            >
              {isPlanning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Planning Content...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Generate Content Plan
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center text-green-600 dark:text-green-500">
              <Check className="h-5 w-5 mr-2" />
              <span className="font-medium">Content Plan Generated</span>
            </div>
            
            <div className="rounded-md bg-muted p-4">
              <h3 className="font-medium mb-2 text-sm">Podcast Structure</h3>
              <div className="space-y-3 text-sm">
                <p><span className="font-medium">Introduction:</span> {plan.introduction}</p>
                
                <div>
                  <p className="font-medium mb-2">Subtopics:</p>
                  <div className="space-y-2">
                    {plan.subtopics.map((subtopic, index) => (
                      <div 
                        key={index} 
                        className={`p-2 rounded cursor-pointer ${selectedSubtopic === index 
                          ? 'bg-primary/10 border border-primary/30' 
                          : 'hover:bg-muted/80'}`}
                        onClick={() => setSelectedSubtopic(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="h-6 w-6 flex items-center justify-center p-0 rounded-full">
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{subtopic.title}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ~{subtopic.estimated_duration} min
                          </span>
                        </div>
                        
                        {selectedSubtopic === index && (
                          <div className="mt-2 ml-8 text-xs text-muted-foreground">
                            <p className="mb-1 font-medium">Key Points:</p>
                            <ul className="list-disc pl-4 space-y-1">
                              {subtopic.key_points.map((point, i) => (
                                <li key={i}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <p><span className="font-medium">Conclusion:</span> {plan.conclusion}</p>
              </div>
            </div>
            
            <Button 
              onClick={startSubtopicResearch} 
              className="w-full"
              disabled={selectedSubtopic === null}
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Research Selected Subtopic
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}