import React, { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

const TextFieldCollab = () => {
  const [text, setText] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebrtcProvider("text-field-room", ydoc);

    const yText = ydoc.getText("textarea");
    console.log({ text: yText.toString() }, "yText.toString()");
    setText(yText.toString());

    yText.observe((event) => {
      console.log(event, "event");
      setText(yText.toString());
    });

    const handleInput = (event: any): any => {
      const value = event.target.value;
      console.log(value);
      yText.delete(0, yText.length);
      yText.insert(0, value);
    };

    if (textAreaRef.current) {
      textAreaRef.current.addEventListener("input", handleInput);
    }

    return () => {
      if (textAreaRef.current) {
        textAreaRef.current.removeEventListener("input", handleInput);
      }
      provider.destroy();
    };
  }, []);

  return (
    <textarea
      ref={textAreaRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      style={{ width: "100%", height: "200px" }}
    />
  );
};

export default TextFieldCollab;
