import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateD3Bundle } from "@/lib/exportD3Bundle";
import { MapData } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface ExportButtonsProps {
  onExport: (type: string) => void;
  mapData: MapData;
  geojsonData: { regions: any; bounds: any } | null;
}

const ExportButtons = ({ onExport, mapData, geojsonData }: ExportButtonsProps) => {
  const { toast } = useToast();

  const handleD3Export = async () => {
    try {
      if (!geojsonData) {
        toast({
          title: "Error",
          description: "Map data not loaded yet",
          variant: "destructive"
        });
        return;
      }
      const bundle = await generateD3Bundle(mapData, geojsonData);
      const url = URL.createObjectURL(bundle);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'd3-map-bundle.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating D3 bundle:', error);
      toast({
        title: "Error",
        description: "Failed to generate D3 bundle",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex gap-2 justify-end mt-4">
      <Button
        variant="default"
        onClick={() => onExport('svg')}
        className="bg-[#8d7a69] text-[#F9F5F1] hover:bg-[#8d7a69]/90 flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        Export SVG
      </Button>
      <Button
        variant="default"
        onClick={handleD3Export}
        className="bg-[#8d7a69] text-[#F9F5F1] hover:bg-[#8d7a69]/90 flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        Export D3 Bundle
      </Button>
    </div>
  );
};

export default ExportButtons;