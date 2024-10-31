import { Timestamp } from "firebase/firestore";

export type Reaction = {
  user: string;
  emoji: string;
};

export type senderDetail = {
  uname: string;
  imageUrl: string;
  chooseUname: boolean;
  fullname?: string;
  role?: string;
};

export type IChatMessage = {
  doc?: any;
  heading?: string;
  id: string;
  parentMessage: string;
  text: string;
  imageUrls?: string[];
  videoUrls?: string[];
  sender: string;
  senderDetail: senderDetail;
  read_by?: string[];
  reactions: Reaction[];
  mentions?: string[];
  pinned?: boolean;
  edited?: boolean;
  editedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  deleted: boolean;
  totalReplies?: number;
  messageType?: string;
  sharedNodeId?: string;
  subscribed?: string[];
};

export type INotification = {
  id: string;
  title: string;
  body: string;
  user: string;
  sender: string;
  senderDetail: senderDetail;
  createdAt: Timestamp;
  type: string;
  notificationType: string;
  entityId: string;
  nodeId?: string;
  seen: boolean;
};
