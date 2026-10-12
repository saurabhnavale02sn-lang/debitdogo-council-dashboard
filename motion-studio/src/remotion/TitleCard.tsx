import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const TitleCard = ({ title }: { title: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#0b1020", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ color: "white", fontFamily: "sans-serif", fontSize: 110, opacity, transform: `scale(${scale})` }}>
        {title}
      </h1>
    </AbsoluteFill>
  );
};
