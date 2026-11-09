import { Composition } from "remotion";
import { TradingReel } from "./trading/TradingReel";
import tradingSample from "./trading/sample-timeline.json";
import { MothersDay } from "./MothersDay";
import sample from "./sample-timeline.json";
import type { Timeline } from "./types";

// Props come from build/timeline.json (`--props`); the sample keeps Studio usable.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="MothersDay"
      component={MothersDay}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={(sample as Timeline).durationInFrames}
      defaultProps={sample as Timeline}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
      })}
    />
    <Composition
      id="TradingReel"
      component={TradingReel}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={(tradingSample as Timeline).durationInFrames}
      defaultProps={tradingSample as Timeline}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.durationInFrames,
        fps: props.fps,
      })}
    />
  </>
);
