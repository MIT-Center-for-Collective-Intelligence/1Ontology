import { useAuth } from " @components/components/context/AuthContext";
import AuthLayout from " @components/components/layouts/AuthLayout";
import { resetPassword } from " @components/lib/firestoreClient/auth";
import { getFirebaseFriendlyError } from " @components/lib/utils/firebaseErrors";
import ROUTES from " @components/lib/utils/routes";
import { NextPageWithLayout } from " @components/types/IAuth";
import { LoadingButton } from "@mui/lab";
import { Box, Button, TextField, Typography } from "@mui/material";
import { FirebaseError } from "firebase/app";
import { useFormik } from "formik";
import NextLink from "next/link";
import { useSnackbar } from "notistack";
import React, { ReactNode, useState } from "react";

import * as yup from "yup";

interface ForgotPasswordFormValues {
  email: string;
}

const ForgotPage: NextPageWithLayout = () => {
  const [, { handleError }] = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);

  const initialValues: ForgotPasswordFormValues = {
    email: "",
  };

  const validationSchema = yup.object({
    email: yup
      .string()
      .email("Invalid email address!")
      .required(
        "Your email address provided by your academic/research institutions is required!"
      ),
  });
  const handleSignIn = async ({ email }: ForgotPasswordFormValues) => {
    try {
      setIsLoading(true);
      await resetPassword(email);
      enqueueSnackbar(
        "We have sent an email for reset the password to your email address.",
        {
          variant: "success",
          autoHideDuration: 10000,
        }
      );
      setIsLoading(false);
    } catch (error) {
      const errorMessage = getFirebaseFriendlyError(error as FirebaseError);
      setIsLoading(false);
      handleError({ error, errorMessage });
    }
  };

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: handleSignIn,
  });

  return (
    <Box sx={{ p: { xs: "8px", md: "24px", width: "100%" }, my: "92px" }}>
      <Typography variant="h1" sx={{ mb: "8px" }}>
        Reset Password
      </Typography>
      <Typography variant="body1" sx={{ mb: "32px" }}>
        You can reset password here!
      </Typography>
      <form data-testid="signin-form" onSubmit={formik.handleSubmit}>
        <TextField
          id="email"
          name="email"
          label="Email"
          type="email"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          variant="outlined"
          error={Boolean(formik.errors.email) && Boolean(formik.touched.email)}
          helperText={formik.errors.email}
          fullWidth
          sx={{ mb: "24px" }}
        />
        <Box
          sx={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mt: "10px",
          }}
        >
          <LoadingButton
            aria-label="submit"
            loading={isLoading}
            disabled={formik.isSubmitting}
            type="submit"
            variant="contained"
            fullWidth
            sx={{ borderRadius: "26px", width: "150px" }}
          >
            Send Email
          </LoadingButton>
          <NextLink href={ROUTES.signIn} passHref>
            <Button sx={{ my: "20px" }}>Sign In</Button>
          </NextLink>
        </Box>
      </form>
    </Box>
  );
};

ForgotPage.getLayout = (page: ReactNode) => {
  return <AuthLayout>{page}</AuthLayout>;
};

export default ForgotPage;
