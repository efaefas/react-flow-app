import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
  SelectionMode,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type ReactFlowInstance,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import STATIC_WORKFLOW_DEFS from './islemTurleri.json';

const API_BASE_URL = 'http://localhost:3001/api';

const NODES_PER_COLUMN = 10;
const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 80;

type WorkflowDefFromDB = {
  id: string;
  ad: string;
  aciklama: string;
  x: number;
  y: number;
  type: 'box' | 'jump' | 'land';
  jumpLandLabel?: string;
  colorIndex?: number;
};

type EdgeFromDB = {
  id: string;
  source: string;
  target: string;
};

type WorkflowDataFromDB = {
  nodes: WorkflowDefFromDB[];
  edges: EdgeFromDB[];
};

type WorkflowDef = {
  ad?: string;
  aciklama?: string;
};

type BoxData = {
  nodeType: 'box';
  label: string;
  def: WorkflowDef;
  dbId?: string;
};

type JumpData = {
  nodeType: 'jump';
  label?: string;      // Keep for backwards compatibility
  landId?: string;     // Reference to connected land node
  colorIndex: number;
};

type LandData = {
  nodeType: 'land';
  label?: string;      // Keep for backwards compatibility
  nextNodeId?: string; // Node connected to this land (from edges)
  colorIndex: number;
};

type NodeData = BoxData | JumpData | LandData;

const JUMP_LAND_COLORS = [
  { jump: '#ff9800', land: '#4caf50', border: '#e65100', landBorder: '#2e7d32' }, 
  { jump: '#e91e63', land: '#9c27b0', border: '#ad1457', landBorder: '#6a1b9a' }, 
  { jump: '#00bcd4', land: '#009688', border: '#00838f', landBorder: '#00695c' }, 
  { jump: '#ffeb3b', land: '#cddc39', border: '#f9a825', landBorder: '#9e9d24' }, 
  { jump: '#ff5722', land: '#795548', border: '#d84315', landBorder: '#4e342e' }, 
  { jump: '#3f51b5', land: '#2196f3', border: '#283593', landBorder: '#1565c0' }, 
  { jump: '#f44336', land: '#e91e63', border: '#c62828', landBorder: '#ad1457' }, 
  { jump: '#8bc34a', land: '#00bcd4', border: '#558b2f', landBorder: '#00838f' }, 
];

function JumpNode({ data }: NodeProps<JumpData>) {
  const colorSet = JUMP_LAND_COLORS[data.colorIndex % JUMP_LAND_COLORS.length];
  
  return (
    <div
      style={{
        width: 60,
        height: 50,
        borderRadius: 8,
        background: colorSet.jump,
        border: `3px solid ${colorSet.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: 10,
        fontWeight: 700,
        color: '#fff',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10 }} />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 600, textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>JUMP</span>
    </div>
  );
}

function LandNode({ data }: NodeProps<LandData>) {
  const colorSet = JUMP_LAND_COLORS[data.colorIndex % JUMP_LAND_COLORS.length];
  
  return (
    <div
      style={{
        width: 60,
        height: 50,
        borderRadius: 8,
        background: colorSet.land,
        border: `3px solid ${colorSet.landBorder}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: 10,
        fontWeight: 700,
        color: '#fff',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>LAND</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10 }} />
    </div>
  );
}

function BoxNode({ data }: NodeProps<BoxData>) {
  return (
    <div
      style={{
        padding: 10,
        border: '1px solid #333',
        borderRadius: 8,
        background: '#3182dfff',
        width: 200,
        height: 40,
        textAlign: 'center',
        fontSize: "10px",
        overflowWrap: "anywhere",
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10 }} />
      <div style={{ fontWeight: 700 }}>{data?.label ?? ''}</div>
      <Handle type="source" position={Position.Right} style={{ width: 10, height: 10 }} />
    </div>
  );
}

