import React from "react";
import { Box, AvatarGroup, Tooltip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import OptimizedAvatar from "../Chat/OptimizedAvatar";
import { useUsers } from " @components/hooks/useUsers";
import { INode } from " @components/types/INode";

interface PropertyContributorsProps {
  currentVisibleNode: INode;
  property: string;
  sx?: SxProps<Theme>;
}

const PropertyContributors: React.FC<PropertyContributorsProps> = ({
  currentVisibleNode,
  property,
  sx = {},
}) => {
  const { usersData, isLoading } = useUsers();
  const contributors =
    currentVisibleNode?.contributorsByProperty?.[property] || [];

  if (!contributors.length) return null;
  if (isLoading) return null;

  if (!contributors.length) return null;

  const getFullName = (username: string): string => {
    const user = usersData[username];
    if (user) {
      return `${user.fName} ${user.lName}`;
    }
    return username;
  };

  const getImageUrl = (username: string): string => {
    const user = usersData[username];
    if (user) {
      return user.imageUrl;
    }
    return "";
  };

  return (
    <Box
      sx={{
        // position: 'relative',
        display: "flex",
        // justifyContent: 'flex-end',

        /*         mt: 'auto',
        ml: 'auto', */
        ...sx,
      }}
    >
      <AvatarGroup
        max={3}
        sx={{
          display: "flex",
          alignItems: "center",
          "& .MuiAvatarGroup-avatar": {
            border: "none",
            width: "24px",
            height: "24px",
            fontSize: "0.6rem",
          },
          "& .MuiAvatar-root": {
            // marginRight: '-4px',
          },
          "& > *": {
            display: "flex",
            alignItems: "center",
          },
          "& .MuiAvatarGroup-avatar:last-child": {
            marginRight: 0,
            color: (theme) => (theme.palette.mode === "dark" ? "#fff" : "#000"),
          },
        }}
      >
        {["1man", "ouhrac"].map((username: string, index: number) => (
          <Tooltip
            key={`${username}-${index}`}
            title={getFullName(username)}
            arrow
            placement="top"
          >
            <span style={{ display: "flex", alignItems: "center" }}>
              <OptimizedAvatar
                imageUrl={getImageUrl(username)}
                alt={getFullName(username)}
                size={24}
                quality={50}
                sx={{
                  cursor: "default",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                }}
              />
            </span>
          </Tooltip>
        ))}
      </AvatarGroup>
    </Box>
  );
};

export default PropertyContributors;
