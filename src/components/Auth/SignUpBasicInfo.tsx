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
import { SignUpFormValues } from " @components/types/IAuth";
import { ToUpperCaseEveryWord } from " @components/lib/utils/utils";

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

  return (
    <Box data-testid="signup-form-step-1">
      <TextField
        id="firstName"
        name="firstName"
        label="First Name"
        value={values.firstName}
        onChange={handleChange}
        onBlur={handleBlur}
        variant="outlined"
        error={Boolean(errors.firstName) && Boolean(touched.firstName)}
        helperText={touched.firstName && errors.firstName}
        fullWidth
        sx={{ mb: "16px" }}
      />
      <TextField
        id="lastName"
        name="lastName"
        label="Last Name"
        value={values.lastName}
        onChange={handleChange}
        onBlur={handleBlur}
        variant="outlined"
        error={Boolean(errors.lastName) && Boolean(touched.lastName)}
        helperText={touched.lastName && errors.lastName}
        fullWidth
        sx={{ mb: "16px" }}
      />
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        value={values.email}
        onChange={handleChange}
        onBlur={handleBlur}
        variant="outlined"
        error={Boolean(errors.email) && Boolean(touched.email)}
        helperText={touched.email && errors.email}
        fullWidth
        sx={{ mb: "16px" }}
      />
      <TextField
        id="username"
        name="username"
        label="Username"
        value={values.username}
        onChange={handleChange}
        onBlur={handleBlur}
        variant="outlined"
        error={Boolean(errors.username) && Boolean(touched.username)}
        helperText={touched.username && errors.username}
        fullWidth
        sx={{ mb: "16px" }}
      />
      <TextField
        id="password"
        name="password"
        label="Password"
        type="password"
        value={values.password}
        onChange={handleChange}
        onBlur={handleBlur}
        variant="outlined"
        error={Boolean(errors.password) && Boolean(touched.password)}
        helperText={touched.password && errors.password}
        fullWidth
        sx={{ mb: "16px" }}
      />
      <TextField
        id="passwordConfirmation"
        name="passwordConfirmation"
        label="Re-enter Password"
        type="password"
        value={values.passwordConfirmation}
        onChange={handleChange}
        onBlur={handleBlur}
        variant="outlined"
        error={
          Boolean(errors.passwordConfirmation) &&
          Boolean(touched.passwordConfirmation)
        }
        helperText={touched.passwordConfirmation && errors.passwordConfirmation}
        fullWidth
        sx={{ mb: "16px" }}
      />

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={values.theme === "Dark"}
              onChange={() => {
                setFieldValue(
                  "theme",
                  values.theme === "Light" ? "Dark" : "Light"
                );
                dispatch({
                  type: "setTheme",
                  payload: values.theme === "Light" ? "Dark" : "Light",
                });
                // themeActions.setThemeMode(values.theme === "Light" ? "dark" : "light");
              }}
            />
          }
          label={`Theme: ${values.theme === "Dark" ? "🌜" : "🌞"}`}
        />
      </FormGroup>

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
