import Cors from "cors";
import { getAuth } from "firebase-admin/auth";
import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { admin, db } from "../lib/firestoreServer/admin";
import { runMiddleware } from "./cors";

const retrieveAuthenticatedUser = async ({ uname, uid }: { uname: string | null; uid: string }) => {
  try {
    let userData: any = {};
    let query: any;
    let errorMessage = "";

    const auth = getAuth();
    const user = await auth.getUser(uid);

    if (uname) {
      query = db.doc(`/users/${uname}`);
    } else if (uid) {
      query = db.collection("users").where("userId", "==", uid).limit(1);
    }
    const userDoc = await query.get();
    if ((uname && userDoc.exists) || (uid && userDoc.docs.length !== 0)) {
      if (uname) {
        userData = userDoc.data();
      } else if (uid) {
        userData = userDoc.docs[0].data();
      }
      userData = {
        uid,
        fName: userData.fName,
        lName: userData.lName,
        imageUrl: userData.imageUrl,
        uname: userData.uname,
        customClaims: user.customClaims,
      };
    } else {
      errorMessage = "The user does not exist!";
      console.error(errorMessage);
      return { status: 500, data: errorMessage };
    }

    return { status: 200, data: userData };
  } catch (err: any) {
    console.error(err);
    return { status: 500, data: err.code };
  }
};

export type CustomNextApiRequest = NextApiRequest & {
  user: any;
};
const cors = Cors({
  origin: "*", // Change this to your specific origin or origins
  methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Specify allowed headers
  optionsSuccessStatus: 200, // Return status code 200 for preflight requests
});
const fbAuth = (handler: NextApiHandler) => {
  return async (req: CustomNextApiRequest, res: NextApiResponse) => {
    try {
      await runMiddleware(req, res, cors);
      let token = (req.headers.authorization || req.headers.Authorization || "") as string;
      token = token.replace("Bearer ", "");
      const decodedToken = await admin.auth().verifyIdToken(token);
      if (!decodedToken) return res.status(401).send({ error: "UnAuthorized" });

      const user = decodedToken;
      const { status, data } = await retrieveAuthenticatedUser({ uname: null, uid: user.uid });
      if (status !== 200) return res.status(status).send({ error: data });

      if (!req.body) req.body = {};
      if (!req.body.data) req.body.data = { ...req.body };

      req.body.data.user = user;
      req.body.data.user.userData = data;
      req.user = user;
      await handler(req, res);
    } catch (error) {
      return res.status(500).json({ error });
    }
  };
};

export default fbAuth;
