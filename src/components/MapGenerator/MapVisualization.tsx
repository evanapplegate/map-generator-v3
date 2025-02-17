import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MapData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import ExportButtons from './ExportButtons';

interface MapVisualizationProps {
  data: MapData;
}

const MapVisualization = ({ data }: MapVisualizationProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geoData, setGeoData] = useState<{ countries: any; countryBounds: any; states: any; stateBounds: any } | null>(null);
  const { toast } = useToast();

  const handleExport = async (type: string) => {
    if (!svgRef.current) return;
    
    if (type === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'map.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Reset loading state whenever data changes
  useEffect(() => {
    setIsLoading(true);
  }, [data]);

  useEffect(() => {
    console.log('Map data:', data);
    console.log('Show labels?', data.showLabels);
    console.log('Highlight colors:', data.highlightColors);

    const loadMap = async () => {
      try {
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const width = 960;
        const height = 600;

        svg
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", [0, 0, width, height].join(" "))
          .attr("style", "max-width: 100%; height: auto;")
          .style("background-color", "#F9F5F1");

        const isUSMap = data.mapType === 'us';
        console.log('Map type:', isUSMap ? 'US Map' : 'World Map');

        const projection = isUSMap 
          ? d3.geoAlbersUsa()
              .scale(1300)
              .translate([487.5, 305])
          : d3.geoEqualEarth()
              .scale(180)
              .translate([width / 2, height / 2]);

        const path = d3.geoPath().projection(projection);

        // Always load both datasets to handle mixed queries
        const dataPromise = Promise.all([
          d3.json("/geojson/countries.geojson"),
          d3.json("/geojson/country_bounds.geojson"),
          d3.json("/geojson/US_states.geojson"),
          d3.json("/geojson/US_bounds.geojson")
        ]);

        const [countries, countryBounds, states, stateBounds] = await dataPromise;
        setGeoData({ countries, countryBounds, states, stateBounds });
        console.log('First region feature:', countries.features[0]);
        
        // Draw regions - STRICTLY NO STROKE
        // First draw countries
        svg.append("g")
          .selectAll("path")
          .data(countries.features)
          .join("path")
          .attr("d", path)
          .attr("fill", (d: any) => {
            const code = d.properties?.ISO_A3 || d.properties?.iso_a3;
            return data.highlightColors?.[code] || data.defaultFill || "#edded1";
          });

        // Then draw states on top
        svg.append("g")
          .selectAll("path")
          .data(states.features)
          .join("path")
          .attr("d", path)
          .attr("fill", (d: any) => {
            const code = d.properties?.postal;
            return data.highlightColors?.[code] || data.defaultFill || "#edded1";
          });

        // Draw bounds - STRICTLY 1PX WHITE STROKE
        svg.append("g")
          .selectAll("path")
          .data([...countryBounds.features, ...stateBounds.features])
          .join("path")
          .datum((d: any) => d)
          .attr("d", path)
          .attr("fill", "none")
          .attr("stroke", "#F9F5F1")
          .attr("stroke-width", "1");

        // Add labels where specified
        if (data.showLabels) {
          console.log('Adding labels...');
          svg.append("g")
            .selectAll("text")
            .data([...countries.features, ...states.features])
            .join("text")
            .attr("transform", (d: any) => {
              const centroid = path.centroid(d);
              console.log('Centroid for feature:', centroid);
              if (isNaN(centroid[0]) || isNaN(centroid[1])) {
                console.log('Invalid centroid for feature:', d);
                return null;
              }
              return `translate(${centroid[0]},${centroid[1]})`;
            })
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .text((d: any) => {
              const code = d.properties?.ISO_A3 || d.properties?.iso_a3 || d.properties?.postal;
              const name = d.properties?.NAME || d.properties?.name || code;
              console.log('Label check:', { code, name, hasHighlight: !!data.highlightColors?.[code] });
              
              return data.highlightColors?.[code] ? name : "";
            })
            .attr("fill", "#000000")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .style("pointer-events", "none");
        }

        // Add tooltips
        const tooltip = d3.select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("position", "absolute")
          .style("visibility", "hidden")
          .style("background-color", "#ffffff")
          .style("padding", "10px")
          .style("border-radius", "5px")
          .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

        svg.selectAll("path")
          .on("mouseover", (event, d: any) => {
            const name = d.properties?.NAME || d.properties?.name || 'Unknown';
            const code = d.properties?.ISO_A3 || d.properties?.iso_a3 || d.properties?.postal || 'Unknown';
              
            tooltip
              .style("visibility", "visible")
              .html(`<strong>${name}</strong> (${code})`);
          })
          .on("mousemove", (event) => {
            tooltip
              .style("top", (event.pageY - 10) + "px")
              .style("left", (event.pageX + 10) + "px");
          })
          .on("mouseout", () => {
            tooltip.style("visibility", "hidden");
          });

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading map data:', error);
        toast({
          title: "Error",
          description: "Failed to load map data",
          variant: "destructive"
        });
        setIsLoading(false);
      }
    };

    loadMap();
    return () => {
      d3.select("body").selectAll(".tooltip").remove();
    };
  }, [data, toast]);

  return (
    <div className="w-full overflow-x-auto bg-[#F9F5F1] rounded-lg shadow-lg p-4">
      <div style={{ position: 'relative' }}>
        {isLoading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(249, 245, 241, 0.9)',
            padding: '8px 16px',
            borderRadius: '4px',
            zIndex: 1000,
          }}>
            Loading maps...
          </div>
        )}
        <svg
          ref={svgRef}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '16/9',
          }}
        />
        <ExportButtons 
          onExport={handleExport}
          mapData={data}
          geojsonData={geoData}
        />
      </div>
    </div>
  );
};

export default MapVisualization;
