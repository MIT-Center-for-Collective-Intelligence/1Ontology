import { Box, Tooltip } from "@mui/material";
import Chip from "@mui/material/Chip";
import CancelIcon from "@mui/icons-material/Cancel";
import TextField from "@mui/material/TextField";
import { makeStyles } from "@mui/styles";
import Downshift from "downshift";
import PropTypes from "prop-types";
import React, { Fragment } from "react";

const useStyles: any = makeStyles(() => ({
  inputChip: {
    "& .MuiOutlinedInput-root": {
      display: "block",
    },
  },
  innerChip: {
    margin: "15px 10px 0px 0",
  },
}));

const ChipInput = ({
  ...props
}: {
  tags: any;
  selectedTags: any;
  updateTags: (newValue: string[], added: string[], removed: string[]) => void;
  placeholder: any;
  //
  readOnly?: any;
  itemId?: any;
  label?: any;
  added?: any;
  removed?: any;
  style?: any;
}) => {
  const classes = useStyles();
  const {
    tags,
    selectedTags,
    updateTags,
    placeholder,
    //
    readOnly,
    itemId,
    label,
    added = [],
    removed = [],
    style = {},
    ...other
  } = props;
  const [inputValue, setInputValue] = React.useState("");
  const handleKeyDown = (event: any) => {
    if (event.key === "Enter") {
      let newSelectedItem: any = [...tags];
      const duplicatedValues = newSelectedItem.indexOf(
        event.target.value.trim(),
      );

      if (duplicatedValues !== -1) {
        setInputValue("");
        return;
      }
      if (!event.target.value.replace(/\s/g, "").length) return;
      const altrs = event.target.value
        .split(",")
        .map((x: any) => x.trim())
        .filter((x: any) => x !== "");
      newSelectedItem = [...newSelectedItem, ...altrs];
      updateTags(newSelectedItem, altrs, []);
      selectedTags(newSelectedItem, itemId);
      setInputValue("");
    }
    if (tags.length && !inputValue.length && event.key === "Backspace") {
      updateTags(tags.slice(0, tags.length - 1), [], [tags[tags.length - 1]]);
      selectedTags(tags.slice(0, tags.length - 1), itemId);
    }
  };

  const handleChange = (item: any) => {
    let newSelectedItem: any = [...tags];
    if (newSelectedItem.indexOf(item) === -1) {
      newSelectedItem = [...newSelectedItem, item];
    }
    setInputValue("");
    updateTags(newSelectedItem, [item], []);
    selectedTags(newSelectedItem, itemId);
  };

  const handleDelete = (item: any) => () => {
    const newSelectedItem: any = [...tags];
    newSelectedItem.splice(newSelectedItem.indexOf(item), 1);
    updateTags(newSelectedItem, [], [item]);
    selectedTags(newSelectedItem, itemId);
  };

  const handleInputChange = (event: any) => {
    setInputValue(event.target.value);
  };

  return (
    <React.Fragment>
      <Downshift
        id="downshift-multiple"
        inputValue={inputValue}
        onChange={handleChange}
      >
        {({ getInputProps }) => {
          const { onBlur, onChange, ...inputProps }: any = getInputProps({
            onKeyDown: handleKeyDown,
            ...(placeholder ? { placeholder } : {}),
          });
          return (
            <div className="" style={{ ...style, border: "none" }}>
              {readOnly ? (
                <Box sx={{ ml: "10px", mb: "4px" }}>
                  {tags.map((item: any, idx: number) => {
                    const color = added.includes(item)
                      ? "#115f07"
                      : removed.includes(item)
                        ? "red"
                        : "";
                    return (
                      <Fragment key={idx}>
                        <Chip
                          sx={{
                            background: `${color}`,
                            fontSize: "20px",
                          }}
                          key={item}
                          tabIndex={-1}
                          label={item}
                          className={classes.innerChip}
                        />
                         
                      </Fragment>
                    );
                  })}
                </Box>
              ) : (
                <TextField
                  label={label || ""}
                  className={classes.inputChip}
                  InputProps={{
                    startAdornment: tags.map((item: any, idx: number) => {
                      const color = added.includes(item)
                        ? "#115f07"
                        : removed.includes(item)
                          ? "red"
                          : "";
                      return (
                        <Fragment key={idx}>
                          {readOnly ? (
                            <Chip
                              sx={{
                                background: `${color}`,
                                fontSize: "20px",
                              }}
                              key={item}
                              tabIndex={-1}
                              label={item}
                              className={classes.innerChip}
                            />
                          ) : (
                            <Chip
                              sx={{
                                background: `${color}`,
                                fontSize: "20px",
                              }}
                              key={item}
                              tabIndex={-1}
                              label={item}
                              disabled={readOnly}
                              className={classes.innerChip}
                              onDelete={handleDelete(item)}
                              deleteIcon={
                                <Tooltip title="Remove" placement="top">
                                  <CancelIcon />
                                </Tooltip>
                              }
                            />
                          )}
                        </Fragment>
                      );
                    }),
                    onBlur,
                    onChange: (event) => {
                      handleInputChange(event);
                      onChange(event);
                    },
                  }}
                  fullWidth
                  {...other}
                  {...inputProps}
                  disabled={props.readOnly}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": {
                        border: "none",
                      },
                    },
                  }}
                />
              )}
            </div>
          );
        }}
      </Downshift>
    </React.Fragment>
  );
};

export default React.memo(ChipInput);

ChipInput.defaultProps = {
  tags: [],
};
ChipInput.propTypes = {
  selectedTags: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(PropTypes.string),
};
