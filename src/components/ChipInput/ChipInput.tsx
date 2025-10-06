import { Box, Tooltip } from "@mui/material";
import Chip from "@mui/material/Chip";
import CancelIcon from "@mui/icons-material/Cancel";
import TextField from "@mui/material/TextField";
import { makeStyles } from "@mui/styles";
import Downshift from "downshift";
import PropTypes from "prop-types";
import React, { Fragment } from "react";
import { performerColors } from "@components/lib/CONSTANTS";

const useStyles: any = makeStyles(() => ({
  inputChip: {
    "& .MuiOutlinedInput-root": {
      display: "block",
    },
  },
  innerChip: {
    margin: "0px 10px 0px 0",
  },
}));

type TagType = {
  title: string;
  added?: boolean;
  removed?: boolean;
};
const ChipInput = ({
  ...props
}: {
  tags: TagType[];
  selectedTags: any;
  updateTags: (
    newValue: TagType[],
    added: TagType[],
    removed: TagType[],
  ) => void;
  placeholder: any;
  clickable?: boolean;
  fontSize?: string;
  //
  readOnly?: any;
  itemId?: any;
  label?: any;
  style?: any;
}) => {
  const classes = useStyles();
  const {
    tags,
    selectedTags,
    updateTags,
    placeholder,
    clickable,
    //
    readOnly,
    itemId,
    label,
    style = {},
    fontSize,
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
  const handleClick = (item: string) => {
    const domainMatch = item.match(/Domain:(.*?) Title:/);
    const titleMatch = item.match(/Title:(.*)/);
    if (domainMatch && titleMatch) {
      const domain = domainMatch[1].trim();
      const title = titleMatch[1].trim();
      const query = encodeURIComponent(`site: ${domain} ${title}`);
      window.open(`https://www.google.com/search?q=${query}`, "_blank");
    }
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
                <Box sx={{ ml: "10px", mb: "4px", mt: "14px" }}>
                  {tags.map((item: any, idx: number) => {
                    const displayText = item.domain
                      ? `Domain: ${item.domain} Title: ${item.title}`
                      : item.title;

                    const backgroundColor =
                      performerColors[item.supports] || "grey";
                    const color = item.added
                      ? "#459a3a"
                      : item.removed
                        ? "red"
                        : "";
                    return (
                      <Fragment key={idx}>
                        <Chip
                          sx={{
                            background: color || backgroundColor,
                            fontSize: fontSize || "20px",
                            cursor: clickable ? "pointer" : "default",
                            ":hover": clickable
                              ? { backgroundColor: "orange" }
                              : {},
                            my: "3px",
                            mx: "3px",
                          }}
                          label={displayText}
                          className={classes.innerChip}
                          onClick={
                            clickable
                              ? () => {
                                  handleClick(displayText);
                                }
                              : undefined
                          }
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
                    startAdornment: tags.map((item: TagType, idx: number) => {
                      const color = item.added
                        ? "#115f07"
                        : item.removed
                          ? "red"
                          : "";
                      return (
                        <Fragment key={idx}>
                          {readOnly ? (
                            <Chip
                              sx={{
                                fontSize: fontSize || "20px",
                                my: "3px",
                                mx: "3px",
                              }}
                              key={item.title}
                              tabIndex={-1}
                              label={item.title}
                              className={classes.innerChip}
                              clickable={clickable}
                            />
                          ) : (
                            <Chip
                              sx={{
                                background: `${color}`,
                                fontSize: fontSize || "20px",
                                my: "3px",
                                mx: "3px",
                              }}
                              key={item.title}
                              tabIndex={-1}
                              label={item.title}
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
                    pt: "15px",
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
