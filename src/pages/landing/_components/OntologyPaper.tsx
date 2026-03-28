import React, { useCallback, useEffect, useRef, useState } from "react";
import { PREFERRED_THEME_CHANGE_EVENT } from "../../../lib/hooks/useThemeManager";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import {
  Box,
  Grid,
  IconButton,
  Link,
  Stack,
  Typography,
  type TypographyProps,
} from "@mui/material";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import styles from "./OntologyPaper.module.css";

/**
 * Lets OntologyPaper.module.css match public/html/ontology-paper.css (OntologyPaper.html);
 * MUI's default Typography variants would otherwise override those sizes.
 * `component` is valid at runtime with variant="inherit"; MUI's typings omit it for that variant.
 */
const PT = (props: TypographyProps) => (
  <Typography variant="inherit" {...(props as TypographyProps<"span">)} />
);

const ontologyPaperDmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--ontology-paper-dm-sans",
});

const ontologyPaperInstrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--ontology-paper-instrument-serif",
});
import Footer from "./Footer";

const STAT_NUMBER_SX = {
  fontFamily: ontologyPaperInstrumentSerif.style.fontFamily,
  fontWeight: 400,
  fontSize: "clamp(32px, 4vw, 56px)",
  lineHeight: 1,
  "@media (min-width: 2400px)": {
    fontSize: "64px",
  },
} as const;

const AI_BARS: [string, number][] = [
  ["Generate Image Using Computer", 7.18],
  ["Create Content", 3.53],
  ["Create Video", 2.69],
  ["Answer Question", 2.59],
  ["Write Content", 1.88],
  ["Develop Application", 1.79],
  ["Summarize (Information)", 1.54],
  ["Communicate (end-to-end)", 1.39],
  ["Create Recording", 1.19],
  ["Converse", 1.18],
];

const ROBOT_BARS: [string, number][] = [
  ["Clean Window", 5.77],
  ["Care for Lawn", 5.77],
  ["Clean Yard", 5.27],
  ["Interact Client", 1.12],
  ["Teach (Actor)", 0.98],
  ["Provide Companionship", 0.86],
  ["Handling Object", 0.55],
  ["Transport (Phys. Object)", 0.49],
  ["Weld Metal", 0.24],
  ["Pack (Phys. Object)", 0.24],
];

