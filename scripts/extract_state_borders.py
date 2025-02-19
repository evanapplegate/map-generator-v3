import json
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import itertools

# Load the GeoJSON
with open('../vanilla/geojson/US_states.geojson', 'r') as f:
    states = json.load(f)

print("Number of features:", len(states['features']))

# Convert features to shapely geometries with state info
state_geoms = []
for i, feature in enumerate(states['features']):
    print(f"Processing feature {i}:", feature['properties'])
    # Skip features without postal codes (territories)
    if 'postal' not in feature['properties']:
        continue
    geom = shape(feature['geometry'])
    state_geoms.append((feature['properties']['postal'], geom))

print(f"Processing {len(state_geoms)} states")

# Find borders between each pair of states
borders = []
for (state1_code, geom1), (state2_code, geom2) in itertools.combinations(state_geoms, 2):
    # If states share a border (intersection of boundaries is non-empty)
    intersection = geom1.boundary.intersection(geom2.boundary)
    if not intersection.is_empty and not intersection.is_empty and intersection.length > 0:
        borders.append({
            'type': 'Feature',
            'properties': {
                'state1': state1_code,
                'state2': state2_code
            },
            'geometry': mapping(intersection)
        })

print("Found", len(borders), "borders")

# Create output GeoJSON
output = {
    'type': 'FeatureCollection',
    'features': borders
}

# Save the result
with open('../vanilla/geojson/US_state_borders.geojson', 'w') as f:
    json.dump(output, f)
print("Saved borders to US_state_borders.geojson")
