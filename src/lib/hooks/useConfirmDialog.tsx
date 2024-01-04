/* 
This code is a custom React hook that provides a reusable dialog box functionality using Material UI. The dialog box can be used as a simple confirmation dialog or as a prompt dialog that accepts user input.

Here's a breakdown of the code:

1. `useDialog`: This is the main hook function. It maintains several pieces of state:
   - `isOpen`: A boolean indicating whether the dialog box is open or not.
   - `dialogMessage`: The message to be displayed in the dialog box.
   - `isPrompt`: A boolean indicating whether the dialog box should act as a prompt (accept user input) or not.
   - `inputValue`: The value of the input field when the dialog box is used as a prompt.
   - `resolveRef`: A reference to a Promise resolve function. This is used to return the result of the dialog box (either the user's input or their confirmation).
   - `confirmation` and `cancel`: The text for the confirmation and cancel buttons.

2. `showDialog`: This function opens the dialog box. It accepts a message, a boolean indicating whether the dialog should act as a prompt, and the text for the confirmation and cancel buttons. It returns a new Promise that will be resolved when the dialog box is closed.

3. `closeDialog`: This function closes the dialog box. It accepts a boolean indicating whether the user confirmed or cancelled the dialog. If the dialog was used as a prompt, it resolves the Promise with the user's input. Otherwise, it resolves the Promise with the confirmation boolean.

4. `handleInputChange`: This function updates the `inputValue` state when the user types into the input field.

5. `ConfirmDialog`: This is the actual dialog box component. It uses the state and functions defined above to display the dialog box and handle user interactions.

6. `promptIt` and `confirmIt`: These are convenience functions that call `showDialog` with the appropriate arguments to display a prompt or confirmation dialog.

The hook returns an object with the `promptIt`, `confirmIt`, and `ConfirmDialog` properties, which can be used by components to display and interact with the dialog box.
 */

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, TextField } from "@mui/material";
import React, { useCallback, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "../theme/colors";



const useDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [isPrompt, setIsPrompt] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const resolveRef = React.useRef<any>(null);
  const [confirmation, setConfirmation] = useState("");
  const [cancel, setCancel] = useState("");

  const showDialog = useCallback((message: string, prompt = false, confirmation: string, cancel: string) => {
    setDialogMessage(message);
    setIsOpen(true);
    setIsPrompt(prompt);
    setConfirmation(confirmation);
    setCancel(cancel);

    return new Promise(resolve => {
      resolveRef.current = resolve;
    });
  }, []);

  const closeDialog = useCallback(
    (confirmed: any) => {
      setIsOpen(false);
      setDialogMessage("");
      setInputValue("");

      if (resolveRef.current) {
        resolveRef.current(isPrompt ? inputValue : confirmed);
      }
    },
    [isPrompt, inputValue]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const ConfirmDialog = (
    <Dialog open={isOpen} onClose={() => closeDialog(false)}>
      <DialogContent>
        <DialogContentText>{dialogMessage}</DialogContentText>
        {isPrompt && (
          <TextField
            autoFocus
            margin="dense"
            id="prompt-input"
            type="text"
            value={inputValue}
            placeholder="Full name"
            onChange={handleInputChange}
            fullWidth
            sx={{
              mt: 3,
              mx: "auto",
              display: "block",
              textAlign: "center",
              width: "60%",
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", mb: "5px" }}>
        <Button
          onClick={() => closeDialog(true)}
          variant="contained"
          sx={{ borderRadius: "26px", backgroundColor: DESIGN_SYSTEM_COLORS.primary800 }}
        >
          {confirmation}
        </Button>
        {!isPrompt && cancel && (
          <Button onClick={() => closeDialog(false)} color="primary" variant="outlined" sx={{ borderRadius: "26px" }}>
            {cancel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  const promptIt = useCallback(
    (message: string, confirmation: string, cancel: string) => showDialog(message, true, confirmation, cancel),
    [showDialog]
  );
  const confirmIt = useCallback(
    (message: any, confirmation: string, cancel: string) => showDialog(message, false, confirmation, cancel),
    [showDialog]
  );

  return { promptIt, confirmIt, ConfirmDialog };
};

export default useDialog;
