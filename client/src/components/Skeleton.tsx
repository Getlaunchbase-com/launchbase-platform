import { useEffect } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

// Initialize animations once
let animationsInitialized = false;

function initializeAnimations() {
  if (animationsInitialized) return;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
  animationsInitialized = true;
}

export function Skeleton({
  width = "100%",
  height = "20px",
  borderRadius = "4px",
}: SkeletonProps) {
  useEffect(() => {
    initializeAnimations();
  }, []);

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#333",
        borderRadius,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ padding: "16px", backgroundColor: "#1a1a1a", borderRadius: "8px", border: "1px solid #333" }}>
      <Skeleton width="60%" height="20px" />
      <div style={{ marginBottom: "12px" }} />
      <Skeleton width="100%" height="16px" />
      <div style={{ marginBottom: "8px" }} />
      <Skeleton width="80%" height="16px" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${count}, 1fr)`, gap: "16px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
