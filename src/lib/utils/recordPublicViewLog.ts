import { Post } from "@components/lib/utils/Post";
import {
  getBrowser,
  getOperatingSystem,
} from "@components/lib/firestoreClient/errors.firestore";
import { PublicViewLogInput } from "@components/lib/utils/publicViewLog";

/** Writes one public-view interaction to the `logs` collection. */
export const recordPublicViewLog = async (
  entry: Omit<PublicViewLogInput, "browser" | "operatingSystem">,
) => {
  try {
    await Post("/public/log", {
      ...entry,
      browser: getBrowser(),
      operatingSystem: getOperatingSystem(),
    });
  } catch (error) {
    console.error(error);
  }
};
