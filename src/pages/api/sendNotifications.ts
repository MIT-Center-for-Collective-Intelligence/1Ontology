import { admin, db } from "../../lib/firestoreServer/admin";
import { NextApiRequest, NextApiResponse } from "next/types";

import fbAuth from "../../middlewares/fbAuth"
const removeInvalidTokens = async (invalidTokens: {
  [key: string]: string[];
}) => {
  for (let uid in invalidTokens) {
    const fcmTokensDoc = await db.collection("fcmTokens").doc(uid).get();
    if (fcmTokensDoc.exists) {
      const tokens = fcmTokensDoc.data()?.tokens;
      const newTokens = tokens.filter(
        (token: string) => !invalidTokens[uid].includes(token)
      );
      await fcmTokensDoc.ref.update({
        tokens: newTokens,
      });
    }
  }
};
const replaceMentions = (text: string) => {
  let pattern = /\[@(.*?)\]\(\/mention\/.*?\)/g;
  return text.replace(pattern, (match, displayText) => `@${displayText}`);
};

const triggerNotifications = async (data: any) => {
  try {
    const { body, subject, members, sender } = data;
    const fcmTokensHash: { [key: string]: string } = {};
    const fcmTokensDocs = await db.collection("fcmTokens").get();

    for (let fcmToken of fcmTokensDocs.docs) {
      fcmTokensHash[fcmToken.id] = fcmToken.data().tokens;
    }

    const combineMembers = members.filter((m: any) => m.id !== sender);
    const _member = new Set();
    const invalidTokens: any = {};
    for (let member of combineMembers) {
      if (_member.has(member.id)) continue;
      const userDoc = await db
        .collection("users")
        .where("uname", "==", member.id)
        .get();
      if (!userDoc.docs.length) continue;
      const UID = userDoc.docs[0].data().userId;

      try {
        const tokens = fcmTokensHash[UID] || [];
        for (let token of tokens) {
          const payload = {
            token,
            notification: {
              title: subject,
              body: replaceMentions(body),
            },
            data: {
              notificationType: "message",
            },
          };
          console.log(admin.messaging());
          console.log(payload);
          admin
            .messaging()
            .send(payload)
            .then((response: any) => {
              console.log("Successfully sent message: ", response);
            })
            .catch((error: any) => {
              if (
                error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered"
              ) {
                console.log(`Token ${token} is invalid. Removing token...`);

                invalidTokens[UID] = [...(invalidTokens[UID] || []), token];
              }
            });
        }
      } catch (error) {
        console.log(error, "error");
      }
      _member.add(member.id);
    }
    await removeInvalidTokens(invalidTokens);

    console.log("documents created");
  } catch (error) {
    console.log(error);
  }
};

async function handler(req: NextApiRequest, res: NextApiResponse<any>) {
  try {
    const { uname } = req.body?.data?.user?.userData;
    const { body, subject, members, sender } = req.body as any;
    if (uname !== sender) {
      throw new Error("");
    }
    await triggerNotifications({
      body,
      subject,
      members,
      sender,
    });
    return res.status(200).send({});
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      error: true,
    });
  }
}
export default fbAuth(handler);
