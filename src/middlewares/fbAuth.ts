import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";
import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import { admin, db } from "../lib/firestoreServer/admin";

export interface IRequestLog {
  uname: string;
  uri: string;
  method: string;
  body?: any;
  createdAt: Timestamp;
}

const retrieveAuthenticatedUser = async ({
  uname,
  uid,
}: {
  uname: string | null;
  uid: string;
}) => {
  try {
    let userData: any = {};
    let query: any;
    let errorMessage = "";

    const auth = getAuth();
    await auth.getUser(uid);

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

const fbAuth = (handler: NextApiHandler) => {
  return async (req: CustomNextApiRequest, res: NextApiResponse) => {
    try {
      let token = (req.headers.authorization ||
        req.headers.Authorization ||
        "") as string;
      token = token.replace("Bearer ", "");
      const decodedToken = await admin.auth().verifyIdToken(token);
      if (!decodedToken) return res.status(401).send({ error: "UnAuthorized" });

      const user = decodedToken;

      const { status, data } = await retrieveAuthenticatedUser({
        uname: null,
        uid: user.uid,
      });
      if (status !== 200) return res.status(status).send({ error: data });
      //authenticated

      if (req.method === "POST") {
        const requestLog = db.collection("requestLogs").doc();
        await requestLog.set({
          method: req.method,
          uname: data.uname as string,
          uri: req.url,
          body: req.body,
          createdAt: Timestamp.now(),
        } as IRequestLog);
      }

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
