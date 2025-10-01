import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import Head from "next/head";
import {
  Box,
  Container,
  IconButton,
  Typography,
  ThemeProvider,
  CssBaseline,
  Chip,
} from "@mui/material";
import { useThemeManager } from "../../lib/hooks/useThemeManager";
import { createLandingTheme } from "../../theme/landingTheme";
import Navigation from "./_components/Navigation";
import MobileDrawer from "./_components/MobileDrawer";
import {
  TreeNode,
  TreemapNode,
  ViewState,
  TreemapBounds,
  TooltipData,
  processTreeData,
  layoutTreemap,
  filterVisibleNodes,
  findMaxAppCount,
  constrainView,
  calculateFitView,
  calculateCenterZoom,
  findHoveredNode,
  calculateTooltipData,
  calculateTooltipPosition,
} from "../../utilsLandingPage/treemapLogic";

import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
  Menu as MenuIcon,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
} from "@mui/icons-material";
import { renderTreemap } from "@components/utilsLandingPage/treemapRendering";

const TreemapPage = () => {
  const { isDark, handleThemeSwitch, isAuthenticated, isAuthLoading } =
    useThemeManager();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [data, setData] = useState<TreeNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [treemapBounds, setTreemapBounds] = useState<TreemapBounds>({
    width: 0,
    height: 0,
  });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [reverseColors, setReverseColors] = useState(false);

  const theme = createLandingTheme(isDark);

  // Load data
  useEffect(() => {
    fetch("/landing_data/tree_data.json")
      .then((res) => res.json())
      .then((json) => {
        const processedData = processTreeData(json);
        setData(processedData);
      })
      .catch((err) => console.error("Failed to load data:", err));
  }, []);

  // Memoize expensive calculations to avoid recalculating on every hover
  const maxCount = useMemo(() => {
    return data ? findMaxAppCount(data) : 0;
  }, [data]);

  const treemapNodes = useMemo(() => {
    if (!data || treemapBounds.width === 0 || treemapBounds.height === 0) {
      return [];
    }

    const nodes = layoutTreemap(
      data,
      treemapBounds.width,
      treemapBounds.height,
      maxCount,
    );
    return filterVisibleNodes(nodes, 3);
  }, [data, treemapBounds.width, treemapBounds.height, maxCount]);

  // Draw treemap
  const drawTreemap = useCallback(() => {
    if (!canvasRef.current || !data) return;

    // Set treemap bounds (fixed size for layout)
    const treemapWidth = 1450;
    const treemapHeight = 1000;

    // Update bounds if they haven't been set
    if (treemapBounds.width === 0) {
      setTreemapBounds({ width: treemapWidth, height: treemapHeight });
    }

    // Use memoized values instead of recalculating
    if (treemapNodes.length === 0) return;

    // Debug: log filtered nodes count (only when nodes change)
    if (treemapNodes.length > 0) {
      console.log(`Treemap rendered with ${treemapNodes.length} visible nodes`);
    }

    // Use the new rendering function
    renderTreemap(
      canvasRef.current,
      treemapNodes,
      hoveredNodeId,
      zoom,
      panX,
      panY,
      isDark,
      maxCount,
    );
  }, [
    treemapNodes,
    hoveredNodeId,
    zoom,
    panX,
    panY,
    isDark,
    maxCount,
    treemapBounds,
  ]);

  // Constrain zoom and pan within bounds
  const constrainViewCallback = useCallback(
    (newZoom: number, newPanX: number, newPanY: number) => {
      if (!canvasRef.current) {
        return { zoom: newZoom, panX: newPanX, panY: newPanY };
      }

      const rect = canvasRef.current.getBoundingClientRect();
      return constrainView(
        newZoom,
        newPanX,
        newPanY,
        rect.width,
        rect.height,
        treemapBounds,
      );
    },
    [treemapBounds],
  );

  // Handle mouse wheel for zooming - center-based like buttons
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!canvasRef.current || !treemapBounds.width) return;

      e.preventDefault();

      const rect = canvasRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Improved zoom sensitivity - much more gradual
      const deltaY = Math.sign(e.deltaY);
      const zoomFactor = deltaY > 0 ? 0.95 : 1.05;

      // Use the extracted utility function
      const newViewState = calculateCenterZoom(
        zoom,
        panX,
        panY,
        zoomFactor,
        centerX,
        centerY,
        rect.width,
        rect.height,
        treemapBounds,
      );

      setZoom(newViewState.zoom);
      setPanX(newViewState.panX);
      setPanY(newViewState.panY);
    },
    [zoom, panX, panY, treemapBounds],
  );

  // Handle mouse events for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Handle dragging
      if (isDragging) {
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;

        const newPanX = panX + deltaX;
        const newPanY = panY + deltaY;

        const constrained = constrainViewCallback(zoom, newPanX, newPanY);

        setPanX(constrained.panX);
        setPanY(constrained.panY);
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
      }

      // Handle hover detection when not dragging
      if (!canvasRef.current || !data) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Find which node is under the mouse using memoized nodes
      const hoveredNode = findHoveredNode(
        mouseX,
        mouseY,
        panX,
        panY,
        zoom,
        treemapNodes,
      );

      if (hoveredNode) {
        setHoveredNodeId(hoveredNode.id);
        // Convert block coordinates to screen coordinates for tooltip positioning
        const tooltipData = calculateTooltipData(hoveredNode, zoom, panX, panY);
        setTooltipData(tooltipData);
      } else {
        setHoveredNodeId(null);
        setTooltipData(null);
      }
    },
    [
      isDragging,
      lastMousePos,
      panX,
      panY,
      constrainViewCallback,
      treemapNodes,
      zoom,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    if (!canvasRef.current || !treemapBounds.width) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const viewState = calculateFitView(rect.width, rect.height, treemapBounds);

    setZoom(viewState.zoom);
    setPanX(viewState.panX);
    setPanY(viewState.panY);
  }, [treemapBounds]);

  // Initialize view when data loads
  useEffect(() => {
    if (data && treemapBounds.width > 0 && canvasRef.current) {
      resetView();
    }
  }, [data, treemapBounds, resetView]);

  // Setup event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Redraw when state changes
  useEffect(() => {
    drawTreemap();
  }, [drawTreemap]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      drawTreemap();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawTreemap]);

  if (!data) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
          }}
        >
          <Typography>Loading treemap data...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <>
      <Head>
        <title>
          AI Applications Treemap - Ontology of Collective Intelligence
        </title>
        <meta
          name="description"
          content="Interactive treemap visualization of AI applications classified by our ontology"
        />
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
          {/* Navigation */}
          <Navigation
            isDark={isDark}
            handleThemeSwitch={handleThemeSwitch}
            isAuthenticated={isAuthenticated}
            isAuthLoading={isAuthLoading}
            onMobileMenuOpen={() => setMobileNavOpen(true)}
          />

          {/* Mobile Navigation Drawer */}
          <MobileDrawer
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
          />

          {/* Main Content */}
          <Box sx={{ pt: 10 }}>
            {/* Header */}
            <Container maxWidth="xl" sx={{ mb: 4 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 2,
                }}
              >
                <Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 300,
                      mb: 1,
                      fontSize: { xs: "1.75rem", md: "2.5rem" },
                    }}
                  >
                    AI Applications Treemap
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ color: "text.secondary", fontWeight: 400 }}
                  >
                    Interactive visualization of{" "}
                    {data.appCount.toLocaleString()} AI apps classified by
                    ontology
                  </Typography>
                </Box>

                {/* Controls */}
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Chip
                    label={`Zoom: ${(zoom * 100).toFixed(0)}%`}
                    size="small"
                    sx={{ bgcolor: "background.paper" }}
                  />
                  <IconButton
                    onClick={() => {
                      if (!canvasRef.current) return;
                      const rect = canvasRef.current.getBoundingClientRect();
                      const centerX = rect.width / 2;
                      const centerY = rect.height / 2;

                      const newViewState = calculateCenterZoom(
                        zoom,
                        panX,
                        panY,
                        1.1,
                        centerX,
                        centerY,
                        rect.width,
                        rect.height,
                        treemapBounds,
                      );

                      setZoom(newViewState.zoom);
                      setPanX(newViewState.panX);
                      setPanY(newViewState.panY);
                    }}
                    size="small"
                  >
                    <ZoomIn />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      if (!canvasRef.current) return;
                      const rect = canvasRef.current.getBoundingClientRect();
                      const centerX = rect.width / 2;
                      const centerY = rect.height / 2;

                      const newViewState = calculateCenterZoom(
                        zoom,
                        panX,
                        panY,
                        0.9,
                        centerX,
                        centerY,
                        rect.width,
                        rect.height,
                        treemapBounds,
                      );

                      setZoom(newViewState.zoom);
                      setPanX(newViewState.panX);
                      setPanY(newViewState.panY);
                    }}
                    size="small"
                  >
                    <ZoomOut />
                  </IconButton>
                  <IconButton onClick={resetView} size="small">
                    <CenterFocusStrong />
                  </IconButton>
                </Box>
              </Box>
            </Container>

            {/* Treemap Canvas */}
            <Box
              ref={containerRef}
              sx={{ position: "relative", height: "calc(100vh - 200px)" }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: "100%",
                  cursor: isDragging ? "grabbing" : "default",
                  display: "block",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => {
                  handleMouseUp();
                  setHoveredNodeId(null);
                  setTooltipData(null);
                }}
              />

              {/* Tooltip */}
              {tooltipData &&
                !isDragging &&
                (() => {
                  // Position tooltip using extracted utility
                  const containerRect =
                    containerRef.current?.getBoundingClientRect();
                  if (!containerRect) return null;

                  const { left: tooltipLeft, top: tooltipTop } =
                    calculateTooltipPosition(
                      tooltipData,
                      containerRect.width,
                      containerRect.height,
                    );

                  return (
                    <Box
                      sx={{
                        position: "absolute",
                        left: tooltipLeft,
                        top: tooltipTop,
                        bgcolor: "rgba(0, 0, 0, 0.9)",
                        color: "white",
                        padding: "8px 12px",
                        borderRadius: "4px",
                        pointerEvents: "none",
                        zIndex: 1000,
                        fontSize: "14px",
                        maxWidth: "250px",
                        whiteSpace: "nowrap",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      }}
                    >
                      <Box sx={{ fontWeight: "bold", marginBottom: "4px" }}>
                        {tooltipData.name}
                      </Box>
                      <Box sx={{ fontSize: "12px", opacity: 0.9 }}>
                        {tooltipData.appCount} AI apps
                      </Box>
                    </Box>
                  );
                })()}
            </Box>

            {/* Instructions */}
            {/* <Container maxWidth="xl" sx={{ mt: 4, mb: 8 }}>
              <Card sx={{ p: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    How to Navigate
                  </Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 3 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "primary.main", mb: 1 }}>
                        Zoom
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Use Ctrl/Cmd + mouse wheel or two fingers on trackpad to zoom in and out
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "primary.main", mb: 1 }}>
                        Pan
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Click and drag to move around the treemap
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: "primary.main", mb: 1 }}>
                        Color Coding
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Darker colors indicate higher concentrations of AI applications
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Container> */}
          </Box>
        </Box>
      </ThemeProvider>
    </>
  );
};

export default TreemapPage;
