import { useCallback, useMemo, useRef, useState } from 'react';
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
import WORKFLOW_DEFS from './islemTurleri.json';

type WorkflowDef = {
  ad?: string;
  aciklama?: string;
};

type BoxData = {
  // Kutunun ortasında görünen yazı
  label: string;
  // JSON'dan gelen tüm detayları data içinde tutacağız:
  def: WorkflowDef;
};

// ✅ Sağ-sol bağlanan kutu (custom node)
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

// Arrange nodes in columns of 10 (10 nodes per column, vertically stacked)
const NODES_PER_COLUMN = 10;
const COLUMN_WIDTH = 280;
const ROW_HEIGHT = 80;

const initialNodes: Node<BoxData>[] = WORKFLOW_DEFS.map((def, i) => {
  const column = Math.floor(i / NODES_PER_COLUMN);
  const row = i % NODES_PER_COLUMN;
  
  return {
    id: String(i + 1),
    type: 'box',
    position: { x: 100 + column * COLUMN_WIDTH, y: 100 + row * ROW_HEIGHT },
    data: { label: def.ad, def },
  };
});

const initialEdges: Edge[] = [];

export default function App() {
  const rf = useRef<ReactFlowInstance | null>(null);
  const nodeTypes = useMemo<NodeTypes>(() => ({ box: BoxNode }), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // ✅ Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // Form alanları (JSON'a göre)
  const [formAd, setFormAd] = useState('');
 
  const [formAciklama, setFormAciklama] = useState('');

  // ✅ Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    flowX: number;
    flowY: number;
  }>({ visible: false, x: 0, y: 0, flowX: 0, flowY: 0 });

  // ✅ Node type selector dropdown state
  const [showNodeTypeSelector, setShowNodeTypeSelector] = useState(false);

  // ✅ File input ref for import
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    rf.current = instance;
  }, []);

  // ✅ Bağlantılar kaybolmasın
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges]
  );

  // ✅ Boş alana sağ tık -> context menu göster
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

  // ✅ Context menu'yu kapat
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
    setShowNodeTypeSelector(false);
  }, []);

  // ✅ Toggle node type selector dropdown
  const toggleNodeTypeSelector = useCallback(() => {
    setShowNodeTypeSelector((prev) => !prev);
  }, []);

  // ✅ Yeni node ekle (with selected workflow def)
  const addNewNode = useCallback((selectedDef?: WorkflowDef) => {
    const id = crypto?.randomUUID?.() ?? String(Date.now());
    const def = selectedDef || ({} as WorkflowDef);

    const newNode: Node<BoxData> = {
      id,
      type: 'box',
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: {
        label: def.ad ?? 'Yeni İşlem',
        def,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    closeContextMenu();
  }, [contextMenu.flowX, contextMenu.flowY, setNodes, closeContextMenu]);

  // ✅ JSON olarak dışa aktar
  const exportJson = useCallback(() => {
    // Build a map of node id -> islem_tur (ad)
    const nodeIdToAd = new Map<string, string>();
    nodes.forEach((n) => {
      const ad = n.data?.def?.ad || n.data?.label || n.id;
      nodeIdToAd.set(n.id, ad);
    });

    const exportData = {
      // Export nodes in flat format: { id, x, y, ad, aciklama }
      nodes: nodes.map((n) => ({
        id: n.id,
        x: n.position?.x ?? 0,
        y: n.position?.y ?? 0,
        ad: n.data?.def?.ad || n.data?.label || '',
        aciklama: n.data?.def?.aciklama || '',
      })),
      edges: edges.map((e) => ({
        id: crypto?.randomUUID?.() ?? String(Date.now() + Math.random()),
        islem_tur: nodeIdToAd.get(e.source) || e.source,
        sonraki_islem_tur: nodeIdToAd.get(e.target) || e.target,
      })),
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

  // ✅ JSON içe aktar
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

          // Import nodes
          if (data.nodes && Array.isArray(data.nodes)) {
            const importedNodes: Node<BoxData>[] = data.nodes.map((n: any, index: number) => {
              // Support new flat format: { id, x, y, ad, aciklama }
              // Also support legacy format with position/data.
              const ad = n.ad || n.data?.ad || n.data?.def?.ad || n.data?.label || 'Imported Node';
              const aciklama = n.aciklama || n.data?.aciklama || n.data?.def?.aciklama || '';

              const position =
                n.position || (typeof n.x === 'number' && typeof n.y === 'number'
                  ? { x: n.x, y: n.y }
                  : { x: 100 + (index % 5) * 250, y: 100 + Math.floor(index / 5) * 100 });

              return {
                id: n.id || crypto?.randomUUID?.() || String(Date.now() + index),
                type: 'box',
                position,
                data: {
                  label: ad,
                  def: { ad, aciklama } as WorkflowDef,
                },
              };
            });
            setNodes(importedNodes);

            // Build a map of islem_tur (ad) -> node id for edge mapping
            const adToNodeId = new Map<string, string>();
            importedNodes.forEach((n) => {
              const ad = n.data?.def?.ad || n.data?.label;
              if (ad) {
                adToNodeId.set(ad, n.id);
              }
            });

            // Import edges
            if (data.edges && Array.isArray(data.edges)) {
              const importedEdges: Edge[] = data.edges
                .map((e: any) => {
                  // Try to find source/target by islem_tur/sonraki_islem_tur or direct source/target
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

            // Fit view after import
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
      // Reset file input
      event.target.value = '';
    },
    [setNodes, setEdges]
  );

  // ✅ Node çift tık -> modal aç (JSON'dan gelen değerleri göster)
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node<BoxData>) => {
    setEditingNodeId(node.id);

    const def = node.data.def;

    setFormAd(def.ad ?? '');

    setFormAciklama(def.aciklama ?? '');


    setIsModalOpen(true);
  }, []);

  // ✅ Edge çift tık -> bağlantıyı sil
  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setEdges]
  );

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingNodeId(null);
  }, []);

  // ✅ Kaydet -> node.data.def güncelle + kutuda ad göster
  const saveNode = useCallback(() => {
    if (!editingNodeId) return;

    const adTrimmed = formAd.trim() || 'ISIMSIZ';
    const aciklamaVal = formAciklama;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== editingNodeId) return n;

        const oldDef = n.data.def;

        const newDef = {
          ...oldDef,
          ad: adTrimmed,
        
          aciklama: aciklamaVal,
       
        } as WorkflowDef;

        return {
          ...n,
          data: {
            ...n.data,
            label: adTrimmed, // ✅ kutunun ortasındaki yazı
            def: newDef,
          },
        };
      })
    );

    closeModal();
  }, [editingNodeId, formAd, formAciklama, setNodes, closeModal]);

  const onModalKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter') saveNode();
    },
    [closeModal, saveNode]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }} onClick={closeContextMenu}>
      <ReactFlow
        onInit={onInit}
        nodeTypes={nodeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
          nodeColor="#4fc3f7"
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

      {/* ✅ Modal (JSON alanları) */}
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
              {/* ad */}
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

              {/* aciklama */}
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

      {/* ✅ Context Menu */}
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
          {/* Yeni Node Ekle with dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => addNewNode()}
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
            
            {/* Dropdown toggle button */}
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
              {showNodeTypeSelector ? '▲' : '▼'} Türler
            </button>
          </div>

          {/* Node type selector dropdown */}
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
              {WORKFLOW_DEFS.map((def, index) => (
                <button
                  key={index}
                  onClick={() => addNewNode(def)}
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
                  title={def.aciklama}
                >
                  {def.ad}
                </button>
              ))}
            </div>
          )}

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

      {/* Hidden file input for import */}
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
