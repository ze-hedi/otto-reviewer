// runtime/workflow-scheduler.ts
// Kahn's algorithm — builds a leveled execution queue from the workflow DAG.

interface WorkflowNode {
  id: string;
  type: string;
  name?: string;
  [key: string]: any;
}

interface WorkflowConnection {
  from: string;
  to: string;
  linkType?: string;
  [key: string]: any;
}

/**
 * Builds a parallel execution queue using topological sort (Kahn's algorithm).
 * Each level contains nodes that can run in parallel (same depth, independent).
 * tool-link connections are excluded — they represent bindings, not execution flow.
 *
 * Returns an array of levels, each level being an array of node objects.
 * Throws if a cycle is detected.
 */
export function buildExecutionQueue(
  nodes: WorkflowNode[],
  connections: WorkflowConnection[]
): WorkflowNode[][] {
  // Only consider execution-flow edges (exclude tool-links)
  const execEdges = connections.filter((c) => c.linkType !== 'tool-link');

  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of execEdges) {
    // Only count edges between known nodes
    if (!inDegree.has(edge.from) || !inDegree.has(edge.to)) continue;
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, inDegree.get(edge.to)! + 1);
  }

  // Kahn's with level grouping
  const queue: WorkflowNode[][] = [];
  let currentLevel = nodes.filter((n) => inDegree.get(n.id) === 0);

  let visited = 0;

  while (currentLevel.length > 0) {
    queue.push(currentLevel);
    visited += currentLevel.length;

    const nextLevel: WorkflowNode[] = [];

    for (const node of currentLevel) {
      for (const neighborId of adjacency.get(node.id)!) {
        const newDegree = inDegree.get(neighborId)! - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) {
          const neighborNode = nodes.find((n) => n.id === neighborId);
          if (neighborNode) nextLevel.push(neighborNode);
        }
      }
    }

    currentLevel = nextLevel;
  }

  if (visited < nodes.length) {
    throw new Error('Cycle detected in workflow graph — cannot determine execution order');
  }

  return queue;
}
