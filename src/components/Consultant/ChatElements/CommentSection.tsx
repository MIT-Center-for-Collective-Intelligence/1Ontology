import React from "react";

/* import {
  ThumbUpIcon,
  HeartIcon,
  WowIcon,
  LaughIcon,
} from "@heroicons/react/24/solid"; */ // Example icon library - install if needed

interface CommentProps {
  name: string;
  avatarSrc: string;
  text: string;
  timestamp: string;
  likes?: number;
  hearts?: number;
  wows?: number;
  laughs?: number;
  replies?: CommentProps[];
}

const Comment: React.FC<CommentProps> = ({
  name,
  avatarSrc,
  text,
  timestamp,
  likes,
  hearts,
  wows,
  laughs,
  replies,
}) => {
  return (
    <div className="flex space-x-2 py-2">
      <div className="relative h-8 w-8 rounded-full overflow-hidden">
        <img src={avatarSrc} alt={name} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-sm text-gray-800">{text}</p>
        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-600">
          <span>{timestamp}</span>
          <button className="hover:underline">Like</button>
          <button className="hover:underline">Reply</button>
          {(likes || hearts || wows || laughs) && (
            <div className="ml-auto flex items-center space-x-1">
              {likes && likes > 0 && (
                <div className="flex items-center">
                  {/*  <ThumbUpIcon className="h-4 w-4 text-blue-500" /> */}
                  <span>{likes}</span>
                </div>
              )}
              {hearts && hearts > 0 && (
                <div className="flex items-center">
                  {/* <HeartIcon className="h-4 w-4 text-red-500" /> */}
                  <span>{hearts}</span>
                </div>
              )}
              {wows && wows > 0 && (
                <div className="flex items-center">
                  {/*   <WowIcon className="h-4 w-4 text-yellow-500" /> */}
                  <span>{wows}</span>
                </div>
              )}
              {laughs && laughs > 0 && (
                <div className="flex items-center">
                  {/*   <LaughIcon className="h-4 w-4 text-yellow-500" /> */}
                  <span>{laughs}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {replies && replies.length > 0 && (
          <div className="ml-6 mt-2">
            {replies.map((reply, index) => (
              <Comment key={index} {...reply} />
            ))}
            {replies.length > 2 && (
              <button className="text-xs text-gray-600 hover:underline mt-1">
                View all {replies.length} replies
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface CommentSectionProps {
  comments: CommentProps[];
}

const CommentSection: React.FC<CommentSectionProps> = ({ comments }) => {
  return (
    <div>
      {comments.map((comment, index) => (
        <Comment key={index} {...comment} />
      ))}
    </div>
  );
};

// Example usage:
const ExampleCommentSection: React.FC = () => {
  const commentsData: CommentProps[] = [
    {
      name: "Leeanne Gilbert",
      avatarSrc: "https://via.placeholder.com/50/f0f0f0/808080?Text=LG",
      text: "Wow....I honestly forgot what that actually feels like....to be looked at as if Ur the only person in the world",
      timestamp: "2d",
      likes: 4,
      hearts: 1,
      laughs: 1,
    },
    {
      name: "Lord Reign",
      avatarSrc: "https://via.placeholder.com/50/e0e0e0/606060?Text=LR",
      text: "Leeanne Gilbert I wanna be looking at you that way all day ❤️😍🥰",
      timestamp: "2d",
      hearts: 3,
    },
    {
      name: "Botany Winelands",
      avatarSrc: "https://via.placeholder.com/50/d0d0d0/404040?Text=BW",
      text: "Leeanne Gilbert so stop cheating and entertaining multiple men. Why do you women find that so hard???",
      timestamp: "1d",
      likes: 1,
    },
    {
      name: "Another User",
      avatarSrc: "https://via.placeholder.com/50/c0c0c0/202020?Text=AU",
      text: "Just another comment.",
      timestamp: "1d",
      replies: [
        {
          name: "Reply User 1",
          avatarSrc: "https://via.placeholder.com/50/a0a0a0/000000?Text=R1",
          text: "This is a reply.",
          timestamp: "10h",
        },
        {
          name: "Reply User 2",
          avatarSrc: "https://via.placeholder.com/50/b0b0b0/111111?Text=R2",
          text: "Another reply here.",
          timestamp: "5h",
        },
        {
          name: "Reply User 3",
          avatarSrc: "https://via.placeholder.com/50/909090/222222?Text=R3",
          text: "And yet another one.",
          timestamp: "2h",
        },
      ],
    },
  ];

  return <CommentSection comments={commentsData} />;
};

export default ExampleCommentSection;
