import { Avatar, Box } from "@mui/material";
import { common } from "@mui/material/colors";
import { SxProps, Theme } from "@mui/system";
import Image from "next/image";
import React, { FC, useState } from "react";
import { DESIGN_SYSTEM_COLORS } from "@components/lib/theme/colors";

type Props = {
  imageUrl: string;
  alt: string;
  size: number;
  onClick?: () => void;
  quality?: number;
  sx?: SxProps<Theme>;
  borderColor?: string;
  online?: boolean;
};

const DEFAULT_AVATAR =
  "https://storage.googleapis.com/onecademy-1.appspot.com/ProfilePictures/no-img.png";

const OptimizedAvatar: FC<Props> = ({
  imageUrl,
  alt,
  size,
  onClick,
  quality = 50,
  sx,
  borderColor,
  online,
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <Box
      onClick={onClick}
      sx={{
        ...(size > 0 && {
          minWidth: `${size}px`,
          width: `${size}px`,
          height: `${size}px`,
        }),
        position: "relative",
        borderRadius: "50%",
        cursor: "pointer",
        border: (theme) => (online ? `solid 3px #14c815` : ""),
        ":hover": {
          ...(onClick && {
            border: `solid 1px ${DESIGN_SYSTEM_COLORS.primary600}`,
          }),
        },
        ...sx,
      }}
    >
      {hasError || !imageUrl || imageUrl === DEFAULT_AVATAR ? (
        <Avatar
          sx={{
            background:
              "linear-gradient(143.7deg, #FDC830 15.15%, #F37335 83.11%);",
            fontWeight: "500",
            fontSize: `${(size - 8) / 2}px`,
            color: common.white,
            width: `${size}px`,
            height: `${size}px`,
          }}
        >
          {alt
            .split(" ")
            .map((c) => c[0])
            .join("")
            .toUpperCase()}
        </Avatar>
      ) : (
        <Avatar
          src={imageUrl}
          alt={alt}
          sx={{
            width: `${size}px`,
            height: `${size}px`,
            quality: quality,
            objectFit: "cover",
          }}
          style={{ borderRadius: "50%" }}
          onError={() => setHasError(true)}
        />
      )}
    </Box>
  );
};

export default OptimizedAvatar;
