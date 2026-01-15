import React, { useState, useRef, useEffect } from "react";
import { Box, Link, Tooltip, Typography } from "@mui/material";
import { INode, ILinkNode } from "@components/types/INode";

interface LinkNodeTitleProps {
  title: string;
  link: ILinkNode;
  partsInheritance: any;
  relatedNodes: { [key: string]: INode };
  property: string;
  selectedProperty: string;
  onNavigate: (e: any) => void;
  linkColor: string;
}

const LinkNodeTitle = ({
  title,
  link,
  partsInheritance,
  relatedNodes,
  property,
  selectedProperty,
  onNavigate,
  linkColor,
}: LinkNodeTitleProps) => {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (linkRef.current) {
      const el = linkRef.current;
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, [title]);

  const linkContent = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <Link
        ref={linkRef}
        underline="hover"
        onClick={onNavigate}
        sx={{
          cursor: "pointer",
          color: linkColor,
          textDecoration: link.change === "removed" ? "line-through" : "none",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "inherit",
          display: "block",
        }}
      >
        {title}{" "}
        {link.optional && selectedProperty !== property && (
          <span style={{ color: "orange", marginLeft: "2px" }}>{`(O)`}</span>
        )}
      </Link>
    </Box>
  );

  if (!isTruncated) return linkContent;

  return (
    <Tooltip
      title={
        <Box sx={{ p: "5px" }}>
          <Typography>{title}</Typography>
          {partsInheritance[link.id] ? (
            <>
              <span
                style={{
                  display: "flex",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                {partsInheritance[link.id][0].genId &&
                  relatedNodes[partsInheritance[link.id][0].genId] && (
                    <>
                      Inherited from{" "}
                      <strong style={{ fontSize: "12px" }}>
                        {'"'}
                        {relatedNodes[partsInheritance[link.id][0].genId].title}
                        {'"'},
                      </strong>
                    </>
                  )}
                {partsInheritance[link.id][0]?.partOf && (
                  <>
                    Part{" "}
                    <strong style={{ fontSize: "12px", color: "orange" }}>
                      {relatedNodes[partsInheritance[link.id][0].partOf]?.title}
                    </strong>
                  </>
                )}
              </span>
              {link.optional && (
                <span style={{ marginLeft: "2px" }}>{"(Optional)"}</span>
              )}
            </>
          ) : link.optional ? (
            <span style={{ marginLeft: "2px" }}>{"(Optional)"}</span>
          ) : (
            ""
          )}
        </Box>
      }
      slotProps={{
        popper: {
          modifiers: [
            {
              name: "offset",
              options: { offset: [0, 8] },
            },
          ],
          sx: { maxWidth: "none" },
        },
        tooltip: { sx: { maxWidth: "none", whiteSpace: "nowrap", padding: 1 } },
      }}
      placement="top"
    >
      {linkContent}
    </Tooltip>
  );
};

export default LinkNodeTitle;