const AI_SLIDES = (
  [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const
).map((year) => ({
  year,
  src: `/ontology-paper/ai-slide-${year}.jpg`,
}));

const ROBOT_SLIDES = (
  [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024] as const
).map((year) => ({
  year,
  src: `/ontology-paper/robot-slide-${year}.jpg`,
}));

type SlideshowProps = {
  slides: { year: number; src: string }[];
  title: string;
  alt: string;
  titleColor: string;
  autoPlayDelayMs?: number;
};

const YearSlideshow: React.FC<SlideshowProps> = ({
  slides,
  title,
  alt,
  titleColor,
  autoPlayDelayMs,
}) => {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const step = useCallback(
    (dir: number) => {
      setIdx((i) => (i + dir + slides.length) % slides.length);
    },
    [slides.length],
  );

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  useEffect(() => {
    if (autoPlayDelayMs == null) return;
    const t = window.setTimeout(() => setPlaying(true), autoPlayDelayMs);
    return () => window.clearTimeout(t);
  }, [autoPlayDelayMs]);

  useEffect(() => {
    if (!playing) {
      clearTimer();
      return;
    }
    timerRef.current = setInterval(() => step(1), 1200);
    return clearTimer;
  }, [playing, step, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <Stack spacing={0}>
      <PT
        className={styles.slideshowTitle}
        component="div"
        sx={{
          color: titleColor,
          mb: "14px",
          fontSize: { xs: "21px", sm: "24px", md: "26px" },
          fontFamily: "'Playfair Display', serif",
          lineHeight: 1.25,
        }}
      >
        {title}
      </PT>
      <Box className={styles.slideshowContainer}>
        <Box component="img" src={slides[idx]?.src} alt={alt} loading="lazy" />
        <Stack
          direction="row"
          className={styles.slideshowControls}
          alignItems="center"
          justifyContent="center"
        >
          <IconButton
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous"
            disableRipple
          >
            <SkipPreviousIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton
            type="button"
            className={styles.slideshowPlay}
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            disableRipple
          >
            {playing ? (
              <PauseIcon sx={{ fontSize: 20 }} />
            ) : (
              <PlayArrowIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
          <PT component="span" className={styles.slideshowYear}>
            {slides[idx]?.year}
          </PT>
          <IconButton
            type="button"
            onClick={() => step(1)}
            aria-label="Next"
            disableRipple
          >
            <SkipNextIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Stack>
      </Box>
    </Stack>
  );
};

function readStoredDark(): boolean {
  try {
    const stored = localStorage.getItem("preferred-theme");
    return stored ? stored === "dark" : true;
  } catch {
    return true;
  }
}

export type OntologyPaperProps = {
  /**
   * When provided (e.g. from `/landing` with `useThemeManager`), theme follows this value.
   * Omit for standalone use: reads `preferred-theme` and listens for cross-tab `storage`
   * / parent `postMessage` (`ontology-paper-theme`).
   */
  isDark?: boolean;
};

const OntologyPaper: React.FC<OntologyPaperProps> = ({
  isDark: isDarkProp,
}) => {
  const controlled = isDarkProp !== undefined;
  const [uncontrolledDark, setUncontrolledDark] = useState(true);

  const isDark = controlled ? isDarkProp : uncontrolledDark;

  useEffect(() => {
    if (controlled) return;
    setUncontrolledDark(readStoredDark());
  }, [controlled]);

  useEffect(() => {
    if (controlled) return;
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const d = ev.data as { type?: string; mode?: string } | null;
      if (!d || d.type !== "ontology-paper-theme") return;
      setUncontrolledDark(d.mode === "dark");
    };
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "preferred-theme") setUncontrolledDark(readStoredDark());
    };
    const onLocalThemeCommit = () => setUncontrolledDark(readStoredDark());
    window.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    window.addEventListener(PREFERRED_THEME_CHANGE_EVENT, onLocalThemeCommit);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        PREFERRED_THEME_CHANGE_EVENT,
        onLocalThemeCommit,
      );
    };
  }, [controlled]);

  const mxAi = AI_BARS[0][1];
  const mxRb = ROBOT_BARS[0][1];

  return (
    <Box
      className={`${ontologyPaperDmSans.variable} ${ontologyPaperInstrumentSerif.variable} ${styles.paperRoot} ${isDark ? styles.paperRootDark : ""}`}
    >
      <Box className={styles.grain} aria-hidden />
      <Box component="section" className={styles.hero}>
        <PT component="h1">
          Where Can <em>AI</em> Be Used?
        </PT>
        <PT component="p" className={styles.subtitle}>
          Insights from a deep ontology of work activities — a comprehensive
          framework mapping 13,275 AI software applications and 20.8 million
          robotic systems to 39,603 human work activities.
        </PT>
        <PT component="p" className={styles.authors}>
          <Box component="span" className={styles.eq}>
            Alice Cai
            <Box component="span" className={styles.af}>
              1,2†
            </Box>
          </Box>
          ,{" "}
          <Box component="span" className={styles.eq}>
            Iman YeckehZaare
            <Box component="span" className={styles.af}>
              1,2†
            </Box>
          </Box>
          ,{" "}
          <Box component="span" className={styles.eq}>
            Shuo Sun
            <Box component="span" className={styles.af}>
              1,3†
            </Box>
          </Box>
          ,{" "}
          <Box component="span" className={styles.eq}>
            Vasiliki Charisi
            <Box component="span" className={styles.af}>
              1,3†
            </Box>
          </Box>
          , Xinru Wang
          <Box component="span" className={styles.af}>
            1,3
          </Box>
          , Aiman Imran
          <Box component="span" className={styles.af}>
            1,2
          </Box>
          , Robert Laubacher
          <Box component="span" className={styles.af}>
            1,2
          </Box>
          , Alok Prakash
          <Box component="span" className={styles.af}>
            1,3
          </Box>
          , Thomas W. Malone
          <Box component="span" className={styles.af}>
            1,2*
          </Box>
        </PT>
        <PT component="p" className={styles.heroNote}>
          <Box component="span" className={styles.af}>
            †
          </Box>{" "}
          Equal contribution · *Corresponding author
        </PT>
        <Stack component="div" className={styles.affiliations} spacing={0.75}>
          <PT component="span">
            <Box component="span" className={styles.an}>
              1
            </Box>
            Center for Collective Intelligence, Massachusetts Institute of
            Technology, Cambridge, MA, USA
          </PT>
          <PT component="span">
            <Box component="span" className={styles.an}>
              2
            </Box>
            Sloan School of Management, Massachusetts Institute of Technology,
            Cambridge, MA, USA
          </PT>
          <PT component="span">
            <Box component="span" className={styles.an}>
              3
            </Box>
            Mens, Manus, and Machina, Singapore-MIT Alliance for Research and
            Technology, Singapore
          </PT>
        </Stack>
      </Box>

      <Box className={styles.statsStrip}>
        <Box className={styles.statCell}>
          <PT component="div" className={styles.statNumber} sx={STAT_NUMBER_SX}>
            39,603
          </PT>
          <PT component="div" className={styles.statLabel}>
            Work activities
            <br />
            in the ontology
          </PT>
        </Box>
        <Box className={styles.statCell}>
          <PT component="div" className={styles.statNumber} sx={STAT_NUMBER_SX}>
            13,275
          </PT>
          <PT component="div" className={styles.statLabel}>
            AI software
            <br />
            applications classified
          </PT>
        </Box>
        <Box className={styles.statCell}>
          <PT component="div" className={styles.statNumber} sx={STAT_NUMBER_SX}>
            20.8M
          </PT>
          <PT component="div" className={styles.statLabel}>
            Robotic systems
            <br />
            mapped worldwide
          </PT>
        </Box>
        <Box className={styles.statCell}>
          <PT component="div" className={styles.statNumber} sx={STAT_NUMBER_SX}>
            900+
          </PT>
          <PT component="div" className={styles.statLabel}>
            Occupations from
            <br />
            O*NET reorganized
          </PT>
        </Box>
      </Box>

      <Box component="section" className={styles.section} textAlign="center">
        <PT
          component="div"
          className={styles.sectionLabel}
          sx={{ fontWeight: "bold", fontSize: "20px", mb: "10px" }}
        >
          Signature Result
        </PT>
        <PT
          component="h2"
          className={styles.sectionTitle}
          sx={{
            mx: "auto",
            mb: 6,
            fontSize: "46px",
            fontFamily: ontologyPaperInstrumentSerif.style.fontFamily,
            fontWeight: 400,
          }}
        >
          Overall view of how AI is used today
        </PT>
        <Box className={styles.figCard}>
          <Box
            component="img"
            src="/ontology-paper/fig-12-sunburst.jpg"
            alt="Sunburst diagram of AI market value across work activities"
            loading="lazy"
          />
          <PT component="div" className={styles.figCaption}>
            <Box component="strong">Fig. 12:</Box> Sunburst diagram showing the
            distribution of AI market value across all work activities. Both AI
            software applications and robotic systems are included.
          </PT>
        </Box>
      </Box>

      <Box component="section" className={styles.section}>
        <PT
          component="div"
          className={styles.sectionLabel}
          sx={{
            fontWeight: "bold",
            fontSize: "20px",
            mb: "10px",
          }}
        >
          Key Findings
        </PT>
        <PT
          component="h2"
          className={styles.sectionTitle}
          sx={{
            fontSize: "36px",
            fontFamily: ontologyPaperInstrumentSerif.style.fontFamily,
            fontWeight: "bold",
            mb: "46px",
          }}
        >
          A highly uneven landscape of AI across human work
        </PT>

        <Grid container spacing={3} sx={{ mb: 4, alignItems: "stretch" }}>
          <Grid size={{ xs: 12, sm: 6 }} className={styles.breakdownGridItem}>
            <Box className={`${styles.breakdownCard} ${styles.breakdownThink}`}>
              <PT
                component="div"
                className={styles.breakdownPct}
                sx={{
                  fontSize: "50px",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                72%
              </PT>
              <PT component="div" className={styles.breakdownName}>
                “Think” — Act on Information
              </PT>
              <PT component="div" className={styles.breakdownDetail}>
                The vast majority of AI market value is concentrated in
                information-based activities, especially creating information
                (36%) and transferring information (26%).
              </PT>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }} className={styles.breakdownGridItem}>
            <Box className={`${styles.breakdownCard} ${styles.breakdownDo}`}>
              <PT
                component="div"
                className={styles.breakdownPct}
                sx={{
                  fontSize: "55px",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                12%
              </PT>
              <PT component="div" className={styles.breakdownName}>
                “Do” — Act on Physical Objects
              </PT>
              <PT component="div" className={styles.breakdownDetail}>
                Physical activities account for a surprisingly small share of AI
                market value. Robots performing purely physical tasks remain a
                modest contributor.
              </PT>
            </Box>
          </Grid>
          <Grid size={12} className={styles.breakdownGridItem}>
            <Box
              className={`${styles.breakdownCard} ${styles.breakdownInteract} ${styles.interactSpanner}`}
            >
              <PT
                component="div"
                className={styles.breakdownPct}
                sx={{
                  fontSize: "50px",
                  fontFamily: "'Playfair Display', serif",
                }}
              >
                48%
              </PT>
              <PT component="div" className={styles.breakdownName}>
                “Interact” — Activities Between Actors
              </PT>
              <PT component="div" className={styles.breakdownDetail}>
                Interactive activities span both information and physical
                domains. Transferring information alone accounts for 26% of all
                AI market value.
              </PT>
            </Box>
          </Grid>
        </Grid>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className={styles.chartCard}>
              <PT component="h3">Top 10 AI Software Activities</PT>
              <PT component="p" className={styles.chartSub}>
                These account for &gt;25% of all 13,275 applications
              </PT>
              <Box>
                {AI_BARS.map(([label, v]) => (
                  <Box key={label} className={styles.barRow}>
                    <PT component="div" className={styles.barLabel}>
                      {label}
                    </PT>
                    <Box className={styles.barTrack}>
                      <Box
                        className={`${styles.barFill} ${styles.barFillSoftware}`}
                        sx={{ width: `${(v / mxAi) * 100}%` }}
                      />
                    </Box>
                    <PT
                      component="div"
                      className={`${styles.barVal} ${styles.barValSoftware}`}
                    >
                      {v}%
                    </PT>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className={styles.chartCard}>
              <PT component="h3">Top 10 Robotic Activities</PT>
              <PT component="p" className={styles.chartSub}>
                Excluding &quot;Clean floor&quot; (76.7% of all robot units)
              </PT>
              <Box>
                {ROBOT_BARS.map(([label, v]) => (
                  <Box key={label} className={styles.barRow}>
                    <PT component="div" className={styles.barLabel}>
                      {label}
                    </PT>
                    <Box className={styles.barTrack}>
                      <Box
                        className={`${styles.barFill} ${styles.barFillRobot}`}
                        sx={{ width: `${(v / mxRb) * 100}%` }}
                      />
                    </Box>
                    <PT
                      component="div"
                      className={`${styles.barVal} ${styles.barValRobot}`}
                    >
                      {v}%
                    </PT>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Box className={styles.chartCard}>
          <PT component="h3">Explosive Growth Since Generative AI</PT>
          <PT component="p" className={styles.chartSub}>
            Number of AI software applications, 2016–2025
          </PT>
          <Box
            component="svg"
            className={styles.growthSvg}
            viewBox="0 0 1060 380"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="og-lg" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#e85d4a" />
              </linearGradient>
              <linearGradient id="og-ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e85d4a" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#e85d4a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <line x1="80" y1="30" x2="80" y2="310" stroke="var(--border)" />
            <text
              x="14"
              y="170"
              fill="var(--muted)"
              fontFamily="DM Sans"
              fontSize="11"
              transform="rotate(-90 14 170)"
              textAnchor="middle"
            >
              Number of AI Applications
            </text>
            <text
              x="72"
              y="310"
              fill="var(--text)"
              fontFamily="DM Sans"
              fontSize="10"
              textAnchor="end"
            >
              0
            </text>
            <line x1="80" y1="310" x2="1020" y2="310" stroke="var(--border)" />
            <text
              x="72"
              y="240"
              fill="var(--text)"
              fontFamily="DM Sans"
              fontSize="10"
              textAnchor="end"
            >
              3K
            </text>
            <line
              x1="80"
              y1="240"
              x2="1020"
              y2="240"
              stroke="rgba(0,0,0,.04)"
              strokeDasharray="4"
            />
            <text
              x="72"
              y="170"
              fill="var(--text)"
              fontFamily="DM Sans"
              fontSize="10"
              textAnchor="end"
            >
              6K
            </text>
            <line
              x1="80"
              y1="170"
              x2="1020"
              y2="170"
              stroke="rgba(0,0,0,.04)"
              strokeDasharray="4"
            />
            <text
              x="72"
              y="100"
              fill="var(--text)"
              fontFamily="DM Sans"
              fontSize="10"
              textAnchor="end"
            >
              9K
            </text>
            <line
              x1="80"
              y1="100"
              x2="1020"
              y2="100"
              stroke="rgba(0,0,0,.04)"
              strokeDasharray="4"
            />
            <text
              x="72"
              y="40"
              fill="var(--text)"
              fontFamily="DM Sans"
              fontSize="10"
              textAnchor="end"
            >
              13K
            </text>
            <text
              x="550"
              y="370"
              fill="var(--muted)"
              fontFamily="DM Sans"
              fontSize="11"
              textAnchor="middle"
            >
              Year
            </text>
            <path
              d="M120,307 L224,307 L328,305 L432,302 L536,295 L640,273 L744,210 L848,128 L952,68 L1000,55 L1000,310 L120,310 Z"
              fill="url(#og-ag)"
            />
            <polyline
              points="120,307 224,307 328,305 432,302 536,295 640,273 744,210 848,128 952,68 1000,55"
              fill="none"
              stroke="url(#og-lg)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g fontFamily="DM Sans">
              <circle cx="120" cy="307" r="4" fill="#e85d4a" />
              <text
                x="120"
                y="296"
                fill="var(--muted)"
                fontSize="10"
                textAnchor="middle"
              >
                11
              </text>
              <text
                x="120"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2016
              </text>
              <circle cx="224" cy="307" r="4" fill="#e85d4a" />
              <text
                x="224"
                y="296"
                fill="var(--muted)"
                fontSize="10"
                textAnchor="middle"
              >
                37
              </text>
              <text
                x="224"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2017
              </text>
              <circle cx="328" cy="305" r="4" fill="#e85d4a" />
              <text
                x="328"
                y="294"
                fill="var(--muted)"
                fontSize="10"
                textAnchor="middle"
              >
                69
              </text>
              <text
                x="328"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2018
              </text>
              <circle cx="432" cy="302" r="4" fill="#e85d4a" />
              <text
                x="432"
                y="291"
                fill="var(--muted)"
                fontSize="10"
                textAnchor="middle"
              >
                126
              </text>
              <text
                x="432"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2019
              </text>
              <circle cx="536" cy="295" r="4" fill="#e85d4a" />
              <text
                x="536"
                y="284"
                fill="var(--muted)"
                fontSize="10"
                textAnchor="middle"
              >
                310
              </text>
              <text
                x="536"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2020
              </text>
              <circle cx="640" cy="273" r="4" fill="#e85d4a" />
              <text
                x="640"
                y="262"
                fill="var(--muted)"
                fontSize="10"
                textAnchor="middle"
              >
                629
              </text>
              <text
                x="640"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2021
              </text>
              <circle cx="744" cy="210" r="4" fill="#e85d4a" />
              <text
                x="744"
                y="199"
                fill="#e85d4a"
                fontSize="11"
                textAnchor="middle"
                fontWeight={600}
              >
                1,756
              </text>
              <text
                x="744"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2022
              </text>
              <circle cx="848" cy="128" r="4" fill="#e85d4a" />
              <text
                x="848"
                y="117"
                fill="#e85d4a"
                fontSize="11"
                textAnchor="middle"
                fontWeight={600}
              >
                7,642
              </text>
              <text
                x="848"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2023
              </text>
              <circle cx="952" cy="68" r="4" fill="#e85d4a" />
              <text
                x="952"
                y="57"
                fill="#e85d4a"
                fontSize="11"
                textAnchor="middle"
                fontWeight={600}
              >
                12,399
              </text>
              <text
                x="952"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2024
              </text>
              <circle
                cx="1000"
                cy="55"
                r="5"
                fill="#e85d4a"
                stroke="var(--bg)"
                strokeWidth="2"
              />
              <text
                x="1000"
                y="42"
                fill="#e85d4a"
                fontSize="12"
                textAnchor="middle"
                fontWeight={700}
              >
                13,275
              </text>
              <text
                x="1000"
                y="330"
                fill="var(--text)"
                fontSize="10"
                textAnchor="middle"
              >
                2025
              </text>
            </g>
            <line
              x1="744"
              y1="215"
              x2="744"
              y2="265"
              stroke="rgba(232,93,74,.3)"
              strokeDasharray="4"
            />
            <text
              x="756"
              y="258"
              fill="#e85d4a"
              fontFamily="DM Sans"
              fontSize="10"
              opacity={0.7}
            >
              GenAI inflection
            </text>
          </Box>
        </Box>

        <Box className={`${styles.chartCard} ${styles.concentration}`}>
          <PT
            component="div"
            className={styles.bigNum}
            sx={{ color: "var(--accent)", fontSize: "79px" }}
          >
            1.6%
          </PT>
          <PT
            component="div"
            className={styles.bigLabel}
            sx={{ fontSize: "24px" }}
          >
            of activities account for
          </PT>
          <PT
            component="div"
            className={styles.bigNum}
            sx={{ color: "var(--accent2)", mt: 1, fontSize: "79px" }}
          >
            &gt;60%
          </PT>
          <PT
            component="div"
            className={styles.bigLabel}
            sx={{ fontSize: "24px" }}
          >
            of all AI market value
          </PT>
          <PT component="div" className={styles.concentrationNote}>
            AI adoption is extraordinarily concentrated — a tiny fraction of
            human work activities capture the overwhelming majority of AI
            investment.
          </PT>
        </Box>
      </Box>

      <Box component="section" className={styles.section}>
        <PT
          component="div"
          className={styles.sectionLabel}
          sx={{ fontWeight: "bold", fontSize: "20px", mb: "10px" }}
        >
          Key Figures
        </PT>
        <PT
          component="h2"
          className={styles.sectionTitle}
          sx={{
            fontSize: "46px",
            fontFamily: ontologyPaperInstrumentSerif.style.fontFamily,
            fontWeight: 400,
            mb: "46px",
          }}
        >
          Visualizations from the paper
        </PT>

        <Box className={styles.figCard} mb={4}>
          <Box
            component="img"
            src="/ontology-paper/fig-1-ontology.jpg"
            alt="Ontology structure diagram"
            loading="lazy"
          />
          <PT component="div" className={styles.figCaption}>
            <Box component="strong">Fig. 1:</Box> Ontology structure — from
            O*NET tasks to atomic activities across 14 levels of depth.
          </PT>
        </Box>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className={styles.figCard}>
              <Box
                component="img"
                src="/ontology-paper/fig-3-ai.jpg"
                alt="AI software applications mapped to the ontology"
                loading="lazy"
              />
              <PT component="div" className={styles.figCaption}>
                <Box component="strong">Fig. 3:</Box> Where are AI software
                applications used today? 13,275 applications mapped to the
                ontology.
              </PT>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box className={styles.figCard}>
              <Box
                component="img"
                src="/ontology-paper/fig-9-robot.jpg"
                alt="Robotic systems mapped to the ontology"
                loading="lazy"
              />
              <PT component="div" className={styles.figCaption}>
                <Box component="strong">Fig. 9:</Box> Where are robotic systems
                used today? 20.8 million robots mapped to the ontology.
              </PT>
            </Box>
          </Grid>
        </Grid>

        <Box mt={4}>
          <Grid container spacing={3} justifyContent="center">
            <Grid size={{ xs: 12, md: 12 }}>
              <Box
                className={`${styles.slideshowCard} ${styles.slideshowCardCentered}`}
              >
                <YearSlideshow
                  slides={AI_SLIDES}
                  title="AI Software Applications Over Time"
                  alt="AI sunburst by year"
                  titleColor="var(--accent)"
                  autoPlayDelayMs={800}
                />
              </Box>
            </Grid>
            {/* <Grid size={{ xs: 12, md: 6 }}>
              <Box className={styles.slideshowCard}>
                <YearSlideshow
                  slides={ROBOT_SLIDES}
                  title="Robotic Applications Over Time"
                  alt="Robot sunburst by year"
                  titleColor="var(--accent3)"
                  autoPlayDelayMs={800}
                />
              </Box>
            </Grid> */}
          </Grid>
        </Box>
      </Box>

      <Box component="section" className={styles.ctaSection}>
        <Link
          href="https://arxiv.org/abs/2603.20619"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.arxivBtn}
          underline="none"
          sx={{ mb: "19px", color: "white", fontWeight: "bold" }}
        >
          Read the Full Paper →
        </Link>
        <PT component="div" className={styles.arxivId}>
          arXiv:2603.20619v1 [cs.AI] — 21 March 2026
        </PT>
      </Box>
      <Footer isDark={isDark} />
    </Box>
  );
};

export default OntologyPaper;
