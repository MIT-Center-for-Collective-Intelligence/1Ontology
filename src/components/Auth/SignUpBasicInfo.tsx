/* # SignUpBasicInfo.tsx

## Overview

`SignUpBasicInfo.tsx` is a React component in the 1Ontology project, responsible for handling the user's basic information during the signup process. This component is built using Material-UI components and Formik for form management.

## Features

- **User Input Fields**: Collects user's first name, last name, email, username, and password.
- **Form Validation**: Uses Formik to handle form state and validation, ensuring user input is correct and prompt for errors.
- **Theme Switcher**: Allows users to toggle between light and dark themes.
- **Suspense for Lazy Loading**: React Suspense is used to handle the loading state for modal components, which are currently commented out.

## Component Structure

1. **Text Fields**: For capturing user details like first name, last name, email, username, and password.
2. **Theme Toggle**: A switch to toggle between light and dark themes.
3. **Form Validation**: Utilizes Formik for managing form state and validation.
4. **Lazy Loading Modals**: Placeholder for future modals like Cookie Policy, GDPR Policy, etc., using React Suspense.

## Usage

This component is to be used in the signup flow for new users. It collects essential information and offers an interactive, user-friendly experience for setting up an account.

## Code Explanation

- **Material-UI Components**: Utilizes various Material-UI components like `TextField`, `FormGroup`, `FormControlLabel`, `Switch`, `Backdrop`, and `CircularProgress`.
- **Formik Integration**: The component receives `formikProps` as props to manage form state and validation.
- **State Management for Modals**: Uses React state hooks to manage the visibility of various policy modals.
- **Theme Toggling**: Implements a switch to toggle the theme of the application, integrated with the application's context.

## Future Enhancements

- **Modals Integration**: Integration of modals such as Informed Consent, GDPR Policy, Privacy Policy, etc., for legal compliance and user information.
- **Refactor and Optimization**: Potential refactor for better performance and code readability.

## Contributing

Contributions to enhance or improve the `SignUpBasicInfo.tsx` component are welcome. Please adhere to the project's coding standards and contribute guidelines when submitting pull requests.

 */

import {
  Backdrop,
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Link,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { FormikProps } from "formik";
import React, { lazy, Suspense, useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { SignUpFormValues } from "@components/types/IAuth";
import { ToUpperCaseEveryWord } from "@components/lib/utils/utils";

// import { ToUpperCaseEveryWord } from "../lib/utils/utils";

// const CookiePolicy = lazy(() => import("./modals/CookiePolicy"));
// const GDPRPolicy = lazy(() => import("./modals/GDPRPolicy"));
// const PrivacyPolicy = lazy(() => import("./modals/PrivacyPolicy"));
// const TermsOfUse = lazy(() => import("./modals/TermsOfUse"));
// const InformedConsent = lazy(() => import("./modals/InformedConsent"));
export type SignUpBasicInformationProps = {
  formikProps: FormikProps<SignUpFormValues>;
};

export const SignUpBasicInfo = ({
  formikProps,
}: SignUpBasicInformationProps) => {
  const [, { dispatch }] = useAuth();
  const [openInformedConsent, setOpenInformedConsent] = useState(false);
  const [openGDPRPolicy, setOpenGDPRPolicy] = useState(false);
  const [openTermOfUse, setOpenTermsOfUse] = useState(false);
  const [openPrivacyPolicy, setOpenPrivacyPolicy] = useState(false);
  const [openCookiePolicy, setOpenCookiePolicy] = useState(false);
  const { values, errors, touched, handleChange, handleBlur, setFieldValue } =
    formikProps;

  const fieldSx = {
    "& .MuiFormHelperText-root": { color: "rgba(255, 160, 160, 0.95)" },
  } as const;

  const inputSx = {
    fontSize: "17px",
    borderRadius: "18px",
    color: "rgba(255,255,255,0.92)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))",
    "& .MuiOutlinedInput-notchedOutline": {
      borderRadius: "18px",
      borderColor: "rgba(255,255,255,0.18)",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255,255,255,0.28)",
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: "rgba(255, 140, 0, 0.65)",
      boxShadow: "0 0 0 4px rgba(255, 140, 0, 0.18)",
    },
  } as const;

  const getFieldError = (fieldName: keyof SignUpFormValues) =>
    touched[fieldName] && typeof errors[fieldName] === "string"
      ? errors[fieldName]
      : "";

  const errorBadgeSx = {
    position: "absolute",
    top: -8,
    right: 16,
    zIndex: 2,
    maxWidth: "68%",
    px: 1,
    py: "2px",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: "0.01em",
    color: "rgba(255, 210, 210, 0.98)",
    textShadow: "0 1px 1px rgba(0,0,0,0.55)",
    backgroundColor: "rgba(10, 10, 12, 0.75)",
    border: "1px solid rgba(255, 120, 120, 0.38)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: "0 8px 20px rgba(0,0,0,0.32)",
    pointerEvents: "none",
  } as const;

  const Field = ({
    name,
    label,
    type,
    autoComplete,
    mb,
  }: {
    name: keyof SignUpFormValues;
    label: string;
    type?: string;
    autoComplete?: string;
    mb?: number;
  }) => {
    const fieldError = getFieldError(name);
    const isErrored = Boolean(fieldError);

    return (
      <Box sx={{ position: "relative", mb: mb ?? 2.25 }}>
        <TextField
          id={String(name)}
          name={String(name)}
          label={label}
          type={type}
          value={values[name] as any}
          onChange={handleChange}
          onBlur={handleBlur}
          variant="outlined"
          error={isErrored}
          fullWidth
          autoComplete={autoComplete}
          sx={fieldSx}
          slotProps={{
            input: {
              sx: inputSx,
            },
          }}
        />
        <Box
          component="div"
          sx={{
            ...errorBadgeSx,
            visibility: isErrored ? "visible" : "hidden",
          }}
        >
          {fieldError || "placeholder"}
        </Box>
      </Box>
    );
  };

  return (
    <Box data-testid="signup-form-step-1">
      <Field name="firstName" label="First Name" autoComplete="given-name" />
      <Field name="lastName" label="Last Name" autoComplete="family-name" />
      <Field name="email" label="Email" type="email" autoComplete="email" />
      <Field name="username" label="Username" autoComplete="username" />
      <Field
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        mb={3}
      />
      <Field
        name="passwordConfirmation"
        label="Re-enter Password"
        type="password"
        autoComplete="new-password"
      />
      <Suspense
        fallback={
          <Backdrop
            sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={true}
          >
            <CircularProgress color="inherit" />
          </Backdrop>
        }
      >
        <>
          {/* <InformedConsent
            open={openInformedConsent}
            handleClose={() => setOpenInformedConsent(false)}
          />
          <GDPRPolicy
            open={openGDPRPolicy}
            handleClose={() => setOpenGDPRPolicy(false)}
          />
          <CookiePolicy
            open={openCookiePolicy}
            handleClose={() => setOpenCookiePolicy(false)}
          />
          <PrivacyPolicy
            open={openPrivacyPolicy}
            handleClose={() => setOpenPrivacyPolicy(false)}
          />
          <TermsOfUse
            open={openTermOfUse}
            handleClose={() => setOpenTermsOfUse(false)}
          /> */}
        </>
      </Suspense>
    </Box>
  );
};
