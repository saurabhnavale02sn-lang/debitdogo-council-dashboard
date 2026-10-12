import { Composition } from "remotion";
import { TitleCard } from "./TitleCard";

export const Root = () => (
  <Composition
    id="TitleCard"
    component={TitleCard}
    durationInFrames={90}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{ title: "Motion Studio" }}
  />
);
