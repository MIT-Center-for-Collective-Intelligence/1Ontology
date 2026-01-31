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

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  TextField,
  Typography,
} from "@mui/material";
import React, { useCallback, useRef, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "../theme/colors";

const useDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState<string | React.ReactNode>(
    "",
  );
  const [isPrompt, setIsPrompt] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const resolveRef = useRef<any>(null);
  const [confirmation, setConfirmation] = useState("");
  const [cancel, setCancel] = useState("");

  const showDialog = useCallback(
    (
      message: string | React.ReactNode,
      prompt = false,
      confirmation = "Ok",
      cancel = "",
    ) => {
      setDialogMessage(message);
      setIsPrompt(prompt);
      setConfirmation(confirmation);
      setCancel(cancel);
      setIsOpen(true);

      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    [],
  );

  const closeDialog = useCallback(
    (confirmed: boolean) => {
      setIsOpen(false);

      if (resolveRef.current) {
        resolveRef.current(isPrompt ? inputValue : confirmed);
      }

      setDialogMessage("");
      setInputValue("");
    },
    [inputValue, isPrompt],
  );

  const ConfirmDialog = (
    <Dialog
      open={isOpen}
      onClose={() => closeDialog(false)}
      slotProps={{
        paper: {
          sx: {
            borderRadius: 4,
            px: 1,
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            minWidth: 420,
            border: "1px solid gold",
          },
        },
      }}
    >
      <DialogContent sx={{ textAlign: "center", pt: 4 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            mb: 1,
          }}
        >
          {dialogMessage}
        </Typography>

        {isPrompt && (
          <TextField
            autoFocus
            fullWidth
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Full name"
            sx={{
              mt: 3,
              maxWidth: 320,
              mx: "auto",
              "& .MuiOutlinedInput-root": {
                borderRadius: "14px",
              },
            }}
          />
        )}
      </DialogContent>

      <DialogActions
        sx={{
          justifyContent: "center",
          gap: 1.5,
          pb: 3,
        }}
      >
        {cancel && !isPrompt && (
          <Button
            onClick={() => closeDialog(false)}
            variant="text"
            sx={{
              color: "text.secondary",
              px: 3,
              border: "1.4px dashed #ccc",
              borderRadius: "25px",
            }}
          >
            {cancel}
          </Button>
        )}

        <Button
          onClick={() => closeDialog(true)}
          variant="contained"
          sx={{
            px: 4,
            py: 1,
            borderRadius: "999px",
            textTransform: "none",
            fontWeight: 600,
            backgroundColor: DESIGN_SYSTEM_COLORS.primary800,
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
            "&:hover": {
              backgroundColor: DESIGN_SYSTEM_COLORS.primary700,
            },
          }}
        >
          {confirmation}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const promptIt = useCallback(
    (message: string, confirmation = "Confirm", cancel = "Cancel") =>
      showDialog(message, true, confirmation, cancel),
    [showDialog],
  );

  const confirmIt = useCallback(
    (message: string | React.ReactNode, confirmation = "Yes", cancel = "No") =>
      showDialog(message, false, confirmation, cancel),
    [showDialog],
  );

  return { promptIt, confirmIt, ConfirmDialog };
};

export default useDialog;
