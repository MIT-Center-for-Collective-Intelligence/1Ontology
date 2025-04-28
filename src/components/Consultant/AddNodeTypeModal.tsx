import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from "@mui/material";
import { ChromePicker } from "react-color";

const AddNodeTypeModal = ({
  open,
  onClose,
  onSave,
  editNodeType,
}: {
  open: any;
  onClose: any;
  onSave: any;
  editNodeType: any;
}) => {
  const [typeName, setTypeName] = useState("");
  const [color, setColor] = useState("#1976d2");

  useEffect(() => {
    setTypeName(editNodeType?.type);
    setColor(editNodeType?.color);
  }, [editNodeType]);

  const handleSave = async () => {
    await onSave(typeName, color, editNodeType);
    setTypeName("");
    setColor("#1976d2");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderRadius: "20px",
        },
      }}
      TransitionProps={{
        timeout: 200,
      }}
    >
      <DialogTitle sx={{}}>
        {editNodeType ? "Edit legend item:" : "Add new legend item:"}
      </DialogTitle>
      <DialogContent sx={{ width: "400px", alignItems: "center" }}>
        <TextField
          fullWidth
          label="Label"
          value={typeName}
          onChange={(e) => setTypeName(e.target.value)}
          margin="normal"
        />
        <ChromePicker
          color={color}
          onChangeComplete={(newColor: any) => setColor(newColor.hex)}
          styles={{
            default: {
              picker: {
                width: "250px",
                borderRadius: "15px",
              },
            },
          }}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{ borderRadius: "25px", textTransform: "none" }}
          color="error"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          color="success"
          disabled={!typeName}
          variant="contained"
          sx={{ borderRadius: "25px", color: "white", textTransform: "none" }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddNodeTypeModal;
