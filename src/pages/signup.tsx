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
import { Box, Button, GlobalStyles, Paper, Typography } from "@mui/material";
import { FirebaseError } from "firebase/app";
import { useFormik } from "formik";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";
import React, { ReactNode, useEffect } from "react";
import { useMutation } from "react-query";
import * as yup from "yup";

import AuthLayout from "../components/layouts/AuthLayout";
import {
  NextPageWithLayout,
  SignUpData,
  SignUpFormValues,
} from "@components/types/IAuth";
import { useAuth } from "@components/components/context/AuthContext";
import { sendVerificationEmail } from "@components/lib/firestoreClient/auth";
import { SignUpBasicInfo } from "@components/components/Auth/SignUpBasicInfo";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, doc, getFirestore, setDoc } from "firebase/firestore";
import ROUTES from "@components/lib/utils/routes";
import { USERS } from "@components/lib/firestoreClient/collections";

const getDateBySubstractYears = (years: number, date = new Date()) => {
  date.setFullYear(date.getFullYear() - years);
  return date;
};
const defaultImageUrl =
  "https://storage.googleapis.com/onecademy-1.appspot.com/ProfilePictures/no-img.png";

const IosDotsLoader = ({
  color = "rgba(255, 255, 255, 0.92)",
}: {
  color?: string;
}) => {
  return (
    <Box
      aria-label="loading"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
        height: 18,
        "@keyframes iosDotPulse": {
          "0%, 80%, 100%": { transform: "scale(0.55)", opacity: 0.35 },
          "40%": { transform: "scale(1)", opacity: 1 },
        },
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          sx={{
            width: 5,
            height: 5,
            borderRadius: "999px",
            backgroundColor: color,
            boxShadow: "0 1px 1px rgba(0,0,0,0.28)",
            animation: "iosDotPulse 1.05s infinite ease-in-out",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </Box>
  );
};

const signUp = (data: any) => {
  return new Promise(async (resolve, reject) => {
    try {
      const auth = getAuth();
      const db = getFirestore();
      const userRecord = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.password,
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
          },
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
        "Usernames should not contain . or / or __",
      ),
    password: yup
      .string()
      .min(7, "Password must be at least 7 characters")
      .required("A secure password is required"),
    passwordConfirmation: yup
      .string()
      .oneOf(
        [yup.ref("password"), null],
        "Password must match re-entered password",
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: "28px",
          maxWidth: 420,
          width: "100%",
          mx: "auto",
          textAlign: "center",
          border: "1px solid rgba(255,255,255,0.10)",
          backgroundColor: "rgba(20, 20, 22, 0.68)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          boxShadow:
            "0 24px 70px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <Typography
          variant="h4"
          sx={{
            mb: 0.75,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            color: "rgba(255,255,255,0.94)",
            fontSize: { xs: "34px", sm: "52px" },
            textDecoration: "none",
            textDecorationColor: "transparent",
          }}
        >
          Sign Up
        </Typography>
        <Typography
          sx={{
            mb: 3.25,
            color: "rgba(255,255,255,0.70)",
            fontSize: { xs: "0.98rem", sm: "1.05rem" },
            lineHeight: 1.4,
          }}
        >
          Create an account to get started.
        </Typography>
        <GlobalStyles
          styles={{
            "& input:-webkit-autofill": {
              boxShadow: `0px 0px 0px 100px #313131 inset !important`,
              WebkitTextFillColor: `${"#fff"} !important`,
              caretColor: "#fff !important",
            },
          }}
        />
        <form data-testid="signup-form" onSubmit={formik.handleSubmit}>
          <SignUpBasicInfo formikProps={formik} />

          <LoadingButton
            aria-label="submit"
            loading={mutateSignUp.isLoading || formik.isSubmitting}
            loadingIndicator={<IosDotsLoader />}
            disabled={formik.isSubmitting}
            loadingPosition="center"
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              mt: 0.75,
              borderRadius: "14px",
              py: 1.75,
              px: 3,
              fontWeight: 600,
              fontSize: "15px",
              letterSpacing: "0.02em",
              textTransform: "none",
              color: "#ffffff",
              backgroundColor: "#3b82f6",
              border: "none",
              boxShadow: "none",
              transition: "background-color 120ms ease",
              "& .MuiLoadingButton-loadingIndicator": {
                left: "50%",
                transform: "translateX(-50%)",
                color: "#ffffff",
              },
              "&:hover": {
                backgroundColor: "#2563eb",
                boxShadow: "none",
              },
              "&:active": {
                backgroundColor: "#1d4ed8",
              },
              "&.Mui-disabled": {
                color: "rgba(255,255,255,0.85)",
                backgroundColor: "rgba(59, 130, 246, 0.5)",
              },
            }}
          >
            {mutateSignUp.isLoading || formik.isSubmitting ? (
              <Box component="span" sx={{ display: "block", height: 18 }} />
            ) : (
              "Sign Up"
            )}
          </LoadingButton>

          <NextLink href={ROUTES.signIn} passHref>
            <Button
              sx={{
                mt: 2.5,
                textTransform: "none",
                fontSize: "14px",
                fontWeight: 650,
                borderRadius: "999px",
                color: "rgba(255,255,255,0.75)",
                px: 2.25,
                "&:hover": {
                  color: "rgba(255,255,255,0.92)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                },
              }}
            >
              Already have an account? Sign in
            </Button>
          </NextLink>
        </form>
      </Paper>
    </Box>
  );
};

SignUpPage.getLayout = (page: ReactNode) => {
  return <AuthLayout>{page}</AuthLayout>;
};

export default SignUpPage;
