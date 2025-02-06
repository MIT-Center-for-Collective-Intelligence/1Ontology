import React from "react";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
} from "@mui/material";

const domainsEmojis = [
  {
    domain: "Agriculture and Animal Husbandry",
    emoji: "🌾",
  },
  {
    domain: "Accounting & Bookkeeping",
    emoji: "📒",
  },
  {
    domain: "Administration & Clerical",
    emoji: "📁",
  },
  {
    domain: "Agriculture & Farming",
    emoji: "🌾",
  },
  {
    domain: "AI & Machine Learning",
    emoji: "🤖",
  },
  {
    domain: "Aquaculture Management",
    emoji: "🐟",
  },
  {
    domain: "Aviation Management",
    emoji: "✈️",
  },
  {
    domain: "Bioinformatics & Computational Biology",
    emoji: "🧬",
  },
  {
    domain: "Construction & Infrastructure Management",
    emoji: "🏗️",
  },
  {
    domain: "Consulting & Advisory",
    emoji: "💼",
  },
  {
    domain: "Creative & Design",
    emoji: "🎨",
  },
  {
    domain: "Culinary & Food Services",
    emoji: "🍽️",
  },
  {
    domain: "Cybersecurity",
    emoji: "🔒",
  },
  {
    domain: "Design & Manufacturing",
    emoji: "🛠️",
  },
  {
    domain: "Education & Academic Research",
    emoji: "🎓",
  },
  {
    domain: "Emergency Services",
    emoji: "🚑",
  },
  {
    domain: "Energy Management",
    emoji: "⚡",
  },
  {
    domain: "Engineering & Technical Support",
    emoji: "⚙️",
  },
  {
    domain: "Environmental Management",
    emoji: "🌱",
  },
  {
    domain: "Event Coordination",
    emoji: "🎉",
  },
  {
    domain: "Facilities Management",
    emoji: "🏢",
  },
  {
    domain: "Finance",
    emoji: "💰",
  },
  {
    domain: "Fire Safety & Protection Systems",
    emoji: "🧯",
  },
  {
    domain: "Fitness & Wellness",
    emoji: "🏋️",
  },
  {
    domain: "Funeral Services",
    emoji: "⚰️",
  },
  {
    domain: "Government & Policy",
    emoji: "🏛️",
  },
  {
    domain: "Healthcare & Clinical Services",
    emoji: "🩺",
  },
  {
    domain: "Healthcare Management",
    emoji: "🏥",
  },
  {
    domain: "Hospitality Management",
    emoji: "🏨",
  },
  {
    domain: "Human Resources",
    emoji: "👥",
  },
  {
    domain: "Information Technology",
    emoji: "💻",
  },
  {
    domain: "Legal Services",
    emoji: "⚖️",
  },
  {
    domain: "Library & Information Services",
    emoji: "📚",
  },
  {
    domain: "Logistics & Supply Chain Management",
    emoji: "🚚",
  },
  {
    domain: "Management & Administration",
    emoji: "🧑‍💼",
  },
  {
    domain: "Manufacturing & Operations",
    emoji: "🏭",
  },
  {
    domain: "Marketing & Customer Acquisition",
    emoji: "📣",
  },
  {
    domain: "Media Production",
    emoji: "🎥",
  },
  {
    domain: "Museum & Gallery Management",
    emoji: "🖼️",
  },
  {
    domain: "Nonprofit & Educational Fundraising",
    emoji: "💸",
  },
  {
    domain: "Pest & Weed Management",
    emoji: "🐛",
  },
  {
    domain: "Performing Arts",
    emoji: "🎭",
  },
  {
    domain: "Project Management",
    emoji: "🗓️",
  },
  {
    domain: "Property Management",
    emoji: "🏠",
  },
  {
    domain: "Public Health",
    emoji: "🌐",
  },
  {
    domain: "Quality Assurance & Testing",
    emoji: "✔️",
  },
  {
    domain: "Regulatory Compliance",
    emoji: "✅",
  },
  {
    domain: "Research & Development",
    emoji: "🔬",
  },
  {
    domain: "Sales & Business Development",
    emoji: "💵",
  },
  {
    domain: "Security & Loss Prevention",
    emoji: "🛡️",
  },
  {
    domain: "Social Media Management",
    emoji: "📱",
  },
  {
    domain: "Software Development",
    emoji: "🧑‍💻",
  },
  {
    domain: "Traffic Management",
    emoji: "🚦",
  },
  {
    domain: "Veterinary Services",
    emoji: "🐾",
  },
];

const DomainLookupSidebar: React.FC = () => {
  return (
    <Box
      sx={{
        width: "100%",
        bgcolor: "background.paper",
        padding: 2,
        height: "90px",
      }}
    >
      <Typography variant="h6" gutterBottom>
        Domain Lookup
      </Typography>
      <List>
        {domainsEmojis.map(({ domain, emoji }) => (
          <ListItem sx={{ p: 0, m: 0 }} key={domain}>
            <ListItemIcon sx={{ p: 0, minWidth: 0, m: "8px", mb: "2px" }}>
              {emoji}
            </ListItemIcon>
            <ListItemText sx={{ p: 0, m: 0 }} primary={domain} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default DomainLookupSidebar;
