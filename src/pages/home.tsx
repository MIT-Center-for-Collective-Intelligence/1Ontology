import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@mui/material";

import { useAuth } from "@components/components/context/AuthContext";
import ROUTES from "@components/lib/utils/routes";

const Home = () => {
  const router = useRouter();
  const [{ isAuthenticated, isAuthInitialized }] = useAuth();
  const showSignIn = isAuthInitialized && !isAuthenticated;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        margin: 0,
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#0a0a0f",
        position: "relative",
      }}
    >
      {
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 10,
          }}
        >
          <Link
            href={{
              pathname: showSignIn ? ROUTES.signIn : ROUTES.home,
              query: {
                from: router.isReady ? router.asPath : "/home",
              },
            }}
            passHref
            legacyBehavior
          >
            <Button
              component="a"
              variant="contained"
              color="primary"
              sx={{
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              {showSignIn ? "Sign In/Sign up" : "Go to Platform"}
            </Button>
          </Link>
        </div>
      }
      <iframe
        title="Where Can AI Be Used? — Paper announcement"
        src="/html/OntologyPaper.html"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          backgroundColor: "#0a0a0f",
        }}
      />
    </div>
  );
};

export default Home;
