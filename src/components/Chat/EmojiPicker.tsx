
import React from "react";
import EmojiPicker from "emoji-picker-react";

const EmojiPickerComponent = ({ ...rest }) => {
  return <EmojiPicker {...rest}/>;
};

export default React.memo(EmojiPickerComponent);
