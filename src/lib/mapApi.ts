import API from "./utils/axiosConfig";
export const Post = async <R>(
  mapUrl: string,
  postData: any = {},
  callAgain: boolean = true
): Promise<R> => {
  try {
    const response = await API.post(`${mapUrl}`, { ...postData });
    return response.data;
  } catch (error) {
    if (callAgain) {
      const response = await API.post(`${mapUrl}`, { ...postData });
      return response.data;
    } else {
      throw error;
    }
  }
};
