import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  Checkbox,
  Box,
} from "@mui/material";
import React, { useCallback, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "../theme/colors";

const useSelectDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [options, setOptions] = useState<{ id: string; title: string }[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const resolveRef = React.useRef<any>(null);
  const [confirmation, setConfirmation] = useState("");
  const [cancel, setCancel] = useState("");

  const showDialog = useCallback(
    (
      message: string,
      options: { id: string; title: string }[],
      confirmation: string,
      cancel: string
    ) => {
      setDialogMessage(message);
      setOptions(options);
      setIsOpen(true);
      setConfirmation(confirmation);
      setCancel(cancel);

      return new Promise((resolve) => {
        resolveRef.current = resolve;
      });
    },
    []
  );

  const closeDialog = useCallback(
    (confirmed: boolean) => {
      setIsOpen(false);
      setDialogMessage("");
      setSelectedItems([]);

      if (resolveRef.current) {
        resolveRef.current(
          confirmed ? options.filter((o) => selectedItems.includes(o.id)) : []
        );
      }
    },
    [selectedItems, options]
  );

  const handleCheckboxChange = (option: string) => {
    setSelectedItems((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const selectDialog = (
    <Dialog
      open={isOpen}
      onClose={(event, reason) => {
        // Prevent closing the dialog when clicking outside or pressing ESC
        if (reason === "backdropClick" || reason === "escapeKeyDown") {
          return;
        }
        closeDialog(false);
      }}
    >
      <DialogContent sx={{ width: "100%" }}>
        <DialogContentText>{dialogMessage}</DialogContentText>
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {options.map((option) => (
            <FormControlLabel
              key={option.id}
              control={
                <Checkbox
                  checked={selectedItems.includes(option.id)}
                  onChange={() => handleCheckboxChange(option.id)}
                />
              }
              label={option.title}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", mb: "5px" }}>
        <Button
          onClick={() => closeDialog(true)}
          variant="contained"
          sx={{
            borderRadius: "26px",
            backgroundColor: DESIGN_SYSTEM_COLORS.primary800,
          }}
        >
          {confirmation}
        </Button>
        {cancel && (
          <Button
            onClick={() => closeDialog(false)}
            color="primary"
            variant="outlined"
            sx={{ borderRadius: "26px" }}
          >
            {cancel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  const selectIt = useCallback(
    (
      message: any,
      options: { id: string; title: string }[],
      confirmation: string,
      cancel: string
    ) => showDialog(message, options, confirmation, cancel),
    [showDialog]
  );

  return { selectIt, selectDialog };
};

export default useSelectDialog;
