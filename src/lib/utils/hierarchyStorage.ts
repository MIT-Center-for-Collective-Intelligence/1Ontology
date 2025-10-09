import { getAuth } from "firebase/auth";

/**
 * Get Firebase Auth token for API calls
 */
const getAuthToken = async (): Promise<string> => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Not authenticated");
  }

  return await user.getIdToken();
};

/**
 * Fetch a specific hierarchy version by timestamp via API
 */
export const fetchHierarchyByTimestamp = async (
  appName: string,
  timestamp: number,
): Promise<any> => {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `/api/hierarchy/${appName}?version=${timestamp}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch hierarchy");
    }

    const result = await response.json();
    console.log(
      `✅ Fetched hierarchy version ${result.version}, ${result.hierarchy.stats.totalNodes} nodes`,
    );

    return result.hierarchy;
  } catch (error: any) {
    console.error(
      `Failed to fetch hierarchy version ${timestamp} for ${appName}:`,
      error,
    );
    throw error;
  }
};

/**
 * List all hierarchy versions for an app via API
 */
export const listHierarchyVersions = async (
  appName: string,
): Promise<{
  appName: string;
  totalVersions: number;
  versions: Array<{
    fileName: string;
    timestamp: number;
    date: string;
    size: string;
    url: string;
  }>;
  latest: {
    fileName: string;
    timestamp: number;
    date: string;
  };
}> => {
  try {
    const token = await getAuthToken();

    const response = await fetch(`/api/hierarchy/${appName}/versions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to list versions");
    }

    const result = await response.json();
    console.log(`✅ Found ${result.totalVersions} versions for ${appName}`);

    return result;
  } catch (error: any) {
    console.error(`Failed to list hierarchy versions for ${appName}:`, error);
    throw error;
  }
};
