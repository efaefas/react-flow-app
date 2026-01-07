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
  label: string;
  colorIndex: number;
};

type LandData = {
  nodeType: 'land';
  label: string;
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
        width: 70,
        height: 50,
        borderRadius: 8,
        background: colorSet.jump,
        border: `3px solid ${colorSet.border}`,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        userSelect: 'none',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 10, height: 10 }} />
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span style={{ fontSize: 14, fontWeight: 800, textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>{data.label}</span>
    </div>
  );
}

function LandNode({ data }: NodeProps<LandData>) {
  const colorSet = JUMP_LAND_COLORS[data.colorIndex % JUMP_LAND_COLORS.length];
  
  return (
    <div
      style={{
        width: 70,
        height: 50,
        borderRadius: 8,
        background: colorSet.land,
        border: `3px solid ${colorSet.landBorder}`,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 800, textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}>{data.label}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

export default function App() {
  const rf = useRef<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo<NodeTypes>(() => ({ 
    box: BoxNode,
    jump: JumpNode,
    land: LandNode,
  }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowDefFromDB[]>([]);
  const [, setDataSource] = useState<'static' | 'api' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [formAd, setFormAd] = useState('');
  const [formAciklama, setFormAciklama] = useState('');
  const [isJumpLandModalOpen, setIsJumpLandModalOpen] = useState(false);
  const [jumpLandLabel, setJumpLandLabel] = useState('');
  const [jumpLandColorIndex, setJumpLandColorIndex] = useState(0);
  const [editingNodeType, setEditingNodeType] = useState<'jump' | 'land' | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  }>({ visible: false, x: 0, y: 0, flowX: 0, flowY: 0 });
  const [showNodeTypeSelector, setShowNodeTypeSelector] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchWorkflowData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch(`${API_BASE_URL}/workflow`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch workflow data`);
        }
        
        const data: WorkflowDataFromDB = await response.json();
        
        const placedNodes: Node<NodeData>[] = [];
        const templates: WorkflowDefFromDB[] = [];
        
        data.nodes.forEach((node) => {
          if (node.x >= 0 && node.y >= 0) {
            placedNodes.push(convertDBNodeToReactFlowNode(node));
          }
          if (node.type === 'box') {
            templates.push(node);
          }
        });
        
        setNodes(placedNodes);
        setEdges(data.edges.map(e => ({ ...e, animated: true })));
        setWorkflowTemplates(templates);
        setDataSource('api');
        
        setTimeout(() => {
          rf.current?.fitView({ padding: 0.2 });
        }, 100);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata');
        console.error('Failed to load workflow:', err);
        
        setNodes([]);
        setEdges([]);
        setWorkflowTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkflowData();
  }, [setNodes, setEdges]);

  const loadStaticData = useCallback(() => {
    const staticTemplates: WorkflowDefFromDB[] = STATIC_WORKFLOW_DEFS.map((def, i) => ({
      id: `template-${i + 1}`,
      ad: def.ad ?? '',
      aciklama: def.aciklama ?? '',
      x: -1,
      y: -1,
      type: 'box' as const,
    }));

    const staticNodes: Node<NodeData>[] = STATIC_WORKFLOW_DEFS.map((def, i) => {
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

    setNodes(staticNodes);
    setEdges([]);
    setWorkflowTemplates(staticTemplates);
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
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
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
    setShowNodeTypeSelector(false);
  }, []);

  const toggleNodeTypeSelector = useCallback(() => {
    setShowNodeTypeSelector((prev) => !prev);
  }, []);

  const getNextJumpLandLabel = useCallback(() => {
    const existingLabels = nodes
      .filter((n) => n.type === 'jump' || n.type === 'land')
      .map((n) => n.data.label);
    
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let index = 0;
    
    while (true) {
      let label = '';
      let temp = index;
      do {
        label = alphabet[temp % 26] + label;
        temp = Math.floor(temp / 26) - 1;
      } while (temp >= 0);
      
      if (!existingLabels.includes(label)) {
        return label;
      }
      index++;
    }
  }, [nodes]);

  const getColorIndexForLabel = useCallback((label: string) => {
    const jumpLandNodes = nodes.filter((n) => n.type === 'jump' || n.type === 'land');
    const existingNode = jumpLandNodes.find((n) => n.data.label === label);
    
    if (existingNode && existingNode.data.nodeType !== 'box') {
      return existingNode.data.colorIndex;
    }
    
    const usedIndices = new Set<number>();
    jumpLandNodes.forEach((n) => {
      if (n.data.nodeType !== 'box') {
        usedIndices.add(n.data.colorIndex);
      }
    });
    
    for (let i = 0; i < JUMP_LAND_COLORS.length; i++) {
      if (!usedIndices.has(i)) {
        return i;
      }
    }
    
    return jumpLandNodes.length % JUMP_LAND_COLORS.length;
  }, [nodes]);

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

  const addNodeFromTemplate = useCallback((template: WorkflowDefFromDB) => {
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
    const label = getNextJumpLandLabel();
    const colorIndex = getColorIndexForLabel(label);

    const newNode: Node<JumpData> = {
      id,
      type: 'jump',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: { nodeType: 'jump', label, colorIndex },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, setNodes, closeContextMenu, getNextJumpLandLabel, getColorIndexForLabel]);

  const addLandNode = useCallback(() => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());
    const label = getNextJumpLandLabel();
    const colorIndex = getColorIndexForLabel(label);

    const newNode: Node<LandData> = {
      id,
      type: 'land',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: { nodeType: 'land', label, colorIndex },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, setNodes, closeContextMenu, getNextJumpLandLabel, getColorIndexForLabel]);

  const getExistingLabels = useCallback(() => {
    const labels = new Set<string>();
    nodes.forEach((n) => {
      if (n.type === 'jump' || n.type === 'land') {
        labels.add(n.data.label);
      }
    });
    return Array.from(labels).sort();
  }, [nodes]);

  const saveToBackend = useCallback(async () => {
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
        id: e.id,
        source: e.source,
        target: e.target,
      }));

      const response = await fetch(`${API_BASE_URL}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nodes: placedNodesData, 
          edges: edgesData,
          templates: workflowTemplates,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to save`);
      }

      alert('✅ Başarıyla kaydedildi!');
      closeContextMenu();
    } catch (err) {
      alert('❌ Kaydetme hatası: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
      console.error('Save error:', err);
    }
  }, [nodes, edges, workflowTemplates, closeContextMenu]);

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
          label: jumpData.label,
          colorIndex: jumpData.colorIndex,
        };
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
          label: landData.label,
          colorIndex: landData.colorIndex,
        };
      });

    const templates = workflowTemplates.map((d) => ({
      id: d.id,
      type: d.type,
      x: -1,
      y: -1,
      ad: d.ad,
      aciklama: d.aciklama,
      jumpLandLabel: d.jumpLandLabel,
      colorIndex: d.colorIndex,
    }));

    const jumpLinks: { jumpLabel: string; jumpNodeId: string; landNodeId: string }[] = [];
    jumpNodes.forEach((jump) => {
      const matchingLand = landNodes.find((land) => land.label === jump.label);
      if (matchingLand) {
        jumpLinks.push({
          jumpLabel: jump.label,
          jumpNodeId: jump.id,
          landNodeId: matchingLand.id,
        });
      }
    });

    const exportData = {
      nodes: [...boxNodes, ...jumpNodes, ...landNodes],
      edges: edges.map((e) => ({
        id: e.id || (crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
        source: e.source,
        target: e.target,
        islem_tur: nodeIdToAd.get(e.source) || e.source,
        sonraki_islem_tur: nodeIdToAd.get(e.target) || e.target,
      })),
      jumpLinks,
      templates,
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
  }, [nodes, edges, workflowTemplates, closeContextMenu]);

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
            const placedNodes: Node<NodeData>[] = [];

            data.nodes.forEach((n: any, index: number) => {
              const x = n.x ?? n.position?.x;
              const y = n.y ?? n.position?.y;
              
              if (x === -1 && y === -1) {
                return;
              }

              const position = { 
                x: typeof x === 'number' ? x : 100 + (index % 5) * 250, 
                y: typeof y === 'number' ? y : 100 + Math.floor(index / 5) * 100 
              };

              if (n.type === 'jump') {
                placedNodes.push({
                  id: n.id || crypto?.randomUUID?.() || String(Date.now() + index),
                  type: 'jump',
                  position,
                  data: {
                    nodeType: 'jump' as const,
                    label: n.label || 'A',
                    colorIndex: n.colorIndex ?? 0,
                  },
                });
                return;
              }

              if (n.type === 'land') {
                placedNodes.push({
                  id: n.id || crypto?.randomUUID?.() || String(Date.now() + index),
                  type: 'land',
                  position,
                  data: {
                    nodeType: 'land' as const,
                    label: n.label || 'A',
                    colorIndex: n.colorIndex ?? 0,
                  },
                });
                return;
              }

              const ad = n.ad || n.data?.ad || n.data?.def?.ad || n.data?.label || 'Imported Node';
              const aciklama = n.aciklama || n.data?.aciklama || n.data?.def?.aciklama || '';

              placedNodes.push({
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

            setNodes(placedNodes);

            if (data.templates && Array.isArray(data.templates)) {
              const importedTemplates: WorkflowDefFromDB[] = data.templates.map((t: any, i: number) => ({
                id: t.id || `template-${i}`,
                ad: t.ad || '',
                aciklama: t.aciklama || '',
                x: -1,
                y: -1,
                type: t.type || 'box',
                jumpLandLabel: t.jumpLandLabel,
                colorIndex: t.colorIndex,
              }));
              setWorkflowTemplates(importedTemplates);
            }

            const adToNodeId = new Map<string, string>();
            placedNodes.forEach((n) => {
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

                  return {
                    id: e.id || crypto?.randomUUID?.() || String(Date.now() + Math.random()),
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
      setJumpLandLabel(jumpLandData.label || 'A');
      setJumpLandColorIndex(jumpLandData.colorIndex || 0);
      setEditingNodeType(node.type as 'jump' | 'land');
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

    const labelTrimmed = jumpLandLabel.trim() || 'A';
    
    setNodes((nds) => {
      return nds.map((n) => {
        if (n.id === editingNodeId) {
          if (n.data.nodeType === 'jump') {
            return {
              ...n,
              data: {
                nodeType: 'jump' as const,
                label: labelTrimmed,
                colorIndex: jumpLandColorIndex,
              },
            };
          } else if (n.data.nodeType === 'land') {
            return {
              ...n,
              data: {
                nodeType: 'land' as const,
                label: labelTrimmed,
                colorIndex: jumpLandColorIndex,
              },
            };
          }
        }
        
        if ((n.type === 'jump' || n.type === 'land') && 
            n.data.label === labelTrimmed &&
            n.id !== editingNodeId &&
            n.data.nodeType !== 'box') {
          return {
            ...n,
            data: {
              ...n.data,
              colorIndex: jumpLandColorIndex,
            },
          };
        }
        
        return n;
      });
    });

    closeJumpLandModal();
  }, [editingNodeId, jumpLandLabel, jumpLandColorIndex, setNodes, closeJumpLandModal]);

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
            Tekrar Dene
          </button>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(false);
            }}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              border: '1px solid #4fc3f7',
              background: 'transparent',
              color: '#4fc3f7',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Boş Başla
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
        nodes={nodes}
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
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Etiket (Label)</span>
                <input
                  value={jumpLandLabel}
                  onChange={(e) => setJumpLandLabel(e.target.value.toUpperCase())}
                  placeholder="Örn: A, B, LOOP_1"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid #ccc',
                    outline: 'none',
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                  Aynı etikete sahip Jump ve Land node'ları eşleşir
                </span>
              </label>

              {getExistingLabels().length > 0 && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Mevcut Etiketler</span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        setJumpLandLabel(e.target.value);
                        const existingNode = nodes.find(
                          (n) => (n.type === 'jump' || n.type === 'land') && 
                                 n.data.label === e.target.value
                        );
                        if (existingNode && existingNode.data.nodeType !== 'box') {
                          const jumpLandData = existingNode.data as JumpData | LandData;
                          setJumpLandColorIndex(jumpLandData.colorIndex);
                        }
                      }
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #ccc',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Mevcut bir etiket seç --</option>
                    {getExistingLabels().map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </label>
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
            minWidth: 280,
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative' }}>
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
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a4e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: 18 }}>➕</span>
              Yeni Node Ekle
            </button>
            
            <button
              onClick={toggleNodeTypeSelector}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#4fc3f7',
                border: 'none',
                borderRadius: 4,
                color: '#1a1a2e',
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showNodeTypeSelector ? '▲' : '▼'} Türler ({workflowTemplates.length})
            </button>
          </div>

          {showNodeTypeSelector && (
            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                background: '#252545',
                borderTop: '1px solid #4fc3f7',
                borderBottom: '1px solid #4fc3f7',
              }}
            >
              {workflowTemplates.length === 0 ? (
                <div
                  style={{
                    padding: '12px 16px',
                    color: '#888',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  Henüz işlem türü yüklenmedi
                </div>
              ) : (
                workflowTemplates.map((template, index) => (
                  <button
                    key={`${template.id}-${index}`}
                    onClick={() => addNodeFromTemplate(template)}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: 11,
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
