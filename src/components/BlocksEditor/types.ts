export type EditorNode = {
  id: string; // keep ids as strings for dnd-kit
  type: string;
  style?: any;
  children?: EditorNode[];
};
