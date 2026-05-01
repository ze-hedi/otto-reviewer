// Registry: node type → shape component + geometry constants
// To add a new node type: add one entry here and (if new geometry) a new shape component.
export const NODE_SHAPES = {
  agent: {
    component: 'wide-rect',
    width: 180,
    height: 68,
  },
  tool: {
    component: 'circle',
    diameter: 84,
  },
  artefact: {
    component: 'square',
    size: 80,
  },
};
