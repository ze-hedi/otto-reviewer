import React from 'react';
import WideRectShape from './shapes/WideRectShape';
import CircleShape   from './shapes/CircleShape';
import SquareShape   from './shapes/SquareShape';
import { NODE_SHAPES } from './shapes.config';

const SHAPE_COMPONENTS = {
  'wide-rect': WideRectShape,
  'circle':    CircleShape,
  'square':    SquareShape,
};

// Pure dispatcher: reads node.type → delegates to the right shape component.
// To add a new node type, register it in shapes.config.js and (if needed) add a shape component.
const NodeShape = ({ node, onDelete, onHandleMouseDown }) => {
  const config = NODE_SHAPES[node.type];
  if (!config) return null;
  const Shape = SHAPE_COMPONENTS[config.component];
  return <Shape node={node} config={config} onDelete={onDelete} onHandleMouseDown={onHandleMouseDown} />;
};

export default NodeShape;
