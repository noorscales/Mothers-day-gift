import type React from "react";
import type { Visual } from "../types";
import { Bag, Bouquet, Perfume, Roses } from "./Gifts";
import { Hearts, Letter, Title } from "./Moments";
import type { VisualProps } from "./shared";

export const VISUALS: Record<Visual, React.FC<VisualProps>> = {
  roses: Roses,
  bouquet: Bouquet,
  bag: Bag,
  perfume: Perfume,
  letter: Letter,
  hearts: Hearts,
  title: Title,
};
