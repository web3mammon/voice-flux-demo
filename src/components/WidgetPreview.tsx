import { MessageSquare, Sparkles, Phone, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

interface WidgetPreviewProps {
  position: string;
  primaryColor: string;
  buttonText: string;
  buttonIcon?: string;
}

const getIconComponent = (iconName?: string) => {
  switch (iconName) {
    case "Message":
      return MessageSquare;
    case "Sparkles":
      return Sparkles;
    case "Phone":
      return Phone;
    default:
      return MessageSquare;
  }
};

export function WidgetPreview({ position, primaryColor, buttonText, buttonIcon }: WidgetPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const IconComponent = getIconComponent(buttonIcon);

  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "custom": "bottom-6 right-6",
  };

  return (
    <div className="relative h-[400px] bg-muted/20 rounded-lg border-2 border-dashed overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
        Website Preview
      </div>
      
      <div className={`absolute ${positionClasses[position as keyof typeof positionClasses]}`}>
        {isExpanded ? (
          <Card className="w-80 h-96 shadow-xl">
            <div 
              className="p-4 flex items-center justify-between text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <span className="font-semibold">Chat with us</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={() => setIsExpanded(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-muted rounded-lg p-3 max-w-[80%]">
                <p className="text-sm">Hi! How can I help you today?</p>
              </div>
            </div>
          </Card>
        ) : (
          <Button
            size="lg"
            className="rounded-full shadow-lg hover:scale-110 transition-transform"
            style={{ 
              backgroundColor: primaryColor,
              color: 'white'
            }}
            onClick={() => setIsExpanded(true)}
          >
            <IconComponent className="mr-2 h-5 w-5" />
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}
