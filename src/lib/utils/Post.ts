import { getIdToken } from "../firestoreClient/auth";
import API from "./axiosConfig";

export const Post = async <R>(
  mapUrl: string,
  postData: any = {},
  callAgain: boolean = true
): Promise<R> => {
  try {
    const token = await getIdToken();
    const response = await API.post(
      `/api${mapUrl}`,
      { ...postData },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error) {
    const token = await getIdToken();
    if (callAgain) {
      const response = await API.post(
        `/api${mapUrl}`,
        { ...postData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } else {
      throw error;
    }
  }
};
