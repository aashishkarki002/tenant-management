import { useState, useEffect, useMemo } from "react";
import api from "../../plugins/axios";
import { toast } from "sonner";

/**
 * Returns the first property and its derived tree.
 *
 * The API returns:
 *   property[0]
 *     └── buildings[]          (was "blocks" in DB, renamed for clarity)
 *           └── sections[]     (was "innerBlocks" in DB)
 *
 * Exposed:
 *   property    - the full first property object (name, _id, buildings)
 *   buildings   - shortcut to property.buildings  (Birendra Sadhan, Narendra Sadhan)
 *   getSections - helper: getSections(buildingId) → sections for that building
 */
function useProperty() {
  const [propertyList, setPropertyList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const getProperty = async () => {
      try {
        const response = await api.get("/api/property/get-property", {
          signal: controller.signal,
        });

        if (response.data.success) {
          // Backend returns `property` key (array from aggregate)
          setPropertyList(response.data.property || []);
        } else {
          throw new Error(response.data.message || "Failed to fetch property");
        }
      } catch (error) {
        if (error.name === "AbortError" || error.code === "ERR_CANCELED")
          return;
        console.error("Error fetching property:", error);
        toast.error("Failed to fetch property. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    getProperty();
    return () => controller.abort(); // cancel on unmount
  }, []);

  // Sallyan House is the only property — grab first entry
  const property = propertyList[0] ?? null;

  // buildings = Blocks (Birendra Sadhan, Narendra Sadhan)
  const buildings = property?.buildings ?? [];

  /**
   * Returns sections (InnerBlocks) for a given building _id.
   * Usage: getSections(selectedBuildingId)  →  [Sagar Block, Jyoti Block, …]
   */
  const getSections = useMemo(
    () => (buildingId) =>
      buildings.find((b) => b._id === buildingId)?.sections ?? [],
    [buildings],
  );

  return { property, buildings, getSections, loading };
}

export default useProperty;
