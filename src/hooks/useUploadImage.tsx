import {
  FirebaseStorage,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { useState } from "react";

export type UploadConfirmation = {
  question: string;
  comparator: string;
  errorMessage: string;
};
export type UploadImageInput = {
  event: any;
  path: string;
  confirmatory?: UploadConfirmation;
  imageFileName: string;
};
type UseUploadImage = { storage: FirebaseStorage };

export const useUploadImage = ({ storage }: UseUploadImage) => {
  const [isUploading, setIsUploading] = useState(false);
  const [percentageUploaded, setPercentageUploaded] = useState(0);

  const uploadImage = ({
    event,
    path,
    confirmatory,
    imageFileName,
  }: UploadImageInput): Promise<string> =>
    new Promise((resolve, reject) => {
      try {
        const image = event.target.files[0];
        if (!image) return reject("cancel upload image");
        const hasValidFormat = [
          "image/jpg",
          "image/jpeg",
          "image/gif",
          "image/png",
          "image/webp",
        ].includes(image.type);
        if (!hasValidFormat) {
          return reject(
            "We only accept JPG, JPEG, PNG, or GIF images. Please upload another image."
          );
        }

        if (confirmatory) {
          let userName = prompt(confirmatory.question);
          if (!userName) return reject("no confirmation");
          if (
            userName !==
            confirmatory.comparator /* `${user?.fName} ${user?.lName}` */
          ) {
            return reject(confirmatory.errorMessage);
          }
        }
        setIsUploading(true);
        const imageNameSplit = image.name.split(".");
        const imageExtension = imageNameSplit[imageNameSplit.length - 1];
        //   let imageFileName = user.userId + "/" + new Date().toUTCString() + "." + imageExtension;

        const storageRef = ref(
          storage,
          `${path}/${imageFileName}.${imageExtension}`
        );

        const task = uploadBytesResumable(storageRef, image);
        task.on(
          "state_changed",
          function progress(snapshot: any) {
            setPercentageUploaded(
              Math.ceil((100 * snapshot.bytesTransferred) / snapshot.totalBytes)
            );
          },
          function error(err: any) {
            console.error("Image Upload Error: ", err);
            setIsUploading(false);
            return reject(
              "There is an error with uploading your image. Please upload it again! If the problem persists, please try another image."
            );
          },
          async function complete() {
            const imageGeneratedUrl = await getDownloadURL(storageRef);
            setIsUploading(false);

            setPercentageUploaded(0);
            resolve(imageGeneratedUrl);
          }
        );
      } catch (err) {
        console.error("Image Upload Error: ", err);
        setIsUploading(false);
        setPercentageUploaded(0);
        reject(err);
      }
    });

  return { isUploading, percentageUploaded, uploadImage };
};
