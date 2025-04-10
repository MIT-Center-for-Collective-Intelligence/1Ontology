import { TextField } from "@mui/material";
import React, { useEffect, useState } from "react";

const GuideLineText = ({
  guideline,
  index,
  onSaveGuideline,
  catId,
}: {
  guideline: string;
  index: number;
  onSaveGuideline: (text: string, catId: string, index: number) => void;
  catId: string;
}) => {
  const [text, setText] = useState<string>(guideline);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const onBlur = () => {
    onSaveGuideline(text, catId, index);
  };
  const handleSave = () => {
    onSaveGuideline(text, catId, index);
  };

  useEffect(() => {
    window.addEventListener("beforeunload", handleSave);
    return () => {
      window.removeEventListener("beforeunload", handleSave);
    };
  }, [text, catId, index]);

  return (
    <TextField
      fullWidth
      label={`Guideline ${index + 1}`}
      value={text}
      variant="outlined"
      margin="normal"
      InputLabelProps={{
        style: { color: "grey" },
      }}
      multiline
      onChange={onChange}
      onBlur={onBlur}
    />
  );
};

export default GuideLineText;