function convertDBNodeToReactFlowNode(dbNode: WorkflowDefFromDB): Node<NodeData> {
  if (dbNode.type === 'jump') {
    return {
      id: dbNode.id,
      type: 'jump',
      position: { x: dbNode.x, y: dbNode.y },
      data: {
        nodeType: 'jump',
        label: dbNode.jumpLandLabel || 'A',
        colorIndex: dbNode.colorIndex || 0,
      },
    };
  }
  
  if (dbNode.type === 'land') {
    return {
      id: dbNode.id,
      type: 'land',
      position: { x: dbNode.x, y: dbNode.y },
      data: {
        nodeType: 'land',
        label: dbNode.jumpLandLabel || 'A',
        colorIndex: dbNode.colorIndex || 0,
      },
    };
  }
  
  return {
    id: dbNode.id,
    type: 'box',
    position: { x: dbNode.x, y: dbNode.y },
    data: {
      nodeType: 'box',
      label: dbNode.ad,
      def: { ad: dbNode.ad, aciklama: dbNode.aciklama },
      dbId: dbNode.id,
    },
  };
}

// Get token from URL query string
function getTokenFromURL(): string | null {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('t');
}

export default function App() {
  const rf = useRef<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo<NodeTypes>(() => ({ 
    box: BoxNode,
    jump: JumpNode,
    land: LandNode,
  }), []);

  // Token authentication
  const [token] = useState<string | null>(() => getTokenFromURL());
  const [bypassAuth, setBypassAuth] = useState(false);
  const isUnauthorized = !token && !bypassAuth;

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [, setDataSource] = useState<'static' | 'api' | null>(null);
  
  // Derived: templates are nodes with x=-1, y=-1 (box type only)
  const templates = useMemo(() => 
    nodes.filter(n => 
      n.position.x === -1 && n.position.y === -1 && n.type === 'box'
    ).map(n => {
      const boxData = n.data as BoxData;
      return {
        id: n.id,
        ad: boxData.def?.ad || boxData.label || '',
        aciklama: boxData.def?.aciklama || '',
      };
    }), [nodes]);
  
  // Derived: visible nodes are those with valid positions (x >= 0, y >= 0)
  const visibleNodes = useMemo(() => 
    nodes.filter(n => n.position.x >= 0 && n.position.y >= 0), [nodes]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [formAd, setFormAd] = useState('');
  const [formAciklama, setFormAciklama] = useState('');
  const [isJumpLandModalOpen, setIsJumpLandModalOpen] = useState(false);
  const [jumpLandColorIndex, setJumpLandColorIndex] = useState(0);
  const [selectedLandId, setSelectedLandId] = useState<string | null>(null);
  const [editingNodeType, setEditingNodeType] = useState<'jump' | 'land' | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  }>({ visible: false, x: 0, y: 0, flowX: 0, flowY: 0 });
  const [nodeMenuHovered, setNodeMenuHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // Don't fetch if no token (unauthorized)
    if (!token) {
      setIsLoading(false);
      return;
    }

    const fetchWorkflowData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`${API_BASE_URL}/workflow?t=${encodeURIComponent(token)}`);
        
        if (response.status === 401 || response.status === 403) {
          throw new Error('Yetkisiz erişim. Token geçersiz.');
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch workflow data`);
        }
        
        const data: WorkflowDataFromDB = await response.json();
        
        // Store ALL nodes (including templates with x=-1, y=-1) in single array
        const allNodes: Node<NodeData>[] = data.nodes.map(node => convertDBNodeToReactFlowNode(node));
        
        setNodes(allNodes);
        setEdges(data.edges.map(e => ({ ...e, animated: true })));
        setDataSource('api');
        
        setTimeout(() => {
          rf.current?.fitView({ padding: 0.2 });
        }, 100);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
        console.error('Failed to load workflow:', err);
        
        setNodes([]);
        setEdges([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkflowData();
  }, [token, setNodes, setEdges]);

  const loadStaticData = useCallback(() => {
    // Create template nodes with x=-1, y=-1 (appear in Nodelar dropdown, not on canvas)
    const templateNodes: Node<NodeData>[] = STATIC_WORKFLOW_DEFS.map((def, i) => ({
      id: `template-${i + 1}`,
      type: 'box',
      position: { x: -1, y: -1 },  // Template marker
      data: { 
        nodeType: 'box' as const, 
        label: def.ad ?? '', 
        def: { ad: def.ad, aciklama: def.aciklama } 
      },
    }));

    // Also create visible nodes on canvas (arranged in columns)
    const visibleStaticNodes: Node<NodeData>[] = STATIC_WORKFLOW_DEFS.map((def, i) => {
      const column = Math.floor(i / NODES_PER_COLUMN);
      const row = i % NODES_PER_COLUMN;
      
      return {
        id: crypto?.randomUUID?.() ?? String(Date.now() + i),
        type: 'box',
        position: { x: 100 + column * COLUMN_WIDTH, y: 100 + row * ROW_HEIGHT },
        data: { 
          nodeType: 'box' as const, 
          label: def.ad ?? '', 
          def: { ad: def.ad, aciklama: def.aciklama } 
        },
      };
    });

    setBypassAuth(true);
    // Store both templates (x=-1, y=-1) and visible nodes in single array
    setNodes([...templateNodes, ...visibleStaticNodes]);
    setEdges([]);
    setDataSource('static');
    setError(null);
    setIsLoading(false);

    setTimeout(() => {
      rf.current?.fitView({ padding: 0.2 });
    }, 100);
  }, [setNodes, setEdges]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rf.current = instance;
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      const edgeId = crypto?.randomUUID?.() ?? `edge-${Date.now()}`;
      setEdges((eds) => addEdge({ ...connection, id: edgeId, animated: true }, eds));
    },
    [setEdges]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();

      const instance = rf.current;
      if (!instance) return;

      const flowPosition = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setContextMenu({
        visible: true,
        x: event.clientX,
        y: event.clientY,
        flowX: flowPosition.x,
        flowY: flowPosition.y,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
    setNodeMenuHovered(false);
  }, []);

  // Get all land nodes with display names (Land 1, Land 2, etc.)
  const getLandNodesWithLabels = useCallback(() => {
    const landNodes = nodes.filter((n) => n.type === 'land' && n.data.nodeType === 'land');
    return landNodes.map((n, index) => ({
      id: n.id,
      displayName: `Land ${index + 1}`,
      colorIndex: (n.data as LandData).colorIndex,
    }));
  }, [nodes]);

  // Get available (unconnected) land nodes for jump selection
  const getAvailableLandNodes = useCallback(() => {
    const allLands = getLandNodesWithLabels();
    const connectedLandIds = new Set(
      nodes
        .filter((n) => n.type === 'jump' && n.data.nodeType === 'jump')
        .map((n) => (n.data as JumpData).landId)
        .filter(Boolean)
    );
    // Include the currently selected land (for editing existing jump)
    return allLands.filter((land) => !connectedLandIds.has(land.id) || land.id === selectedLandId);
  }, [nodes, getLandNodesWithLabels, selectedLandId]);

  const addNewEmptyNode = useCallback(() => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());

    const newNode: Node<BoxData> = {
      id,
      type: 'box',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: {
        nodeType: 'box',
        label: 'Yeni İşlem',
        def: { ad: 'Yeni İşlem', aciklama: '' },
      },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, setNodes, closeContextMenu]);

  const addNodeFromTemplate = useCallback((template: { id: string; ad: string; aciklama: string }) => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());
    
    const newNode: Node<BoxData> = {
      id,
      type: 'box',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: {
        nodeType: 'box',
        label: template.ad,
        def: { ad: template.ad, aciklama: template.aciklama },
        dbId: template.id,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, setNodes, closeContextMenu]);

  const addJumpNode = useCallback(() => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());
    // Get next available color index
    const usedIndices = new Set(
      nodes
        .filter((n) => n.type === 'jump' || n.type === 'land')
        .map((n) => (n.data as JumpData | LandData).colorIndex)
    );
    let colorIndex = 0;
    for (let i = 0; i < JUMP_LAND_COLORS.length; i++) {
      if (!usedIndices.has(i)) {
        colorIndex = i;
        break;
      }
    }

    const newNode: Node<JumpData> = {
      id,
      type: 'jump',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: { nodeType: 'jump', colorIndex },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, nodes, setNodes, closeContextMenu]);

  const addLandNode = useCallback(() => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());
    // Get next available color index
    const usedIndices = new Set(
      nodes
        .filter((n) => n.type === 'jump' || n.type === 'land')
        .map((n) => (n.data as JumpData | LandData).colorIndex)
    );
    let colorIndex = 0;
    for (let i = 0; i < JUMP_LAND_COLORS.length; i++) {
      if (!usedIndices.has(i)) {
        colorIndex = i;
        break;
      }
    }

    const newNode: Node<LandData> = {
      id,
      type: 'land',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: { nodeType: 'land', colorIndex },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, nodes, setNodes, closeContextMenu]);

  const saveToBackend = useCallback(async () => {
    if (!token) {
      alert('❌ Token bulunamadı. Kaydetme yapılamaz.');
      return;
    }

    try {
      const placedNodesData: WorkflowDefFromDB[] = nodes.map((n) => {
        if (n.data.nodeType === 'jump') {
          const jumpData = n.data as JumpData;
          return {
            id: n.id,
            ad: '',
            aciklama: '',
            x: n.position.x,
            y: n.position.y,
            type: 'jump' as const,
            jumpLandLabel: jumpData.label,
            colorIndex: jumpData.colorIndex,
          };
        }
        if (n.data.nodeType === 'land') {
          const landData = n.data as LandData;
          return {
            id: n.id,
            ad: '',
            aciklama: '',
            x: n.position.x,
            y: n.position.y,
            type: 'land' as const,
            jumpLandLabel: landData.label,
            colorIndex: landData.colorIndex,
          };
        }
        const boxData = n.data as BoxData;
        return {
          id: n.id,
          ad: boxData.def?.ad || boxData.label || '',
          aciklama: boxData.def?.aciklama || '',
          x: n.position.x,
          y: n.position.y,
          type: 'box' as const,
        };
      });

      const edgesData: EdgeFromDB[] = edges.map((e) => ({
        id: e.id || crypto?.randomUUID?.() || `edge-${Date.now()}`,
        source: e.source,
        target: e.target,
      }));

      const response = await fetch(`${API_BASE_URL}/workflow?t=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nodes: placedNodesData,  // All nodes including templates (x=-1, y=-1)
          edges: edgesData,
        }),
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error('Yetkisiz erişim. Token geçersiz.');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to save`);
      }

      alert('✅ Başarıyla kaydedildi!');
      closeContextMenu();
    } catch (err) {
      alert('❌ Kaydetme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
      console.error('Save error:', err);
    }
  }, [token, nodes, edges, closeContextMenu]);

  const exportJson = useCallback(() => {
    const nodeIdToAd = new Map<string, string>();
    nodes.forEach((n) => {
      if (n.type === 'box' && n.data.nodeType === 'box') {
        const ad = n.data.def?.ad || n.data.label || n.id;
        nodeIdToAd.set(n.id, ad);
      }
    });

    const boxNodes = nodes
      .filter((n) => n.type === 'box' && n.data.nodeType === 'box')
      .map((n) => {
        const boxData = n.data as BoxData;
        return {
          id: n.id,
          type: 'box',
          x: n.position?.x ?? 0,
          y: n.position?.y ?? 0,
          ad: boxData.def?.ad || boxData.label || '',
          aciklama: boxData.def?.aciklama || '',
        };
      });

    const jumpNodes = nodes
      .filter((n) => n.type === 'jump' && n.data.nodeType === 'jump')
      .map((n) => {
        const jumpData = n.data as JumpData;
        return {
          id: n.id,
          type: 'jump',
          x: n.position?.x ?? 0,
          y: n.position?.y ?? 0,
          land: jumpData.landId || null,  // Reference to connected land node
          colorIndex: jumpData.colorIndex,
        };
      });

    // Build a map of land node ID -> connected target node ID (from edges)
    const landNextNodeMap = new Map<string, string>();
    edges.forEach((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source);
      if (sourceNode?.type === 'land') {
        landNextNodeMap.set(e.source, e.target);
      }
    });

    const landNodes = nodes
      .filter((n) => n.type === 'land' && n.data.nodeType === 'land')
      .map((n) => {
        const landData = n.data as LandData;
        return {
          id: n.id,
          type: 'land',
          x: n.position?.x ?? 0,
          y: n.position?.y ?? 0,
          nextNode: landNextNodeMap.get(n.id) || null,  // Node connected to this land
          colorIndex: landData.colorIndex,
        };
      });

    // Jump links are now stored directly in jump nodes via 'land' field
    const jumpLinks: { jumpNodeId: string; landNodeId: string }[] = [];
    jumpNodes.forEach((jump) => {
      if (jump.land) {
        jumpLinks.push({
          jumpNodeId: jump.id,
          landNodeId: jump.land,
        });
      }
    });

    // All nodes in single array (including templates with x=-1, y=-1)
    const exportData = {
      nodes: [...boxNodes, ...jumpNodes, ...landNodes],
      edges: edges.map((e) => ({
        // Always use UUID4 for edge IDs (replace any reactflow-generated IDs)
        id: crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: e.source,
        target: e.target,
        islem_tur: nodeIdToAd.get(e.source) || e.source,
        sonraki_islem_tur: nodeIdToAd.get(e.target) || e.target,
      })),
      jumpLinks,
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'workflow-export.json';
    a.click();

    URL.revokeObjectURL(url);
    closeContextMenu();
  }, [nodes, edges, closeContextMenu]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
    closeContextMenu();
  }, [closeContextMenu]);

  const importJson = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);

          if (data.nodes && Array.isArray(data.nodes)) {
            // All nodes go into single array (including templates with x=-1, y=-1)
            const allNodes: Node<NodeData>[] = [];

            data.nodes.forEach((n: any, index: number) => {
              const x = n.x ?? n.position?.x;
              const y = n.y ?? n.position?.y;
              
              // Determine position (x=-1, y=-1 for templates, otherwise actual position)
              const position = { 
                x: typeof x === 'number' ? x : 100 + (index % 5) * 250, 
                y: typeof y === 'number' ? y : 100 + Math.floor(index / 5) * 100 
              };

              if (n.type === 'jump') {
                allNodes.push({
                  id: n.id || crypto?.randomUUID?.() || String(Date.now() + index),
                  type: 'jump',
                  position,
                  data: {
                    nodeType: 'jump' as const,
                    label: n.label,  // Keep for backwards compatibility
                    landId: n.land || undefined,  // New format: direct land reference
                    colorIndex: n.colorIndex ?? 0,
                  },
                });
                return;
              }

              if (n.type === 'land') {
                allNodes.push({
                  id: n.id || crypto?.randomUUID?.() || String(Date.now() + index),
                  type: 'land',
                  position,
                  data: {
                    nodeType: 'land' as const,
                    label: n.label,  // Keep for backwards compatibility
                    nextNodeId: n.nextNode || undefined,  // New format: next node reference
                    colorIndex: n.colorIndex ?? 0,
                  },
                });
                return;
              }

              const ad = n.ad || n.data?.ad || n.data?.def?.ad || n.data?.label || 'Imported Node';
              const aciklama = n.aciklama || n.data?.aciklama || n.data?.def?.aciklama || '';

              allNodes.push({
                id: n.id || crypto?.randomUUID?.() || String(Date.now() + index),
                type: 'box',
                position,
                data: {
                  nodeType: 'box' as const,
                  label: ad,
                  def: { ad, aciklama } as WorkflowDef,
                  dbId: n.id,
                },
              });
            });

            // Also support explicit templates array (for backwards compatibility)
            if (data.templates && Array.isArray(data.templates)) {
              data.templates.forEach((t: any, i: number) => {
                const ad = t.ad || '';
                const aciklama = t.aciklama || '';
                allNodes.push({
                  id: t.id || `template-explicit-${i}`,
                  type: 'box',
                  position: { x: -1, y: -1 },  // Template marker
                  data: {
                    nodeType: 'box' as const,
                    label: ad,
                    def: { ad, aciklama } as WorkflowDef,
                  },
                });
              });
            }

            setNodes(allNodes);

            const adToNodeId = new Map<string, string>();
            allNodes.forEach((n) => {
              if (n.type === 'box' && n.data.nodeType === 'box') {
                const boxData = n.data as BoxData;
                const ad = boxData.def?.ad || boxData.label;
                if (ad) {
                  adToNodeId.set(ad, n.id);
                }
              }
            });

            if (data.edges && Array.isArray(data.edges)) {
              const importedEdges: Edge[] = data.edges
                .map((e: any) => {
                  const sourceId = e.source || adToNodeId.get(e.islem_tur);
                  const targetId = e.target || adToNodeId.get(e.sonraki_islem_tur);

                  if (!sourceId || !targetId) return null;

                  // Use provided UUID or generate new one (ensures UUID4 format)
                  const isValidUUID = e.id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e.id);
                  const edgeId = isValidUUID ? e.id : (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

                  return {
                    id: edgeId,
                    source: sourceId,
                    target: targetId,
                    animated: true,
                  };
                })
                .filter(Boolean) as Edge[];

              setEdges(importedEdges);
            }

            setTimeout(() => {
              rf.current?.fitView({ padding: 0.2 });
            }, 100);
          }
        } catch (err) {
          console.error('JSON import error:', err);
          alert('JSON dosyası okunamadı. Lütfen geçerli bir JSON dosyası seçin.');
        }
      };

      reader.readAsText(file);
      event.target.value = '';
    },
    [setNodes, setEdges]
  );

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<NodeData>) => {
    setEditingNodeId(node.id);

    if (node.type === 'jump' || node.type === 'land') {
      const jumpLandData = node.data as JumpData | LandData;
      setJumpLandColorIndex(jumpLandData.colorIndex || 0);
      setEditingNodeType(node.type as 'jump' | 'land');
      
      // For jump nodes, set the selected land ID
      if (node.type === 'jump') {
        const jumpData = node.data as JumpData;
        setSelectedLandId(jumpData.landId || null);
      } else {
        setSelectedLandId(null);
      }
      
      setIsJumpLandModalOpen(true);
    } else {
      const boxData = node.data as BoxData;
      setFormAd(boxData.def?.ad ?? '');
      setFormAciklama(boxData.def?.aciklama ?? '');
      setIsModalOpen(true);
    }
  }, []);

  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges]
  );

  const onNodesDelete = useCallback(
    (_deletedNodes: Node<NodeData>[]) => {},
    []
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingNodeId(null);
  }, []);

  const closeJumpLandModal = useCallback(() => {
    setIsJumpLandModalOpen(false);
    setEditingNodeId(null);
    setEditingNodeType(null);
    setSelectedLandId(null);
  }, []);

  const saveNode = useCallback(() => {
    if (!editingNodeId) return;

    const adTrimmed = formAd.trim() || 'ISIMSIZ';
    const aciklamaVal = formAciklama;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== editingNodeId) return n;
        if (n.data.nodeType !== 'box') return n;

        const boxData = n.data as BoxData;
        const oldDef = boxData.def;

        const newDef = {
          ...oldDef,
          ad: adTrimmed,
          aciklama: aciklamaVal,
        } as WorkflowDef;

        return {
          ...n,
          data: {
            ...n.data,
            label: adTrimmed,
            def: newDef,
          },
        };
      })
    );

    closeModal();
  }, [editingNodeId, formAd, formAciklama, setNodes, closeModal]);

  const saveJumpLandNode = useCallback(() => {
    if (!editingNodeId) return;

    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === editingNodeId) {
          if (n.data.nodeType === 'jump') {
            // For Jump: save selected land ID and color
            return {
              ...n,
              data: {
                nodeType: 'jump' as const,
                landId: selectedLandId || undefined,
                colorIndex: jumpLandColorIndex,
              },
            };
          } else if (n.data.nodeType === 'land') {
            // For Land: just save color (no label needed)
            return {
              ...n,
              data: {
                nodeType: 'land' as const,
                colorIndex: jumpLandColorIndex,
              },
            };
          }
        }
        return n;
      });
    });

    closeJumpLandModal();
  }, [editingNodeId, selectedLandId, jumpLandColorIndex, setNodes, closeJumpLandModal]);

  const onModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter') saveNode();
    },
    [closeModal, saveNode]
  );

  const onJumpLandModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closeJumpLandModal();
      if (e.key === 'Enter') saveJumpLandNode();
    },
    [closeJumpLandModal, saveJumpLandNode]
  );

  // Show unauthorized page if no token - but allow static data or new start
  if (isUnauthorized && !nodes.length) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#fff',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div style={{ fontSize: 72 }}>🔒</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Yetkisiz Erişim</div>
        <div style={{ fontSize: 16, color: '#888', textAlign: 'center', maxWidth: 400, marginBottom: 8 }}>
          Dinamik veri için geçerli bir token gereklidir.
          <br />
          URL'de <code style={{ background: '#333', padding: '2px 6px', borderRadius: 4 }}>?t=TOKEN</code> parametresi bulunamadı.
        </div>
        <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>
          Aşağıdaki seçeneklerden birini kullanabilirsiniz:
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => {
              setBypassAuth(true);
              setIsLoading(false);
              setNodes([]);
              setEdges([]);
              setDataSource(null);
            }}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: '2px solid #4fc3f7',
              background: 'transparent',
              color: '#4fc3f7',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Yeni
          </button>
          <button
            onClick={loadStaticData}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#ff9800',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Statik Veri ile Devam Et
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#fff',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: '4px solid #4fc3f7',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 18 }}>Yükleniyor...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a2e',
          color: '#fff',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 18, color: '#ff5252' }}>Hata: {error}</div>
        <div style={{ fontSize: 14, color: '#aaa', marginTop: 8 }}>
          Aşağıdaki seçeneklerden birini kullanabilirsiniz:
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#4fc3f7',
              color: '#1a1a2e',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Dinamik (Tekrar Dene)
          </button>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(false);
            }}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: '2px solid #4fc3f7',
              background: 'transparent',
              color: '#4fc3f7',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Yeni
          </button>
          <button
            onClick={loadStaticData}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: 'none',
              background: '#ff9800',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Statik Veri ile Devam Et
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }} onClick={closeContextMenu}>
      <ReactFlow
        onInit={onInit}
        nodeTypes={nodeTypes}
        nodes={visibleNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onConnect={onConnect}
        onPaneContextMenu={onPaneContextMenu}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        fitView
      >
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'jump') {
              const jumpData = node.data as JumpData;
              const colorSet = JUMP_LAND_COLORS[jumpData.colorIndex % JUMP_LAND_COLORS.length];
              return colorSet.jump;
            }
            if (node.type === 'land') {
              const landData = node.data as LandData;
              const colorSet = JUMP_LAND_COLORS[landData.colorIndex % JUMP_LAND_COLORS.length];
              return colorSet.land;
            }
            return '#4fc3f7';
          }}
          nodeStrokeColor="#0288d1"
          nodeStrokeWidth={3}
          maskColor="rgba(0, 0, 0, 0.3)"
          zoomable
          pannable
          style={{
            backgroundColor: '#1a1a2e',
            border: '2px solid #4fc3f7',
            borderRadius: 8,
          }}
        />
        <Controls />
        <Background />
      </ReactFlow>

      {isModalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onModalKeyDown}
            tabIndex={-1}
            style={{
              width: 640,
              maxWidth: '100%',
              background: '#3182dfff',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              İşlem Tür
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>ad</span>
                <input
                  value={formAd}
                  onChange={(e) => setFormAd(e.target.value)}
                  placeholder="Örn: OI_KONTROL_TUTANAGI_ILK_KONTROL"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    outline: 'none',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>aciklama</span>
                <textarea
                  value={formAciklama}
                  onChange={(e) => setFormAciklama(e.target.value)}
                  rows={4}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  onClick={closeModal}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #999',
                    background: '#e0e0e0',
                    color: '#333',
                    cursor: 'pointer',
                  }}
                >
                  İptal
                </button>

                <button
                  onClick={saveNode}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #333',
                    background: '#333',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Kaydet
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.7 }}>İpucu: Enter = Kaydet, Esc = Kapat</div>
            </div>
          </div>
        </div>
      )}

      {isJumpLandModalOpen && (
        <div
          onClick={closeJumpLandModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onJumpLandModalKeyDown}
            tabIndex={-1}
            style={{
              width: 480,
              maxWidth: '100%',
              background: editingNodeType === 'jump' 
                ? JUMP_LAND_COLORS[jumpLandColorIndex % JUMP_LAND_COLORS.length].jump
                : JUMP_LAND_COLORS[jumpLandColorIndex % JUMP_LAND_COLORS.length].land,
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#fff' }}>
              {editingNodeType === 'jump' ? '⬆️ Jump Node' : '⬇️ Land Node'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* For Jump nodes: Show Land selection dropdown */}
              {editingNodeType === 'jump' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Bağlı Land Node</span>
                  <select
                    value={selectedLandId || ''}
                    onChange={(e) => {
                      setSelectedLandId(e.target.value || null);
                      // Match color with selected land
                      if (e.target.value) {
                        const landNode = nodes.find((n) => n.id === e.target.value);
                        if (landNode && landNode.data.nodeType === 'land') {
                          setJumpLandColorIndex((landNode.data as LandData).colorIndex);
                        }
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #ccc',
                      outline: 'none',
                      fontSize: 14,
                    }}
                  >
                    <option value="">-- Land seçin --</option>
                    {getAvailableLandNodes().map((land) => (
                      <option key={land.id} value={land.id}>
                        {land.displayName}
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                    Bu Jump'ın atlayacağı Land node'unu seçin
                  </span>
                  {getAvailableLandNodes().length === 0 && (
                    <span style={{ fontSize: 11, color: '#ffeb3b' }}>
                      ⚠️ Bağlanabilecek Land node yok. Önce Land ekleyin.
                    </span>
                  )}
                </label>
              )}

              {/* For Land nodes: Just info text */}
              {editingNodeType === 'land' && (
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>
                    Land node'ları Jump node'larından gelen bağlantıları alır.
                  </span>
                </div>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Renk</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {JUMP_LAND_COLORS.map((colorSet, index) => (
                    <button
                      key={index}
                      onClick={() => setJumpLandColorIndex(index)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: editingNodeType === 'jump' ? colorSet.jump : colorSet.land,
                        border: jumpLandColorIndex === index 
                          ? '3px solid #fff' 
                          : '2px solid rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        boxShadow: jumpLandColorIndex === index 
                          ? '0 0 10px rgba(255,255,255,0.5)' 
                          : 'none',
                      }}
                    />
                  ))}
                </div>
              </label>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  onClick={closeJumpLandModal}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.5)',
                    background: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  İptal
                </button>

                <button
                  onClick={saveJumpLandNode}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #333',
                    background: '#333',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Kaydet
                </button>
              </div>

              <div style={{ fontSize: 12, opacity: 0.8, color: '#fff' }}>
                İpucu: Enter = Kaydet, Esc = Kapat
              </div>
            </div>
          </div>
        </div>
      )}

      {contextMenu.visible && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#1a1a2e',
            border: '1px solid #4fc3f7',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            zIndex: 10000,
            minWidth: 200,
            overflow: 'visible',
          }}
        >
          {/* Yeni Node Ekle - standalone button */}
          <button
            onClick={addNewEmptyNode}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#2a2a4e';
              setNodeMenuHovered(false);
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>➕</span>
            Yeni Node Ekle
          </button>

          <div style={{ height: 1, background: '#4fc3f7', opacity: 0.3 }} />

          {/* Nodelar - with flyout submenu */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setNodeMenuHovered(true)}
            onMouseLeave={() => setNodeMenuHovered(false)}
          >
            <button
              style={{
                width: '100%',
                padding: '12px 16px',
                background: nodeMenuHovered ? '#2a2a4e' : 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: 14,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>📦</span>
                Nodelar
              </span>
              <span style={{ fontSize: 12, color: '#888' }}>▶</span>
            </button>

            {/* Flyout submenu */}
            {nodeMenuHovered && (
              <div
                style={{
                  position: 'absolute',
                  left: '100%',
                  top: 0,
                  background: '#1a1a2e',
                  border: '1px solid #4fc3f7',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                  minWidth: 250,
                  maxHeight: 400,
                  overflowY: 'auto',
                  marginLeft: 4,
                }}
              >
                {templates.length === 0 ? (
                  <div
                    style={{
                      padding: '12px 16px',
                      color: '#888',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    Henüz node yüklenmedi
                  </div>
                ) : (
                  templates.map((template, index) => (
                    <button
                      key={`${template.id}-${index}`}
                      onClick={() => addNodeFromTemplate(template)}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: 12,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(79, 195, 247, 0.1)',
                        wordBreak: 'break-all',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#3a3a6e')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      title={template.aciklama}
                    >
                      {template.ad}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div style={{ height: 1, background: '#4fc3f7', opacity: 0.3 }} />

          <button
            onClick={addJumpNode}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>⬆️</span>
            Jump Node Ekle
            <span style={{ 
              marginLeft: 'auto', 
              fontSize: 10, 
              background: '#ff9800', 
              padding: '2px 6px', 
              borderRadius: 4 
            }}>
              Atlama
            </span>
          </button>

          <button
            onClick={addLandNode}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>⬇️</span>
            Land Node Ekle
            <span style={{ 
              marginLeft: 'auto', 
              fontSize: 10, 
              background: '#4caf50', 
              padding: '2px 6px', 
              borderRadius: 4 
            }}>
              İniş
            </span>
          </button>

          <div style={{ height: 1, background: '#4fc3f7', opacity: 0.3 }} />

          <button
            onClick={saveToBackend}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>💾</span>
            Sunucuya Kaydet
          </button>

          <div style={{ height: 1, background: '#4fc3f7', opacity: 0.3 }} />

          <button
            onClick={exportJson}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>📤</span>
            JSON Olarak Dışa Aktar
          </button>
          <div style={{ height: 1, background: '#4fc3f7', opacity: 0.3 }} />
          <button
            onClick={handleImportClick}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 14,
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 18 }}>📥</span>
            JSON İçe Aktar
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={importJson}
        style={{ display: 'none' }}
      />
    </div>
  );
}
