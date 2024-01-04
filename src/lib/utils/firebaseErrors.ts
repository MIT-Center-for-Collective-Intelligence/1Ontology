// Importing FirebaseError from the firebase/app module
import { FirebaseError } from "firebase/app";

// A function to convert FirebaseError codes to user-friendly error messages
export const getFirebaseFriendlyError = (error: FirebaseError): string => {
  // Switch statement to handle different FirebaseError codes
  switch (error.code) {
    // Case for weak password error
    case "auth/weak-password":
      return "Strong passwords have at least 6 characters and a mix of letters and numbers.";

    // Case for expired action code error
    case "auth/expired-action-code":
      return "Your request to reset your password has expired or the link has already been used.";

    // Case for user not found error
    case "auth/user-not-found":
      return "There is no user record corresponding to this identifier.";

    // Case for email already exists error
    case "auth/email-already-exists":
      return "The email address is already in use by another account.";

    // Case for user not found error (duplicate case, consider removing one)
    case "auth/user-not-found":
      return "There is no user record corresponding to this identifier.";

    // Case for wrong password error
    case "auth/wrong-password":
      return "The password is invalid.";

    // Case for too many requests error
    case "auth/too-many-requests":
      return "This account is temporarily disabled due to multiple failed login attempts. Restore access by resetting your password or trying again later.";

    // Default case for any other error not explicitly handled
    default:
      return error.message;
  }
};

