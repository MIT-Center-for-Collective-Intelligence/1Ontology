import { getIdToken } from "./firestoreClient/auth";
import API from "./utils/axiosConfig";
export const Post = async <R>(
  mapUrl: string,
  postData: any = {},
  callAgain: boolean = true
): Promise<R> => {
    const token = await getIdToken();
  try {
    const response = await API.post(`/api/${mapUrl}`, { ...postData },{ headers: { Authorization: `Bearer ${token}` } });
    return response.data;
  } catch (error) {
    if (callAgain) {
      const response = await API.post(`/api/${mapUrl}`, { ...postData },{ headers: { Authorization: `Bearer ${token}` } });
      return response.data;
    } else {
      throw error;
    }
  }
};

