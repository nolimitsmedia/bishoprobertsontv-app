// src/components/BlocksEditor/core/registry.ts
import SectionView from "../views/SectionView";
import ColumnsView from "../views/ColumnsView";
import ColumnView from "../views/ColumnView";

//If you already have primitives/composites, import & register them:
import Heading from "../views/primitives/Heading";
import Text from "../views/primitives/Text";
import ImageView from "../views/primitives/Image";
import ButtonView from "../views/primitives/Button";
import DividerView from "../views/primitives/Divider";
// import SpacerView from "../views/primitives/Spacer";
import Gallery from "../views/composites/Gallery";
import Carousel from "../views/composites/Carousel";
import Accordion from "../views/composites/Accordion";
import Tabs from "../views/composites/Tabs";

type ViewEntry = {
  label: string;
  View: React.ComponentType<any>;
};

export const REGISTRY: Record<string, ViewEntry> = {
  section: { label: "Section", View: SectionView },
  columns: { label: "Columns", View: ColumnsView },
  column: { label: "Column", View: ColumnView },

  // Uncomment as components exist:
  heading: { label: "Heading", View: Heading },
  text: { label: "Text", View: Text },
  image: { label: "Image", View: ImageView },
  button: { label: "Button", View: ButtonView },
  divider: { label: "Divider", View: DividerView },
  // spacer:  { label: "Spacer",  View: SpacerView },
  gallery: { label: "Gallery", View: Gallery },
  carousel: { label: "Carousel", View: Carousel },
  accordion: { label: "Accordion", View: Accordion },
  tabs: { label: "Tabs", View: Tabs },
};
