/* This is a sign-up page component for a Next.js application using Firebase for authentication and Firestore for data storage. It uses Material UI for styling, Formik for form handling, Yup for form validation, and React Query for data fetching.

1. The `signUp` function is used to create a new user in Firebase and Firestore. It takes user data as an argument, creates a new user in Firebase using the `createUserWithEmailAndPassword` function, and then creates a new document in the Firestore 'users' collection with the same user data.

2. The `SignUpPage` component is the main component of the file. It uses the `useRouter` hook from Next.js to navigate between pages, the `useAuth` hook to handle authentication errors, and the `useSnackbar` hook to display notifications.

3. The `mutateSignUp` mutation is used to call the `signUp` function when the form is submitted. If the mutation is successful, it navigates to the sign-in page and sends a verification email to the user. If the mutation fails, it handles the error and displays a notification.

4. The `initialValues` object and `validationSchema` object are used to set the initial values and validation rules for the form.

5. The `handleSignUp` function is used to submit the form. It takes the form values as an argument, creates a user object, and calls the `mutateSignUp` mutation with the user object.

6. The `formik` object is created using the `useFormik` hook. It takes the initial values, validation schema, and submit handler as arguments.

7. The component returns a form with a `SignUpBasicInfo` component for the form fields and a submit button. The form uses the `formik` object for form handling.

8. The `getLayout` function is used to wrap the page in an `AuthLayout` component. This is a common pattern in Next.js for applying a layout to a page.

9. The component is exported as the default export of the module. */

import { LoadingButton } from "@mui/lab";
import { Box, Typography } from "@mui/material";
import { FirebaseError } from "firebase/app";
import { useFormik } from "formik";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import React, { ReactNode } from "react";
import { useMutation } from "react-query";
import * as yup from "yup";

import AuthLayout from "../components/layouts/AuthLayout";
import {
  NextPageWithLayout,
  SignUpData,
  SignUpFormValues,
} from " @components/types/IAuth";
import { useAuth } from " @components/components/context/AuthContext";
import { sendVerificationEmail } from " @components/lib/firestoreClient/auth";
import { SignUpBasicInfo } from " @components/components/Auth/SignUpBasicInfo";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, doc, getFirestore, setDoc } from "firebase/firestore";
import ROUTES from " @components/lib/utils/routes";
import { USERS } from " @components/lib/firestoreClient/collections";

const getDateBySubstractYears = (years: number, date = new Date()) => {
  date.setFullYear(date.getFullYear() - years);
  return date;
};
const defaultImageUrl =
  "https://storage.googleapis.com/onecademy-1.appspot.com/ProfilePictures/no-img.png";

const signUp = (data: any) => {
  return new Promise(async (resolve, reject) => {
    try {
      const auth = getAuth();
      const db = getFirestore();
      const userRecord = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );
      const { uid } = userRecord.user;
      const newUser = {
        uname: data.uname,
        email: data.email,
        createdAt: new Date(),
        updatedAt: new Date(),
        fName: data.fName,
        lName: data.lName,
        imageUrl: defaultImageUrl,
        color: "#36cd96",
        blocked: false,
        userId: uid,
      };
      const newUserRef = doc(collection(db, USERS), data.uname);
      await setDoc(newUserRef, newUser);
      resolve("User signed up successfully");
    } catch (error) {
      reject(error);
    }
  });
};

const SignUpPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [, { handleError }] = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const mutateSignUp = useMutation<any, unknown, SignUpData>(signUp, {
    onSuccess: async (data, variables) => {
      try {
        router.push(ROUTES.signIn);
        await sendVerificationEmail();
        enqueueSnackbar(
          "We have sent an email with a confirmation link to your email address.",
          {
            variant: "success",
            autoHideDuration: 10000,
          }
        );
      } catch (error) {
        console.error(error);
        handleError({ error, showErrorToast: false });
      }
    },
    onError: (error) => {
      if (error instanceof FirebaseError) {
        handleError({ error, errorMessage: (error as FirebaseError).message });
        return;
      }
      handleError({ error, errorMessage: error as string });
    },
  });

  const initialValues: SignUpFormValues = {
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    theme: "Dark",
    passwordConfirmation: "",
  };

  const validationSchema = yup.object({
    firstName: yup.string().required("Please enter your first name"),
    lastName: yup.string().required("Please enter your last name"),
    email: yup.string().email("Invalid email address"),
    username: yup
      .string()
      .required("Your desired username is required")
      .min(4, "A username with at least 4 characters is required")
      .matches(
        /^((?!(__.*__)|\.|\/).)*$/,
        "Usernames should not contain . or / or __"
      ),
    password: yup
      .string()
      .min(7, "Password must be at least 7 characters")
      .required("A secure password is required"),
    passwordConfirmation: yup
      .string()
      .oneOf(
        [yup.ref("password"), null],
        "Password must match re-entered password"
      )
      .required("Re-enter password is required"),
  });

  const handleSignUp = async (values: SignUpFormValues) => {
    const user: any = {
      uname: values.username,
      email: values.email,
      fName: values.firstName,
      lName: values.lastName,
      password: values.password,
      theme: values.theme,
    };
    mutateSignUp.mutate(user);
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleSignUp,
  });

  return (
    <Box sx={{ p: { xs: "8px", md: "24px", width: "100%" } }}>
      <Typography variant="h1" sx={{ mb: "8px" }}>
        Sign Up{" "}
      </Typography>
      <form data-testid="signup-form" onSubmit={formik.handleSubmit}>
        <SignUpBasicInfo formikProps={formik} />
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            my: "32px",
          }}
        >
          <LoadingButton
            loading={mutateSignUp.isLoading}
            type="submit"
            disabled={formik.isSubmitting}
            variant="contained"
            fullWidth
            sx={{ mt: "5px", borderRadius: "26px", width: "90px" }}
          >
            Sign up
          </LoadingButton>
        </Box>
      </form>
    </Box>
  );
};

SignUpPage.getLayout = (page: ReactNode) => {
  return <AuthLayout>{page}</AuthLayout>;
};

export default SignUpPage;
