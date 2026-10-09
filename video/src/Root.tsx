import { Composition } from "remotion";
import { FPS, TOTAL } from "./lib";
import { Video } from "./Video";

export function Root() {
  return (
    <>
      <Composition id="Landscape" component={Video} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} defaultProps={{ layout: "landscape" as const }} />
      <Composition id="Portrait" component={Video} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} defaultProps={{ layout: "portrait" as const }} />
    </>
  );
}
