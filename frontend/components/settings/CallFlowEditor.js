import React, { useState, useEffect, useRef } from "react";
import { getApiBaseUrl, tenantFetch } from "../../utils/apiHost";
import { 
  GitBranch, 
  Save, 
  Plus, 
  Trash2, 
  Volume2, 
  Shuffle, 
  Database, 
  ArrowRight, 
  CheckCircle,
  HelpCircle,
  Settings,
  Bot,
  Layers,
  X,
  FileText,
  Activity,
  Play,
  Edit,
  Edit2,
  Search,
  ArrowLeft,
  Server,
  Hash,
  Clock,
  AlertTriangle,
  PhoneOff,
  LogIn,
  LogOut,
  Lock,
  PhoneIncoming,
  Users
} from "lucide-react";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import { useTheme } from "../../utils/theme";

export default function CallFlowEditor({ backendHost = "localhost:8000", onEditStateChange, onOpenWorkHours }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight, colorCode } = useTheme();
  const [viewMode, setViewMode] = useState("list"); // list, edit
  const [workflows, setWorkflows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Current editing workflow states
  const [currentWfId, setCurrentWfId] = useState(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [trunkId, setTrunkId] = useState(1);
  const [trunks, setTrunks] = useState([]);
  const [aiAgents, setAiAgents] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [queues, setQueues] = useState([]);
  const [inboundRules, setInboundRules] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");
  const [newAgentIntent, setNewAgentIntent] = useState("");
  const [newAgentTargetType, setNewAgentTargetType] = useState("dahili");
  const [newAgentTargetValue, setNewAgentTargetValue] = useState("");
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const nodeDialogRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [workflowError, setWorkflowError] = useState("");

  useEffect(() => {
    if (workflowError) {
      const timer = setTimeout(() => {
        setWorkflowError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [workflowError]);

  
  // Custom Delete Modal states
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Live CallFlow Simulator states
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simCallerNumber, setSimCallerNumber] = useState("05321234567");
  const [simDidNumber, setSimDidNumber] = useState("08503607390");
  const [simDtmfInput, setSimDtmfInput] = useState("12345");
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [simVisitedNodeIds, setSimVisitedNodeIds] = useState([]);

  const handleRunSimulation = async () => {
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await tenantFetch(`${API_BASE}/api/settings/call-flow/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          connections,
          caller_number: simCallerNumber,
          did_number: simDidNumber,
          dtmf_input: simDtmfInput
        })
      });
      const data = await res.json();
      setSimResult(data);
      if (Array.isArray(data.visited_node_ids)) {
        setSimVisitedNodeIds(data.visited_node_ids);
      }
    } catch (err) {
      setSimResult({ status: "error", message: String(err) });
    } finally {
      setSimRunning(false);
    }
  };

  // Interaction states for Canvas Editor
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState(null); // { nodeId, portId }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef(null);
  const API_BASE = getApiBaseUrl(backendHost);


  // Fetch workflows list
  const fetchWorkflows = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/settings/call-flow/workflows`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setWorkflows(data);
      })
      .catch((err) => console.error("[CallFlow] Workflows load error:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWorkflows();
    
    // Fetch trunks
    fetch(`${API_BASE}/api/settings/trunks`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTrunks(data);
      })
      .catch((err) => console.error("[CallFlow] Trunks load error:", err));

    // Fetch AI Agents
    fetch(`${API_BASE}/api/settings/ai-agents`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAiAgents(data);
      })
      .catch((err) => console.error("[CallFlow] AI Agents load error:", err));

    // Fetch System Users (Extensions)
    fetch(`${API_BASE}/api/settings/users?tenant_id=all`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setSystemUsers(data);
      })
      .catch((err) => console.error("[CallFlow] System users load error:", err));

    // Fetch Queues
    fetch(`${API_BASE}/api/settings/queues?tenant_id=all`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setQueues(data);
      })
      .catch((err) => console.error("[CallFlow] Queues load error:", err));

    // Fetch Inbound Rules (to display which rules route into each Call Flow)
    tenantFetch(`${API_BASE}/api/settings/inbound_rules`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setInboundRules(data);
        else if (Array.isArray(data?.rules)) setInboundRules(data.rules);
      })
      .catch((err) => console.error("[CallFlow] Inbound rules load error:", err));

    // Fetch Announcements
    tenantFetch(`${API_BASE}/api/settings/announcements`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setAnnouncements(data);
      })
      .catch((err) => console.error("[CallFlow] Announcements load error:", err));
  }, []);

  // Sync isNodeModalOpen with selectedNodeId
  useEffect(() => {
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (selectedNode) {
      setIsNodeModalOpen(true);
    } else {
      setIsNodeModalOpen(false);
    }
  }, [selectedNodeId, nodes]);

  // Manage native <dialog> modal lifecycle with showModal()
  useEffect(() => {
    const dlg = nodeDialogRef.current;
    if (!dlg) return;
    if (isNodeModalOpen) {
      if (!dlg.open) {
        try {
          dlg.showModal();
        } catch (e) {
          dlg.setAttribute("open", "");
        }
      }
    } else if (dlg.open) {
      dlg.close();
    }
  }, [isNodeModalOpen, selectedNodeId]);

  const closeNodeModal = () => {
    if (nodeDialogRef.current?.open) {
      nodeDialogRef.current.close();
    }
    setIsNodeModalOpen(false);
    setSelectedNodeId(null);
  };

  // Normalize legacy DID / trunk_start nodes into a single locked 'start' ("Akış Başlangıcı") entry node
  const normalizeWorkflowGraph = (rawNodes, rawConns) => {
    const srcNodes = Array.isArray(rawNodes) ? rawNodes : [];
    const srcConns = Array.isArray(rawConns) ? rawConns : [];
    let primaryStart = null;
    const duplicateStartIds = new Set();
    const normNodes = [];

    for (const n of srcNodes) {
      if (!n || typeof n !== "object") continue;
      const nType = String(n.type || "").toLowerCase();
      if (["start", "did", "trunk_start", "inbound"].includes(nType)) {
        const oldTitle = String(n.title || "").trim();
        const cleanTitle =
          !oldTitle || oldTitle.toLowerCase().includes("did") || ["start", "trunk_start"].includes(oldTitle.toLowerCase())
            ? "Akış Başlangıcı"
            : oldTitle;
        const cleanExtra = n.extra_fields && typeof n.extra_fields === "object" ? { ...n.extra_fields } : {};
        delete cleanExtra.did_numbers;
        delete cleanExtra.is_wildcard;
        const converted = {
          ...n,
          type: "start",
          title: cleanTitle,
          value: "Çağrı Girişi",
          extra_fields: Object.keys(cleanExtra).length > 0 ? cleanExtra : null
        };
        if (!primaryStart) {
          primaryStart = converted;
          normNodes.push(converted);
        } else if (n.id) {
          duplicateStartIds.add(n.id);
        }
      } else {
        normNodes.push(n);
      }
    }

    const normConns = [];
    for (const c of srcConns) {
      if (!c || typeof c !== "object") continue;
      const copyC = { ...c };
      if (primaryStart && duplicateStartIds.has(copyC.fromNode)) {
        copyC.fromNode = primaryStart.id;
        copyC.fromPort = "output";
      }
      if (duplicateStartIds.has(copyC.toNode) || (primaryStart && copyC.toNode === primaryStart.id)) {
        continue;
      }
      normConns.push(copyC);
    }

    if (!primaryStart) {
      let startId = "node-start";
      const usedIds = new Set(normNodes.map((n) => n.id));
      let idx = 1;
      while (usedIds.has(startId)) {
        startId = `node-start-${idx++}`;
      }
      primaryStart = {
        id: startId,
        type: "start",
        x: 80,
        y: 150,
        title: "Akış Başlangıcı",
        value: "Çağrı Girişi",
        options: null,
        extra_fields: null
      };
      const incomingSet = new Set(normConns.map((c) => c.toNode).filter(Boolean));
      const rootTarget =
        normNodes.find((n) => !incomingSet.has(n.id) && n.type !== "stargate_out") || normNodes[0] || null;
      normNodes.unshift(primaryStart);
      if (rootTarget?.id) {
        normConns.unshift({
          id: `conn-${startId}-auto`,
          fromNode: startId,
          fromPort: "output",
          toNode: rootTarget.id,
          toPort: "input"
        });
      }
    }

    return { nodes: normNodes, connections: normConns };
  };

  // Resolve all Inbound Rules and Queue Fallbacks pointing to a given workflow ID
  const getWorkflowEntryReferences = (wfId) => {
    if (!wfId) return [];
    const targetId = String(wfId);
    const refs = [];

    for (const r of inboundRules) {
      if (!r || r.active === false || r.enabled === false) continue;
      if (["call_flow", "ivr"].includes(String(r.destination_type || "").toLowerCase()) && String(r.destination_id) === targetId) {
        const didSummary =
          r.did_match_mode === "all"
            ? "Tüm Numaralar"
            : Array.isArray(r.did_patterns) && r.did_patterns.length > 0
              ? r.did_patterns.join(", ")
              : r.did_number || "Özel DID";
        refs.push({
          kind: "inbound",
          name: r.name || "Gelen Arama Kuralı",
          detail: didSummary
        });
      }
    }

    for (const q of queues) {
      if (!q) continue;
      const busyDirect = q.all_busy_routing_enabled && q.all_busy_destination_type === "call_flow" && String(q.all_busy_destination_target) === targetId;
      const busyPostAnn =
        q.all_busy_routing_enabled &&
        q.all_busy_destination_type === "announcement" &&
        q.all_busy_post_announcement_action === "call_flow" &&
        String(q.all_busy_post_announcement_target) === targetId;
      const waitDirect = q.max_wait_time_enabled && q.max_wait_destination_type === "call_flow" && String(q.max_wait_destination_target) === targetId;
      const waitPostAnn =
        q.max_wait_time_enabled &&
        q.max_wait_destination_type === "announcement" &&
        q.max_wait_post_announcement_action === "call_flow" &&
        String(q.max_wait_post_announcement_target) === targetId;

      if (busyDirect || busyPostAnn || waitDirect || waitPostAnn) {
        refs.push({
          kind: "queue",
          name: q.name || `Kuyruk ${q.extension || ""}`,
          detail: `Kuyruk Taşması (${q.extension || q.id})`
        });
      }
    }

    return refs;
  };
 
  const getHolidayList = (node) => {
    return node.extra_fields?.holidays || [];
  };
 
  const handleAddHoliday = (nodeId) => {
    if (!newHolidayDate.trim()) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
 
    const list = getHolidayList(node);
    const datePart = newHolidayDate.trim();
    const labelPart = newHolidayLabel.trim();
    const cleaned = labelPart ? `${datePart} (${labelPart})` : datePart;
    
    if (list.includes(cleaned)) return;
 
    const newList = [...list, cleaned];
    saveHolidayList(nodeId, newList);
    setNewHolidayDate("");
    setNewHolidayLabel("");
  };
 
  const handleDeleteHoliday = (nodeId, index) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
 
    const list = getHolidayList(node);
    const newList = list.filter((_, idx) => idx !== index);
    saveHolidayList(nodeId, newList);
  };
 
  const saveHolidayList = (nodeId, list) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            extra_fields: {
              ...n.extra_fields,
              holidays: list
            }
          };
        }
        return n;
      })
    );
  };

  const handleAddAgentOption = (nodeId) => {
    if (!newAgentIntent.trim()) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const currentOptions = node.options || [];
    const opt = newAgentIntent.trim();
    if (currentOptions.includes(opt)) return;

    const newOptions = [...currentOptions, opt];
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return { ...n, options: newOptions };
        }
        return n;
      })
    );
    setNewAgentIntent("");
  };

  const handleDeleteAgentOption = (nodeId, opt) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const newOptions = (node.options || []).filter((o) => o !== opt);
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === nodeId) {
          return { ...n, options: newOptions };
        }
        return n;
      })
    );
    setConnections((prev) => prev.filter((c) => !(c.fromNode === nodeId && c.fromPort === opt)));
  };

  // Snapping helpers
  const snapToGrid = (val) => Math.round(val / 10) * 10;

  // Node Dimensions Map (Width/Height) for Port offset calculations
  const getNodeDimensions = (node) => {
    switch (node.type) {
      case "play": {
        const hasValue = !!node.value;
        return { w: 170, h: hasValue ? 92 : 70 };
      }
      case "menu": {
        const hasBadge = !!node.value;
        const baseHeight = 48 + (hasBadge ? 16 : 0);
        return { w: 155, h: baseHeight + (node.options?.length || 14) * 34 };
      }
      case "user_input": return { w: 185, h: 138 };
      case "http_request": return { w: 195, h: 138 };
      case "setvalue": return { w: 170, h: 70 };
      case "transfer": {
        const hasBadge = !!node.extra_fields?.play_announcement;
        return { w: 185, h: hasBadge ? 92 : 74 };
      }
      case "tts": return { w: 210, h: 120 };
      case "whatsapp_notify": return { w: 185, h: 92 };
      case "sr": return { w: 180, h: 215 };
      case "compare": return { w: 185, h: 132 };
      case "loop": return { w: 180, h: 132 };
      case "start": return { w: 185, h: 80 };
      case "timerule": return { w: 180, h: 176 };
      case "ai_agent": {
        const len = node.options?.length || 0;
        return { w: 170, h: len > 0 ? 84 + len * 34 : 74 };
      }
      case "hangup": return { w: 140, h: 70 };
      case "stargate_in": return { w: 150, h: 70 };
      case "stargate_out": return { w: 150, h: 70 };
      default: return { w: 170, h: 70 };
    }
  };

  // Get exact screen coordinates of a port for connection rendering
  const getPortCoords = (nodeId, portId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    
    const dims = getNodeDimensions(node);

    // If port is left input port
    if (portId === "input") {
      return { x: node.x, y: node.y + dims.h / 2 };
    }

    // Option ports for USER_INPUT node (output = Tuşlandı, error = Hata / Limit)
    if (node.type === "user_input") {
      const opts = ["output", "error"];
      const idx = opts.indexOf(portId);
      if (idx !== -1) {
        return { x: node.x + dims.w, y: node.y + 72 + idx * 34 };
      }
    }

    // Option ports for HTTP_REQUEST node (success = Başarılı, error = Hata / Yok)
    if (node.type === "http_request") {
      const opts = ["success", "error"];
      const idx = opts.indexOf(portId);
      if (idx !== -1) {
        return { x: node.x + dims.w, y: node.y + 72 + idx * 34 };
      }
    }

    // Option ports for LOOP node (loop = Tekrarla, completed = Limit Doldu)
    if (node.type === "loop") {
      const opts = ["loop", "completed"];
      const idx = opts.indexOf(portId);
      if (idx !== -1) {
        return { x: node.x + dims.w, y: node.y + 68 + idx * 34 };
      }
    }

    // If port is single right output port
    if (portId === "output") {
      return { x: node.x + dims.w, y: node.y + dims.h / 2 };
    }

    // Option ports for MENU node
    if (node.type === "menu") {
      const idx = node.options?.indexOf(portId) ?? -1;
      if (idx !== -1) {
        const hasBadge = !!node.value;
        const startY = 57 + (hasBadge ? 16 : 0);
        return { x: node.x + dims.w, y: node.y + startY + idx * 34 };
      }
    }

    // Option ports for SR node
    if (node.type === "sr") {
      const opts = ["90", "75", "50", "none"];
      const idx = opts.indexOf(portId);
      if (idx !== -1) {
        return { x: node.x + dims.w, y: node.y + 86 + idx * 30 + 15 };
      }
    }

    // Option ports for COMPARE node
    if (node.type === "compare") {
      const opts = ["true", "false"];
      const idx = opts.indexOf(portId);
      if (idx !== -1) {
        return { x: node.x + dims.w, y: node.y + 68 + idx * 34 };
      }
    }

    // Option ports for TIMERULE node
    if (node.type === "timerule") {
      const opts = ["active", "inactive", "holiday"];
      const idx = opts.indexOf(portId);
      if (idx !== -1) {
        return { x: node.x + dims.w, y: node.y + 83 + idx * 34 };
      }
    }

    // Option ports for AI Agent node
    if (node.type === "ai_agent") {
      const idx = node.options?.indexOf(portId) ?? -1;
      if (idx !== -1) {
        const startY = 93;
        return { x: node.x + dims.w, y: node.y + startY + idx * 34 };
      }
    }

    return { x: node.x + dims.w, y: node.y + 20 };
  };

  // Drag and Drop Node Handler
  const handleNodeMouseDown = (e, node) => {
    if (e.target.closest(".port")) return; // Don't drag if clicking port
    setSelectedConnectionId(null);
    setDraggingNodeId(node.id);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setDragOffset({
      x: mouseX - node.x,
      y: mouseY - node.y
    });
    e.stopPropagation();
  };

  const handleCanvasMouseMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    setMousePos({ x: mouseX, y: mouseY });

    if (draggingNodeId) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNodeId
            ? { ...n, x: snapToGrid(mouseX - dragOffset.x), y: snapToGrid(mouseY - dragOffset.y) }
            : n
        )
      );
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Connection Handler
  const handlePortClick = (e, nodeId, portId, isInput) => {
    e.stopPropagation();
    
    if (isInput) {
      // Connect
      if (connectingFrom && connectingFrom.nodeId !== nodeId) {
        const isConnected = connections.some(
          (c) => c.fromNode === connectingFrom.nodeId && c.fromPort === connectingFrom.portId
        );
        if (!isConnected) {
          const newConn = {
            id: `conn-${Date.now()}`,
            fromNode: connectingFrom.nodeId,
            fromPort: connectingFrom.portId,
            toNode: nodeId,
            toPort: portId
          };
          setConnections((prev) => [...prev, newConn]);
        }
        setConnectingFrom(null);
      }
    } else {
      // Set output source
      setConnectingFrom({ nodeId, portId });
    }
  };

  const handlePortMouseDown = (e, nodeId, portId) => {
    e.stopPropagation();
    setConnectingFrom({ nodeId, portId });
  };

  const handlePortMouseUp = (e, nodeId, portId) => {
    e.stopPropagation();
    if (connectingFrom && connectingFrom.nodeId !== nodeId) {
      const isConnected = connections.some(
        (c) => c.fromNode === connectingFrom.nodeId && c.fromPort === connectingFrom.portId
      );
      if (!isConnected) {
        const newConn = {
          id: `conn-${Date.now()}`,
          fromNode: connectingFrom.nodeId,
          fromPort: connectingFrom.portId,
          toNode: nodeId,
          toPort: portId
        };
        setConnections((prev) => [...prev, newConn]);
      }
    }
    setConnectingFrom(null);
  };

  // Keyboard Delete handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
          return;
        }
        if (selectedNodeId) {
          const targetNode = nodes.find((n) => n.id === selectedNodeId);
          if (targetNode?.type === "start") {
            setWorkflowError("Akış Başlangıcı sabit giriş noktasıdır ve silinemez.");
            return;
          }
          setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
          setConnections((prev) => prev.filter((c) => c.fromNode !== selectedNodeId && c.toNode !== selectedNodeId));
          setSelectedNodeId(null);
        } else if (selectedConnectionId) {
          setConnections((prev) => prev.filter((c) => c.id !== selectedConnectionId));
          setSelectedConnectionId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, selectedConnectionId, nodes]);

  // Create new node templates
  const addNode = (type) => {
    const defaultData = {
      play: { title: "Anons", value: "Anons1" },
      menu: { 
        title: "Menü", 
        options: ["1", "2", "timeout", "error"],
        extra_fields: { max_retries: 3, timeout_seconds: 8, retry_prompt: "Hatalı tuşlama yaptınız, lütfen tekrar deneyin." }
      },
      user_input: {
        title: "Tuşlama Al",
        value: "Lütfen sipariş veya abone numaranızı tuşlayıp kareye basın.",
        options: ["output", "error"],
        extra_fields: {
          announcement_type: "tts",
          min_digits: 1,
          max_digits: 11,
          submit_key: "#",
          timeout_seconds: 6,
          max_retries: 3,
          retry_prompt: "Geçersiz veya eksik tuşlama yaptınız, lütfen tekrar tuşlayın.",
          variable_name: "tuslanan_numara"
        }
      },
      http_request: {
        title: "Web Servis (API)",
        value: "http://127.0.0.1:8000/api/v1/demo/order-lookup",
        options: ["success", "error"],
        extra_fields: {
          method: "POST",
          auth_header: "",
          body_template: '{\n  "siparis_no": "{{tuslanan_numara}}",\n  "arayan": "{{arayan_numara}}",\n  "hat": "{{aranan_hat}}"\n}',
          response_key: "target_number",
          response_tts_key: "message",
          timeout_seconds: 8
        }
      },
      compare: {
        title: "Karşılaştırma",
        value: "0",
        options: ["true", "false"],
        extra_fields: {
          source: "tuslanan_numara",
          operator: "equals"
        }
      },
      loop: {
        title: "Döngü (Sayaç)",
        value: "3",
        options: ["loop", "completed"],
        extra_fields: {
          max_loops: 3
        }
      },
      tts: {
        title: "Dinamik TTS",
        value: "{{api_mesaj}}"
      },
      whatsapp_notify: {
        title: "WhatsApp Gönder",
        value: "Merhaba, {{tuslanan_numara}} numaralı işleminiz alınmıştır.",
        extra_fields: {
          recipient: "{{arayan_numara}}"
        }
      },
      transfer: { title: "Transfer", value: "1000" },
      timerule: { 
        title: "Senaryo", 
        value: "09:00", 
        options: ["active", "inactive"], 
        extra_fields: { start_time: "09:00", end_time: "18:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"] } 
      },
      ai_agent: { title: "AI Agent", value: "agent-sales" },
      hangup: { title: "Kapat", value: "Aramayı Sonlandır" },
      stargate_in: { title: "YG Girişi", value: "Geçit A" },
      stargate_out: { title: "YG Çıkışı", value: "Geçit A" }
    };

    const template = defaultData[type];
    if (!template) return;
    const newNode = {
      id: `node-${Date.now()}`,
      type,
      x: snapToGrid(260 + Math.random() * 50),
      y: snapToGrid(150 + Math.random() * 50),
      title: template.title,
      value: template.value || "",
      options: template.options || null,
      extra_fields: template.extra_fields || null
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Launch edit view mode
  const handleEditWorkflow = (wf) => {
    setWorkflowError("");
    setCurrentWfId(wf.id);
    setWorkflowName(wf.name);
    setWorkflowStatus(wf.status);
    const normalized = normalizeWorkflowGraph(wf.nodes, wf.connections);
    setNodes(normalized.nodes);
    setConnections(normalized.connections);
    setTrunkId(wf.trunk_id || 1);
    
    setViewMode("edit");
    if (onEditStateChange) onEditStateChange(true);
  };

  // Launch new workflow template creation
  const handleCreateNewWorkflow = () => {
    setWorkflowError("");
    const newId = `wf-${Date.now()}`;
    setCurrentWfId(newId);
    setWorkflowName("Yeni Arama Akışı");
    setWorkflowStatus("draft");
    setNodes([
      { id: "node-start", type: "start", x: 80, y: 150, title: "Akış Başlangıcı", value: "Çağrı Girişi", options: null, extra_fields: null }
    ]);
    setConnections([]);
    setTrunkId(1);
    
    setViewMode("edit");
    if (onEditStateChange) onEditStateChange(true);
  };

  // Save current editing workflow to database
  const handleSaveWorkflow = async () => {
    setWorkflowError("");
    const wfName = workflowName.trim();

    if (!wfName) {
      setWorkflowError("Lütfen bir Arama Akışı adı giriniz.");
      return;
    }

    // Client-side duplicate check for Workflow Name
    const dupWf = (workflows || []).find(
      w => String(w.name || "").trim().toLowerCase() === wfName.toLowerCase() && (!currentWfId || String(w.id) !== String(currentWfId))
    );
    if (dupWf) {
      setWorkflowError(`'${wfName}' isimli Arama Akışı zaten mevcut. Lütfen farklı bir isim giriniz.`);
      return;
    }

    const startNode = nodes.find((n) => n.type === "start");
    if (workflowStatus === "active") {
      const hasStartConnection = Boolean(startNode && connections.some((c) => c.fromNode === startNode.id));
      if (!hasStartConnection) {
        setWorkflowError("Akışı 'AKTİF' duruma alabilmek için 'Akış Başlangıcı' kutusunun çıkış portunu en az bir adıma bağlamalısınız.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        id: currentWfId,
        name: wfName,
        trunk_id: trunkId,
        status: workflowStatus,
        nodes,
        connections
      };

      const res = await fetch(`${API_BASE}/api/settings/call-flow/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          // Return to list view
          setViewMode("list");
          if (onEditStateChange) onEditStateChange(false);
          fetchWorkflows();
        }, 1200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setWorkflowError(errData.detail || "Arama akışı kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("[CallFlow] Save workflow error:", err);
      setWorkflowError("Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setWorkflowError("");
    setViewMode("list");
    if (onEditStateChange) onEditStateChange(false);
    fetchWorkflows();
  };

  // Custom Delete Modal triggers
  const openDeleteModal = (e, id) => {
    e.stopPropagation();
    setDeleteTargetId(id);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`${API_BASE}/api/settings/call-flow/workflows/${deleteTargetId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchWorkflows();
      }
    } catch (err) {
      console.error("[CallFlow] Delete error:", err);
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleUpdateNodeField = (field, value) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === selectedNodeId ? { ...n, [field]: value } : n))
    );
  };

  const handleUpdateNodeExtraField = (field, value) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === selectedNodeId
          ? { ...n, extra_fields: { ...n.extra_fields, [field]: value } }
          : n
      )
    );
  };

  const filteredWorkflows = workflows.filter((wf) => {
    const query = searchQuery.toLowerCase();
    return (
      wf.name.toLowerCase().includes(query) ||
      String(wf.id).includes(query)
    );
  });

  // Render List view mode
  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-6 text-slate-800 dark:text-slate-100 w-full">
        {/* Header toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 dark:bg-primary/20 text-primary dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl">
              <GitBranch size={24} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Giriş Arama Akışı Yönetimi</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Gelen aramalarınızı karşılayan sesli anons, DTMF menü ve yapay zeka entegreli IVR iş akış şablonlarını yönetin.
              </p>
            </div>
          </div>
          
          {/* Search Bar + "+" Icon Wrapper */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <input
                type="text"
                placeholder="Akış ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-48 text-xs pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 ${ring} dark:focus:ring-rose-400/25 transition-all`}
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-555" />
            </div>

            <button
              onClick={handleCreateNewWorkflow}
              className={`p-2 ${bg} ${hover} text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center h-8 w-8 shrink-0`}
              title="Yeni Akış Ekle"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Workflows List */}
        {loading && workflows.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-500 font-bold text-xs animate-pulse">
            Arama akış şablonları yükleniyor...
          </div>
        ) : workflows.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-3xl text-slate-505 dark:text-slate-450 font-semibold text-xs flex flex-col items-center justify-center gap-3 shadow-sm w-full">
            <GitBranch size={36} className="text-slate-300 dark:text-slate-700 animate-pulse" />
            <p>Kayıtlı herhangi bir arama akış şeması bulunamadı.</p>
            <button
              onClick={handleCreateNewWorkflow}
              className="mt-2 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-primary dark:text-rose-450 border border-rose-100 rounded-xl text-[10px] font-bold transition"
            >
              İlk Akış Şemasını Oluştur
            </button>
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl text-slate-505 dark:text-slate-450 text-xs w-full">
            Arama kriterine uygun arama akış şeması bulunmuyor.
          </div>
        ) : (
          <div className="space-y-3.5 w-full">
            {/* Column Header Row */}
            <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 text-center shrink-0">Simge</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                  <div className="pl-1">Akış Şeması Adı / Durum</div>
                  <div className="pl-1">Düğüm / Bağlantı Sayısı</div>
                  <div className="pl-1">Tetikleyen Giriş Noktaları</div>
                </div>
              </div>
              <div className="w-24 text-right pr-4 shrink-0">İşlemler</div>
            </div>

            {filteredWorkflows.map((wf) => (
              <div 
                key={wf.id}
                className={`p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/85 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200 hover:scale-[1.005] w-full ${
                  wf.status !== "active" ? "opacity-60" : ""
                }`}
              >
                {/* Left Side: Icon & Details */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-primary dark:text-rose-400 shrink-0 flex items-center justify-center">
                    <GitBranch size={22} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 items-center">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                        {wf.name}
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                          wf.status === "active"
                            ? "bg-emerald-50 dark:bg-emerald-950/20 text-primary dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-900/30"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-800"
                        }`}>
                          {wf.status === "active" ? "Aktif" : "Taslak"}
                        </span>
                      </h4>
                      <p className="text-[9px] text-slate-400 dark:text-slate-550 font-medium mt-0.5">ID: {wf.id}</p>
                    </div>

                    <div className="text-[10px] text-slate-505 dark:text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Layers size={12} className="text-slate-400 shrink-0" />
                        <span>Düğümler: {wf.nodes?.length || 0}</span>
                      </div>
                      <div className="text-[9px] text-slate-450 dark:text-slate-500">
                        Bağlantılar: <span className="font-mono">{wf.connections?.length || 0}</span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-505 dark:text-slate-400 space-y-1 min-w-0">
                      {(() => {
                        const refs = getWorkflowEntryReferences(wf.id);
                        if (refs.length === 0) {
                          return (
                            <>
                              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                                <PhoneIncoming size={12} className="shrink-0" />
                                <span className="truncate">Gelen Kural Bekliyor</span>
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                                Gelen Arama Kurallarından bağlayabilirsiniz
                              </div>
                            </>
                          );
                        }
                        return (
                          <>
                            <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                              <PhoneIncoming size={12} className="shrink-0" />
                              <span className="truncate">{refs[0].name}</span>
                              {refs.length > 1 && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[8px] font-extrabold shrink-0">
                                  +{refs.length - 1}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate" title={refs.map((r) => `${r.name} (${r.detail})`).join(" • ")}>
                              {refs[0].detail}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditWorkflow(wf)}
                      className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-white rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-200"
                      title="Düzenle"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => openDeleteModal(e, wf.id)}
                      className="p-1.5 text-slate-450 hover:text-primary dark:hover:text-primary rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-250"
                      title="Akış Şemasını Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom Delete Confirmation Modal */}
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteTargetId(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Akış Şemasını Sil"
          message="Bu arama akış şemasını silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        />
      </div>
    );
  }

  // Render visual node canvas editor
  return (
    <div className="w-screen h-screen flex flex-col bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Visual Editor Full Screen Header */}
      <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCancelEdit}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850 hover:text-slate-800 transition"
            title="Listeye Geri Dön"
          >
            <ArrowLeft size={14} />
          </button>
          
          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Akış Adı Yazın"
              className="px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-850 dark:text-white focus:outline-none focus:border-indigo-500 w-52"
            />
            <select
              value={workflowStatus}
              onChange={(e) => setWorkflowStatus(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 focus:outline-none"
            >
              <option value="draft">TASLAK</option>
              <option value="active">AKTİF</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {simVisitedNodeIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSimVisitedNodeIds([])}
              className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[10px] font-bold hover:bg-emerald-100/60 transition flex items-center gap-1 cursor-pointer shrink-0"
              title="Kanvastaki simülasyon izini temizle"
            >
              <X size={11} /> İzi Temizle ({simVisitedNodeIds.length} adım)
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsSimulatorOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition duration-200 cursor-pointer shrink-0"
            title="Akışı canlı olarak test et / simüle et"
          >
            <Play size={12} className="fill-current" /> Akışı Test Et (Simülatör)
          </button>

          {selectedConnectionId && (
            <button
              onClick={() => {
                setConnections((prev) => prev.filter((c) => c.id !== selectedConnectionId));
                setSelectedConnectionId(null);
              }}
              className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-650 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 rounded-xl text-xs font-bold hover:bg-rose-100/50 transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Seçili bağlantı çizgisini siler"
            >
              <Trash2 size={13} /> Bağlantıyı Sil
            </button>
          )}

          <button
            onClick={handleSaveWorkflow}
            disabled={loading}
            className={`px-4 py-1.5 ${bg} ${hover} text-white rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition duration-200 uppercase tracking-wider`}
          >
            <Save size={13} /> {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-800/40 rounded-xl text-emerald-700 dark:text-emerald-350 text-xs flex items-center gap-1.5 font-bold transition-all z-40 animate-in fade-in duration-200">
          <CheckCircle size={14} />
          <span>Arama akış şeması başarıyla kaydedildi ve listeye dönülüyor.</span>
        </div>
      )}

      {workflowError && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-between gap-3 shadow-lg transition-all z-40 animate-in fade-in duration-200 min-w-[320px]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-rose-500" />
            <span>{workflowError}</span>
          </div>
          <button
            type="button"
            onClick={() => setWorkflowError("")}
            className="p-1 text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 transition-colors rounded-lg shrink-0"
            title="Kapat"
          >
            <X size={14} />
          </button>
        </div>
      )}


      {/* Editor Canvas Container split */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Side: Graphic Canvas Container */}
        <div className="flex-1 bg-slate-50 dark:bg-slate-950/60 relative overflow-hidden flex flex-col">
          
          {/* Node Templates toolbar */}
          <div className="p-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md flex flex-wrap gap-2 items-center justify-between shrink-0 z-20">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                <Play size={10} className="fill-current" />
                <span>Başlangıç: Akış Başlangıcı</span>
              </span>
              <span className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider hidden sm:inline">Düğüm Ekle:</span>
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              <button 
                onClick={() => addNode("play")}
                className="px-2.5 py-1 bg-primary hover:bg-amber-400 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Sesli anons veya TTS karşılama ekle"
              >
                + Anons
              </button>
              <button 
                onClick={() => addNode("menu")}
                className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Tek haneli IVR menü (1, 2, 0 vb. + Hata Sayıcı)"
              >
                + Menü
              </button>
              <button 
                onClick={() => addNode("user_input")}
                className="px-2.5 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Çok haneli numara tuşlatma (Sipariş No, Abone No, T.C. No + Hata Sayıcı)"
              >
                + Tuşlama Al (Digit)
              </button>
              <button 
                onClick={() => addNode("http_request")}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Müşteri Web Servisine (API / Script) JSON gönder ve dönen telefon numarasını al"
              >
                + Web Servis (API)
              </button>
              <button 
                onClick={() => addNode("compare")}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Tuşlanan numarayı veya API yanıtını karşılaştır (Evet / Hayır çıkışı)"
              >
                + Karşılaştırma
              </button>
              <button 
                onClick={() => addNode("loop")}
                className="px-2.5 py-1 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Belirli sayıda tekrarlayan döngü / sayaç kontrolü"
              >
                + Döngü (Sayaç)
              </button>
              <button 
                onClick={() => addNode("transfer")}
                className="px-2.5 py-1 bg-slate-600 hover:bg-slate-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Dahili, Kuyruk, Harici Numara, API'den Dönen Numara veya Başka Arama Akışına (Alt IVR) aktar"
              >
                + Transfer
              </button>
              <button 
                onClick={() => addNode("tts")}
                className="px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="API'den dönen mesajı veya tuşlanan numarayı arayana sesli oku"
              >
                + Dinamik TTS
              </button>
              <button 
                onClick={() => addNode("whatsapp_notify")}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
                title="Görüşme sırasında arayana anında WhatsApp mesajı gönder"
              >
                + WhatsApp
              </button>
              <button 
                onClick={() => addNode("timerule")}
                className="px-2.5 py-1 bg-primary hover:bg-primary text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
              >
                + Senaryo
              </button>
              <button 
                onClick={() => addNode("ai_agent")}
                className="px-2.5 py-1 bg-primary hover:bg-primary text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
              >
                + AI Agent
              </button>
              <button 
                onClick={() => addNode("hangup")}
                className="px-2.5 py-1 bg-primary hover:bg-primary text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
              >
                + Kapat
              </button>
              <button 
                onClick={() => addNode("stargate_in")}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
              >
                + YG Girişi
              </button>
              <button 
                onClick={() => addNode("stargate_out")}
                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-extrabold rounded-lg transition cursor-pointer"
              >
                + YG Çıkışı
              </button>
            </div>
          </div>

          {/* Interactive Canvas (Scrollable viewport) */}
          <div 
            ref={canvasRef}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="flex-1 overflow-auto relative select-none bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px] z-10"
            onClick={() => {
              setSelectedNodeId(null);
              setSelectedConnectionId(null);
              setConnectingFrom(null);
            }}
          >
            {/* SVG Overlay for Connections */}
            <svg className="absolute top-0 left-0 pointer-events-none w-[2000px] h-[2000px] z-0">
              {connections.map((c) => {
                const start = getPortCoords(c.fromNode, c.fromPort);
                const end = getPortCoords(c.toNode, c.toPort);
                const isSelected = selectedConnectionId === c.id;
                const isSimActive = simVisitedNodeIds.includes(c.fromNode) && simVisitedNodeIds.includes(c.toNode);
                
                // SVG Bezier Curve
                const midX = (start.x + end.x) / 2;
                const pathData = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;
                
                return (
                  <g key={c.id}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className="cursor-pointer pointer-events-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedConnectionId(c.id);
                        setSelectedNodeId(null);
                      }}
                    />
                    <path
                      d={pathData}
                      fill="none"
                      stroke={isSelected ? "#ec4899" : isSimActive ? "#10b981" : "#94a3b8"}
                      strokeWidth={isSelected ? 3.5 : isSimActive ? 3.2 : 2.2}
                      className="transition-all"
                    />
                  </g>
                );
              })}

              {connectingFrom && (
                <path
                  d={`M ${getPortCoords(connectingFrom.nodeId, connectingFrom.portId).x} ${
                    getPortCoords(connectingFrom.nodeId, connectingFrom.portId).y
                  } C ${(getPortCoords(connectingFrom.nodeId, connectingFrom.portId).x + mousePos.x) / 2} ${
                    getPortCoords(connectingFrom.nodeId, connectingFrom.portId).y
                  }, ${(getPortCoords(connectingFrom.nodeId, connectingFrom.portId).x + mousePos.x) / 2} ${
                    mousePos.y
                  }, ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={2.2}
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {/* Absolute Positioned Nodes container */}
            <div className="absolute top-0 left-0 w-[2000px] h-[2000px] pointer-events-none z-10">
               {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isSimVisited = simVisitedNodeIds.includes(node.id);
                const dims = getNodeDimensions(node);

                // Check stargate pairing
                let isPortalPaired = false;
                if (node.type === "stargate_in" || node.type === "stargate_out") {
                  const portalValue = node.value?.trim();
                  if (portalValue) {
                    const otherType = node.type === "stargate_in" ? "stargate_out" : "stargate_in";
                    isPortalPaired = nodes.some(
                      (n) => n.type === otherType && n.value?.trim() === portalValue && n.id !== node.id
                    );
                  }
                }

                return (
                  <div
                    key={node.id}
                    style={{ left: node.x, top: node.y, width: dims.w, height: dims.h }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className={`absolute pointer-events-auto bg-white dark:bg-slate-900 border rounded-xl shadow-lg flex flex-col select-none ${
                      isSelected 
                        ? "border-pink-500 shadow-pink-500/5 ring-1 ring-pink-500" 
                        : isSimVisited
                          ? "border-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.3)] ring-2 ring-emerald-500/60"
                          : isPortalPaired
                            ? node.type === "stargate_in"
                              ? "border-cyan-400 dark:border-cyan-600 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/30"
                              : "border-teal-400 dark:border-teal-600 shadow-[0_0_12px_rgba(45,212,191,0.25)] ring-1 ring-teal-400/30"
                            : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    
                    {/* Left side input port connector dot */}
                    {!["trunk_start", "start", "did", "stargate_out"].includes(node.type) && (
                      <div
                        className="port absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        onMouseUp={(e) => {
                          handlePortMouseUp(e, node.id, "input");
                        }}
                        onClick={(e) => handlePortClick(e, node.id, "input", true)}
                        title="Giriş Portu"
                      />
                    )}

                    {/* Right side output port connector dot */}
                    {["start", "play", "setvalue", "transfer", "tts", "whatsapp_notify", "did", "stargate_out"].includes(node.type) && (
                      <div
                        className={`port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 ${node.type === "start" ? "bg-emerald-500" : "bg-primary"} border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition`}
                        onMouseDown={(e) => {
                          handlePortMouseDown(e, node.id, "output");
                        }}
                        onMouseUp={(e) => {
                          handlePortMouseUp(e, node.id, "output");
                        }}
                        onClick={(e) => handlePortClick(e, node.id, "output", false)}
                        title="Çıkış Portu (Devam)"
                      />
                    )}
                    
                    <div
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                      className={`px-3 py-2 rounded-t-xl cursor-move flex items-center justify-between font-bold text-[10px] text-white shrink-0 ${
                        node.type === "start" ? "bg-emerald-600" :
                        node.type === "play" ? "bg-primary" :
                        node.type === "menu" ? "bg-sky-500" :
                        node.type === "user_input" ? "bg-violet-600" :
                        node.type === "http_request" ? "bg-amber-600" :
                        node.type === "setvalue" ? "bg-primary" :
                        node.type === "transfer" ? "bg-slate-600" :
                        node.type === "tts" ? "bg-fuchsia-600" :
                        node.type === "whatsapp_notify" ? "bg-emerald-600" :
                        node.type === "sr" ? "bg-primary" :
                        node.type === "compare" ? "bg-cyan-600" :
                        node.type === "loop" ? "bg-orange-600" :
                        node.type === "timerule" ? "bg-primary" :
                        node.type === "ai_agent" ? "bg-primary" :
                        node.type === "hangup" ? "bg-primary" :
                        node.type === "stargate_in" ? "bg-cyan-600" :
                        node.type === "stargate_out" ? "bg-teal-600" : "bg-slate-600"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {node.type === "start" && <Play size={11} className="fill-current" />}
                        {node.type === "play" && <Volume2 size={11} />}
                        {node.type === "menu" && <Shuffle size={11} />}
                        {node.type === "user_input" && <Hash size={11} />}
                        {node.type === "http_request" && <Server size={11} />}
                        {node.type === "setvalue" && <Database size={11} />}
                        {node.type === "transfer" && <ArrowRight size={11} />}
                        {node.type === "tts" && <Volume2 size={11} />}
                        {node.type === "whatsapp_notify" && <FileText size={11} />}
                        {node.type === "sr" && <Layers size={11} />}
                        {node.type === "compare" && <GitBranch size={11} />}
                        {node.type === "loop" && <Activity size={11} />}
                        {node.type === "timerule" && <Clock size={11} />}
                        {node.type === "ai_agent" && <Bot size={11} />}
                        {node.type === "hangup" && <PhoneOff size={11} />}
                        {node.type === "stargate_in" && <LogOut size={11} className="rotate-90 text-cyan-200" />}
                        {node.type === "stargate_out" && <LogIn size={11} className="rotate-90 text-teal-200" />}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNodeId(node.id);
                            setSelectedConnectionId(null);
                          }}
                          className="truncate hover:underline cursor-pointer"
                          title="Detayları açmak için tıklayın"
                        >
                          {node.title}
                        </span>
                      </div> 
                      
                      {node.type === "start" ? (
                        <span title="Sabit Başlangıç Noktası (Silinemez)" className="text-emerald-100/90 shrink-0">
                          <Lock size={10} />
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setNodes((prev) => prev.filter((n) => n.id !== node.id));
                            setConnections((prev) => prev.filter((c) => c.fromNode !== node.id && c.toNode !== node.id));
                            if (selectedNodeId === node.id) setSelectedNodeId(null);
                          }}
                          className="text-white hover:text-red-200 transition"
                          title="Düğümü Sil"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>

                    {/* Node Body Content */}
                    <div className="p-2.5 flex flex-col gap-1.5 relative">

                      {/* Custom Render per type */}
                      {node.type === "play" && (
                        <div className="flex flex-col gap-1 w-full text-left">
                          <div className="text-[10px] font-bold text-slate-600 dark:text-slate-350 border border-slate-150 dark:border-slate-800 rounded bg-slate-50/50 dark:bg-slate-950/40 p-1.5 truncate text-center font-mono">
                            {node.extra_fields?.announcement_type === "tts" ? "TTS: " : ""}
                            {node.value || "Anons seçilmedi"}
                          </div>
                          <div className="text-[8px] font-bold text-amber-650 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100/40 rounded px-1.5 py-0.5 text-center truncate italic">
                            {node.extra_fields?.announcement_type === "tts" ? "Metin Okuma" : "Ses Dosyası"}
                          </div>
                        </div>
                      )}

                      {node.type === "setvalue" && (
                        <div className="text-[10px] font-mono text-primary dark:text-blue-400 border border-blue-50 dark:border-slate-800 rounded bg-blue-50/20 dark:bg-slate-950/40 p-1.5 truncate text-center font-bold">
                          {node.value || "Değişken = değer"}
                        </div>
                      )}

                      {node.type === "transfer" && (() => {
                        const currentType = node.extra_fields?.transfer_type || "dahili";
                        const isQueue = currentType === "kuyruk";
                        const isExternal = currentType === "external";
                        const isApiDynamic = currentType === "api_dynamic";
                        const isCallFlow = currentType === "call_flow";

                        const matchedUser = currentType === "dahili" && systemUsers.find((u) => String(u.extension || u.id) === String(node.value));
                        const matchedQueue = isQueue && queues.find((q) => String(q.extension || q.id) === String(node.value));
                        const matchedTrunk = (isExternal || isApiDynamic) && trunks.find((t) => String(t.id) === String(node.extra_fields?.trunk_id));
                        const matchedWf = isCallFlow && workflows.find((w) => String(w.id) === String(node.value));

                        let label = "Dahili";
                        if (isQueue) label = "Kuyruk";
                        if (isExternal) label = "Harici";
                        if (isApiDynamic) label = "API Numarası";
                        if (isCallFlow) label = "Alt Akış";

                        let displayVal = node.value || "Belirlenmedi";
                        if (matchedUser) {
                          displayVal = `${matchedUser.extension || matchedUser.id} - ${matchedUser.full_name || matchedUser.username || ''}`;
                        } else if (matchedQueue) {
                          displayVal = `${matchedQueue.extension || matchedQueue.id} - ${matchedQueue.name || ''}`;
                        } else if (isExternal) {
                          const tName = matchedTrunk ? (matchedTrunk.name || `Trunk #${matchedTrunk.id}`) : "Dış Hat";
                          const pfx = node.extra_fields?.prefix ? `[${node.extra_fields.prefix}] ` : "";
                          displayVal = `${pfx}${node.value || 'Numara Yok'} (${tName})`;
                        } else if (isApiDynamic) {
                          const tName = matchedTrunk ? (matchedTrunk.name || `Trunk #${matchedTrunk.id}`) : "Dış Hat";
                          const pfx = node.extra_fields?.prefix ? `[${node.extra_fields.prefix}] ` : "";
                          displayVal = `${pfx}{{api_numara}} (${tName})`;
                        } else if (isCallFlow) {
                          displayVal = matchedWf ? matchedWf.name : `Akış #${node.value || '?'}`;
                        }

                        return (
                          <div className="flex flex-col gap-1 w-full text-left">
                            <div className="flex items-center gap-1.5 bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded p-1.5">
                              <ArrowRight size={10} className="text-primary shrink-0" />
                              <span className="text-[9px] font-extrabold text-slate-600 dark:text-slate-350 truncate" title={`${label}: ${displayVal}`}>
                                {label}: {displayVal}
                              </span>
                            </div>
                            {node.extra_fields?.play_announcement && (
                              <div className="text-[8px] font-bold text-primary dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/40 rounded px-1.5 py-0.5 text-center truncate italic">
                                {node.extra_fields?.announcement_type === "tts" ? "Anons (TTS)" : "Anons (Ses Dosyası)"}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {node.type === "tts" && (
                        <div className="text-[9px] font-semibold text-fuchsia-700 dark:text-fuchsia-300 border border-fuchsia-100 dark:border-slate-800/60 rounded bg-fuchsia-50/30 dark:bg-slate-950/40 p-2 leading-relaxed overflow-hidden h-[70px] text-justify select-text whitespace-normal break-words italic">
                          {node.value || "{{api_mesaj}}"}
                        </div>
                      )}

                      {node.type === "whatsapp_notify" && (
                        <div className="flex flex-col gap-1 w-full text-left">
                          <div className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded px-1.5 py-0.5 truncate">
                            Alıcı: {node.extra_fields?.recipient || "{{arayan_numara}}"}
                          </div>
                          <div className="text-[8px] text-slate-500 dark:text-slate-400 truncate italic px-1">
                            {node.value || "WhatsApp Mesajı"}
                          </div>
                        </div>
                      )}

                      {node.type === "user_input" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[8px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40 rounded px-1.5 py-0.5 text-center truncate">
                            {node.extra_fields?.min_digits || 1}-{node.extra_fields?.max_digits || 11} Hane ({node.extra_fields?.submit_key || "#"}) | Hata: {node.extra_fields?.max_retries || 3}x
                          </div>
                          {[
                            { id: "output", label: "Tuşlandı (Başarılı)" },
                            { id: "error", label: "Hata / Limit Doldu" }
                          ].map((opt) => (
                            <div key={opt.id} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/65 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-600 dark:text-slate-400 font-mono text-[8px]">{opt.label}</span>
                              <div
                                className={`port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 ${opt.id === "error" ? "bg-rose-500" : "bg-emerald-500"} border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition`}
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt.id)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt.id)}
                                onClick={(e) => handlePortClick(e, node.id, opt.id, false)}
                                title={opt.label}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "http_request" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[8px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded px-1.5 py-0.5 text-center truncate font-mono" title={node.value}>
                            {node.extra_fields?.method || "POST"} • {node.extra_fields?.response_key || "target_number"}
                          </div>
                          {[
                            { id: "success", label: "Başarılı (Numara)" },
                            { id: "error", label: "Bulunamadı / Hata" }
                          ].map((opt) => (
                            <div key={opt.id} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/65 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-600 dark:text-slate-400 font-mono text-[8px]">{opt.label}</span>
                              <div
                                className={`port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 ${opt.id === "error" ? "bg-rose-500" : "bg-emerald-500"} border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition`}
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt.id)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt.id)}
                                onClick={(e) => handlePortClick(e, node.id, opt.id, false)}
                                title={opt.label}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "loop" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[8px] font-bold text-orange-700 dark:text-orange-300 bg-orange-50/50 dark:bg-orange-950/30 border border-orange-200/60 dark:border-orange-800/40 rounded px-1.5 py-0.5 text-center truncate">
                            Maksimum Tekrar: {node.extra_fields?.max_loops || node.value || 3} Kez
                          </div>
                          {[
                            { id: "loop", label: "Tekrarla (Döngü)" },
                            { id: "completed", label: "Limit Doldu (Çıkış)" }
                          ].map((opt) => (
                            <div key={opt.id} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/65 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-600 dark:text-slate-400 font-mono text-[8px]">{opt.label}</span>
                              <div
                                className={`port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 ${opt.id === "completed" ? "bg-rose-500" : "bg-orange-500"} border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition`}
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt.id)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt.id)}
                                onClick={(e) => handlePortClick(e, node.id, opt.id, false)}
                                title={opt.label}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Multiple Output Ports List Nodes */}
                      {node.type === "menu" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          {node.value && (
                            <div className="text-[8px] font-bold text-sky-650 dark:text-sky-400 bg-sky-50/40 dark:bg-sky-950/20 border border-sky-100/40 rounded px-1.5 py-0.5 text-center truncate italic mb-0.5">
                              {node.extra_fields?.announcement_type === "tts" ? "TTS" : "Ses"} • Hata: {node.extra_fields?.max_retries || 3}x
                            </div>
                          )}
                          {node.options?.map((opt) => (
                            <div key={opt} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/60 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-600 dark:text-slate-400 font-mono text-[9px]">{opt}</span>
                              <div
                                className="port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition"
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt)}
                                onClick={(e) => handlePortClick(e, node.id, opt, false)}
                                title={`Tuş ${opt} çıkışı`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "compare" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[8px] font-bold text-cyan-700 dark:text-cyan-300 bg-cyan-50/50 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-800/40 rounded px-1.5 py-0.5 text-center truncate font-mono">
                            {node.extra_fields?.source || "tuslanan"} {node.extra_fields?.operator === "not_equals" ? "!=" : node.extra_fields?.operator === "starts_with" ? "başlar" : node.extra_fields?.operator === "contains" ? "içerir" : "=="} {node.value || "0"}
                          </div>
                          {[
                            { id: "true", label: "Evet (Doğru)" },
                            { id: "false", label: "Hayır (Yanlış)" }
                          ].map((opt) => (
                            <div key={opt.id} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/65 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-600 dark:text-slate-400 font-mono text-[8px]">{opt.label}</span>
                              <div
                                className={`port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 ${opt.id === "false" ? "bg-rose-500" : "bg-emerald-500"} border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition`}
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt.id)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt.id)}
                                onClick={(e) => handlePortClick(e, node.id, opt.id, false)}
                                title={`${opt.label} çıkışı`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "sr" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[8px] text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1.5 space-y-0.5">
                            <div>Context: <span className="font-mono text-primary dark:text-purple-400">{node.value}</span></div>
                            <div>Değişken: <span className="font-mono text-slate-655 dark:text-slate-350">{node.extra_fields?.variable_name}</span></div>
                          </div>
                          
                          {["90", "75", "50", "none"].map((opt) => (
                            <div key={opt} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/50 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-500 dark:text-slate-400 font-mono text-[9px]">{opt}</span>
                              <div
                                className="port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition"
                                onClick={(e) => handlePortClick(e, node.id, opt, false)}
                                title={`Güven skoru ${opt}% çıkışı`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "start" && (() => {
                        const refs = getWorkflowEntryReferences(currentWfId);
                        return (
                          <div className="flex flex-col gap-1 w-full text-center">
                            <div className="text-[9px] font-extrabold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/50 rounded bg-emerald-50/60 dark:bg-emerald-950/30 px-2 py-1 truncate">
                              Çağrı Giriş Noktası
                            </div>
                            <div className="text-[8px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                              {refs.length > 0 ? `${refs.length} Kural / Kuyruk Bağlı` : "Gelen Kuraldan Tetiklenir"}
                            </div>
                          </div>
                        );
                      })()}

                      {node.type === "timerule" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[9px] font-bold text-primary dark:text-amber-400 p-1 text-center truncate italic">
                            {node.extra_fields?.start_time || "09:00"} - {node.extra_fields?.end_time || "18:00"}
                          </div>
                          {[
                            { id: "active", label: "Mesai Saatleri" },
                            { id: "inactive", label: "Mesai Dışı" },
                            { id: "holiday", label: "Resmi Tatil" }
                          ].map((opt) => (
                            <div key={opt.id} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/60 dark:bg-slate-950/30 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-500 dark:text-slate-400 font-mono text-[8px]">{opt.label}</span>
                              <div
                                className="port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition"
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt.id)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt.id)}
                                onClick={(e) => handlePortClick(e, node.id, opt.id, false)}
                                title={`${opt.label} çıkışı`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "ai_agent" && (
                        <div className="flex flex-col gap-1 w-full text-[10px] font-bold">
                          <div className="text-[10px] font-mono text-primary dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 rounded bg-purple-50/20 dark:bg-slate-950/40 p-2 truncate text-center flex items-center justify-center gap-1.5 h-8 mb-0.5">
                            <Bot size={12} className="text-primary animate-pulse" />
                            <span className="truncate font-bold">
                              {aiAgents.find((a) => a.id === node.value)?.name || node.value || "Temsilci Seçilmedi"}
                            </span>
                          </div>
                          {node.options?.map((opt) => (
                            <div key={opt} className="h-[30px] flex items-center justify-end pr-2 bg-slate-50/60 dark:bg-slate-955/35 border border-slate-100/60 dark:border-slate-850 rounded-lg relative select-none">
                              <span className="text-slate-655 dark:text-slate-400 font-mono text-[9px] truncate mr-1.5">{opt}</span>
                              <div
                                className="port absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary border-2 border-white dark:border-slate-900 rounded-full cursor-pointer z-20 hover:scale-125 transition"
                                onMouseDown={(e) => handlePortMouseDown(e, node.id, opt)}
                                onMouseUp={(e) => handlePortMouseUp(e, node.id, opt)}
                                onClick={(e) => handlePortClick(e, node.id, opt, false)}
                                title={`Yönlendirme: ${opt}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {node.type === "hangup" && (
                        <div className="text-[10px] font-mono text-primary dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded bg-rose-50/20 dark:bg-slate-950/40 p-2 truncate text-center font-bold flex items-center justify-center gap-1.5 h-8">
                          <PhoneOff size={11} className="text-primary animate-pulse" />
                          <span className="truncate">Aramayı Sonlandır</span>
                        </div>
                      )}

                      {node.type === "stargate_in" && (
                        <div className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/30 rounded bg-cyan-50/20 dark:bg-slate-950/40 p-2 truncate text-center font-bold flex items-center justify-center gap-1.5 h-8">
                          <LogOut size={11} className="rotate-90 text-cyan-500" />
                          <span className="truncate">Giriş: {node.value || "Belirlenmedi"}</span>
                        </div>
                      )}

                      {node.type === "stargate_out" && (
                        <div className="text-[10px] font-mono text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/30 rounded bg-teal-50/20 dark:bg-slate-950/40 p-2 truncate text-center font-bold flex items-center justify-center gap-1.5 h-8">
                          <LogIn size={11} className="rotate-90 text-teal-500" />
                          <span className="truncate">Çıkış: {node.value || "Belirlenmedi"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* Unified Node Settings Native Dialog Modal */}
      {(() => {
        const node = isNodeModalOpen ? nodes.find((n) => n.id === selectedNodeId) : null;
        return (
          <dialog
            ref={nodeDialogRef}
            aria-labelledby="callflow-node-modal-title"
            onClose={closeNodeModal}
            onClick={(e) => {
              if (e.target === nodeDialogRef.current) closeNodeModal();
            }}
            className="m-auto p-0 bg-transparent border-0 max-w-lg w-[calc(100%-2rem)] overscroll-contain backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm backdrop:overflow-hidden backdrop:overscroll-contain focus:outline-none"
          >
            {node && (
            <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-h-[85vh] overflow-y-auto overscroll-contain p-6 flex flex-col gap-4 text-slate-800 dark:text-slate-100">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl text-white ${
                    node.type === "start" ? "bg-emerald-600" :
                    node.type === "play" ? "bg-primary" :
                    node.type === "menu" ? "bg-sky-500" :
                    node.type === "user_input" ? "bg-violet-600" :
                    node.type === "http_request" ? "bg-amber-600" :
                    node.type === "setvalue" ? "bg-primary" :
                    node.type === "transfer" ? "bg-slate-600" :
                    node.type === "tts" ? "bg-fuchsia-600" :
                    node.type === "whatsapp_notify" ? "bg-emerald-600" :
                    node.type === "sr" ? "bg-primary" :
                    node.type === "compare" ? "bg-cyan-600" :
                    node.type === "loop" ? "bg-orange-600" :
                    node.type === "timerule" ? "bg-primary" :
                    node.type === "ai_agent" ? "bg-primary" :
                    node.type === "hangup" ? "bg-primary" :
                    node.type === "stargate_in" ? "bg-cyan-600" :
                    node.type === "stargate_out" ? "bg-teal-600" : "bg-slate-600"
                  }`}>
                    {node.type === "start" && <Play size={16} className="fill-current" />}
                    {node.type === "play" && <Volume2 size={16} />}
                    {node.type === "menu" && <Shuffle size={16} />}
                    {node.type === "user_input" && <Hash size={16} />}
                    {node.type === "http_request" && <Server size={16} />}
                    {node.type === "setvalue" && <Database size={16} />}
                    {node.type === "transfer" && <ArrowRight size={16} />}
                    {node.type === "tts" && <Volume2 size={16} />}
                    {node.type === "whatsapp_notify" && <FileText size={16} />}
                    {node.type === "sr" && <Layers size={16} />}
                    {node.type === "compare" && <GitBranch size={16} />}
                    {node.type === "loop" && <Activity size={16} />}
                    {node.type === "timerule" && <Clock size={16} />}
                    {node.type === "ai_agent" && <Bot size={16} />}
                    {node.type === "hangup" && <PhoneOff size={16} />}
                    {node.type === "stargate_in" && <LogOut size={16} className="rotate-90" />}
                    {node.type === "stargate_out" && <LogIn size={16} className="rotate-90" />}
                  </div>
                  <div className="text-left">
                    <h3 id="callflow-node-modal-title" className="text-sm font-bold text-slate-800 dark:text-white">{node.title} Ayarları</h3>
                    <span className="text-[10px] text-slate-400 font-mono">Tip: {node.type.toUpperCase()} | ID: {node.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeNodeModal}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-655 dark:hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Title Input */}
              <div className="flex flex-col gap-1.5 text-left">
                <label htmlFor="cf-node-title-input" className="text-[10px] text-slate-450 dark:text-slate-505 font-bold uppercase tracking-wider">Düğüm Başlığı</label>
                <input
                  id="cf-node-title-input"
                  type="text"
                  value={node.title}
                  onChange={(e) => handleUpdateNodeField("title", e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-bold"
                />
              </div>

              {/* Dynamic Forms based on node type */}
              
              {/* Start ("Akış Başlangıcı") Node Information & Linked Entry Points */}
              {node.type === "start" && (() => {
                const refs = getWorkflowEntryReferences(currentWfId);
                return (
                  <div className="flex flex-col gap-3 text-left">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-200/70 dark:border-emerald-800/50 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                        <Play size={13} className="fill-current shrink-0" />
                        <span>Sabit Akış Başlangıç Noktası</span>
                      </div>
                      <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80 leading-relaxed">
                        Dış hat (DID) numara eşleştirmeleri merkezi olarak <strong>Gelen Arama Kuralları</strong> ekranından yapılır. Bu akış hedef olarak seçildiğinde çağrı doğrudan bu başlangıç noktasının sağ çıkış portundan akışa girer.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <span>Bu Akışı Tetikleyen Giriş Noktaları</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono text-[9px]">
                          {refs.length} Bağlantı
                        </span>
                      </div>

                      {refs.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 text-center space-y-1">
                          <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            Henüz bir Gelen Arama Kuralına bağlanmadı
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Akışı kaydettikten sonra <strong>Gelen Arama Kuralları</strong> veya <strong>Kuyruk</strong> ekranından hedef olarak bu akışı seçebilirsiniz.
                          </div>
                        </div>
                      ) : (
                        <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 max-h-[180px] overflow-y-auto">
                          {refs.map((r, i) => (
                            <div key={i} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                {r.kind === "inbound" ? (
                                  <PhoneIncoming size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                ) : (
                                  <Users size={14} className={text + " shrink-0"} />
                                )}
                                <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{r.name}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                                {r.detail}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Play Node parameter */}
              {node.type === "play" && (() => {
                const normCat = (a) => {
                  const v = String(a?.type || "").trim().toLowerCase();
                  if (v === "moh" || v === "music" || v === "hold_music") return "moh";
                  if (v === "system" || v === "sistem") return "system";
                  return "announcement";
                };
                const customList = announcements
                  .filter((a) => normCat(a) === "announcement")
                  .map((a) => ({ id: a.filename || a.id, name: a.name || a.title || a.filename || "Anons" }));
                const systemList = announcements
                  .filter((a) => normCat(a) === "system")
                  .map((a) => ({ id: a.filename || a.id, name: a.name || a.title || a.filename || "Sistem Anonsu" }));
                const combinedSpeech = [...customList, ...systemList];
                const defaultRecordedId = customList[0]?.id || systemList[0]?.id || "";

                const announcementType = node.extra_fields?.announcement_type || "recorded";

                return (
                  <div className="flex flex-col gap-4 text-left">
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase tracking-wider">Anons Seçenekleri</div>
                      
                      {/* Announcement Type Selector */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 font-bold">Anons Türü</span>
                        <div className="flex gap-2">
                          {[
                            { id: "recorded", label: "Kayıtlı Anons Dosyası" },
                            { id: "tts", label: "Ses Sentezleme (TTS)" }
                          ].map((t) => {
                            const active = announcementType === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  handleUpdateNodeExtraField("announcement_type", t.id);
                                  const defVal = t.id === "recorded" ? defaultRecordedId : "";
                                  handleUpdateNodeField("value", defVal);
                                }}
                                className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-bold transition cursor-pointer ${
                                  active
                                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-250"
                                    : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                                }`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Input based on type */}
                      {announcementType === "tts" ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-455 dark:text-slate-555 font-bold">Seslendirilecek Mesaj Metni (TTS)</span>
                          <textarea
                            value={node.value || ""}
                            onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                            placeholder="Örn: Şirketimize hoş geldiniz..."
                            rows={4}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none leading-relaxed italic"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-455 dark:text-slate-555 font-bold">Anons Dosyası Seçin (Özel / Sistem Anonsları)</span>
                          <select
                            value={node.value || ""}
                            onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          >
                            <option value="">-- Anons Dosyası Seçin --</option>
                            {node.value && !combinedSpeech.some((a) => String(a.id) === String(node.value)) && (
                              <option value={node.value}>{node.value} (Kayıtlı Anons)</option>
                            )}
                            {customList.length > 0 && (
                              <optgroup label="Özel Anonslar">
                                {customList.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                ))}
                              </optgroup>
                            )}
                            {systemList.length > 0 && (
                              <optgroup label="Sistem Anonsları">
                                {systemList.map((a) => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Menu Node parameter */}
              {node.type === "menu" && (() => {
                const customMenuList = announcements
                  .filter((a) => {
                    const v = String(a?.type || "").trim().toLowerCase();
                    return v !== "moh" && v !== "music" && v !== "hold_music" && v !== "system" && v !== "sistem";
                  })
                  .map((a) => ({ id: a.filename || a.id, name: a.name || a.title || a.filename || "Anons" }));
                const announcementsList = customMenuList.length > 0
                  ? customMenuList
                  : [{ id: "default_announcement.wav", name: "Varsayılan Anons" }];

                const announcementType = node.extra_fields?.announcement_type || "recorded";
                const allKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#", "timeout", "error"];
                const activeKeys = node.options || [];

                return (
                  <div className="flex flex-col gap-4 text-left">
                    
                    {/* Announcement Section */}
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase tracking-wider">Menü Karşılama Anonsu</div>
                      
                      {/* Announcement Type Selector */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 font-bold">Anons Türü</span>
                        <div className="flex gap-2">
                          {[
                            { id: "recorded", label: "Kayıtlı Anons Dosyası" },
                            { id: "tts", label: "Ses Sentezleme (TTS)" }
                          ].map((t) => {
                            const active = announcementType === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  handleUpdateNodeExtraField("announcement_type", t.id);
                                  // Reset main node value
                                  const defVal = t.id === "recorded" ? announcementsList[0].id : "";
                                  handleUpdateNodeField("value", defVal);
                                }}
                                className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-bold transition cursor-pointer ${
                                  active
                                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-250"
                                    : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                                }`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Input based on type */}
                      {announcementType === "tts" ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-455 dark:text-slate-555 font-bold">Seslendirilecek Mesaj Metni (TTS)</span>
                          <textarea
                            value={node.value || ""}
                            onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                            placeholder="Örn: Bilgi işlem için 1'i, satış için 2'yi tuşlayınız..."
                            rows={3}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none leading-relaxed italic"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-455 dark:text-slate-555 font-bold">Özel Anons Dosyası Seçin</span>
                          <select
                            value={node.value || ""}
                            onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          >
                            <option value="">-- Özel Anonslar&apos;dan Seçin --</option>
                            {node.value && !announcementsList.some((a) => String(a.id) === String(node.value)) && (
                              <option value={node.value}>{node.value} (Kayıtlı Anons)</option>
                            )}
                            {announcementsList.map((a) => (
                              <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Digit Selection Section */}
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="flex flex-col text-left">
                        <span className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase tracking-wider">Menü Seçenekleri (Tuşlar)</span>
                        <span className="text-[9px] text-slate-400">Aktif etmek istediğiniz tuşlama seçeneklerini seçin.</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 mt-1 text-[10px] font-extrabold">
                        {allKeys.map((key) => {
                          const isActive = activeKeys.includes(key);
                          const isSpecial = ["timeout", "error"].includes(key);
                          
                          let labelText = key;
                          if (key === "timeout") labelText = "Z.Aşımı";
                          if (key === "error") labelText = "Hata";

                          return (
                            <button
                              type="button"
                              key={key}
                              onClick={() => {
                                let newOptions = [...activeKeys];
                                if (isActive) {
                                  newOptions = newOptions.filter((o) => o !== key);
                                  // Clean up connections originating from this port
                                  setConnections((prev) => prev.filter((c) => !(c.fromNode === node.id && c.fromPort === key)));
                                } else {
                                  newOptions.push(key);
                                  // Sort logically
                                  const order = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "*", "#", "timeout", "error"];
                                  newOptions.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                                }
                                handleUpdateNodeField("options", newOptions);
                              }}
                              className={`py-2 rounded-lg border text-center transition cursor-pointer ${
                                isActive
                                  ? isSpecial
                                    ? "bg-rose-50 dark:bg-rose-950/20 text-rose-650 border-rose-250 font-black"
                                    : "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-250 font-black"
                                  : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              {labelText}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Error / Retry Counter (Hata Sayıcı) Section */}
                    <div className="flex flex-col gap-3 p-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-rose-700 dark:text-rose-300 font-extrabold uppercase tracking-wider">Hata Sayıcı & Tekrar Deneme (Retry Counter)</span>
                        <span className="text-[9px] font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold">
                          Maks: {node.extra_fields?.max_retries || 3} Deneme
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-500 font-bold">Hatalı Tuşlama / Zaman Aşımı Tekrar Sayısı</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={node.extra_fields?.max_retries ?? 3}
                            onChange={(e) => handleUpdateNodeExtraField("max_retries", Number(e.target.value) || 1)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-500 font-bold">Tuşlama Bekleme Süresi (Sn)</span>
                          <input
                            type="number"
                            min={2}
                            max={30}
                            value={node.extra_fields?.timeout_seconds ?? 8}
                            onChange={(e) => handleUpdateNodeExtraField("timeout_seconds", Number(e.target.value) || 8)}
                            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 font-bold">Hatalı Tuşlamada Okunacak Uyarı Mesajı (TTS)</span>
                        <input
                          type="text"
                          value={node.extra_fields?.retry_prompt ?? "Hatalı tuşlama yaptınız, lütfen tekrar deneyin."}
                          onChange={(e) => handleUpdateNodeExtraField("retry_prompt", e.target.value)}
                          placeholder="Hatalı tuşlama yaptınız, lütfen tekrar deneyin."
                          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>

                  </div>
                );
              })()}

              {/* User Input (Multi-Digit Collector + Error Counter) Node parameter */}
              {node.type === "user_input" && (() => {
                const customMenuList = announcements
                  .filter((a) => {
                    const v = String(a?.type || "").trim().toLowerCase();
                    return v !== "moh" && v !== "music" && v !== "hold_music" && v !== "system" && v !== "sistem";
                  })
                  .map((a) => ({ id: a.filename || a.id, name: a.name || a.title || a.filename || "Anons" }));
                const announcementsList = customMenuList.length > 0
                  ? customMenuList
                  : [{ id: "default_announcement.wav", name: "Varsayılan Anons" }];
                const announcementType = node.extra_fields?.announcement_type || "tts";

                return (
                  <div className="flex flex-col gap-4 text-left">
                    <div className="p-3 rounded-2xl bg-violet-50/60 dark:bg-violet-950/25 border border-violet-200/70 dark:border-violet-800/50 space-y-1">
                      <div className="text-xs font-extrabold text-violet-800 dark:text-violet-300 flex items-center gap-1.5">
                        <Hash size={13} /> Çok Haneli Numara Tuşlatma (Sipariş / Abone / T.C. No)
                      </div>
                      <p className="text-[10px] text-violet-700/90 dark:text-violet-300/80 leading-relaxed">
                        Arayanın tuşladığı numara otomatik olarak <code className="font-mono font-bold bg-white/80 dark:bg-slate-900 px-1.5 py-0.5 rounded">{"{{tuslanan_numara}}"}</code> değişkenine kaydedilir ve bir sonraki <strong>Web Servis (API)</strong> veya <strong>Karşılaştırma</strong> düğümünde kullanılır.
                      </p>
                    </div>

                    {/* Prompt Announcement */}
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="text-[10px] text-slate-450 dark:text-slate-550 font-bold uppercase tracking-wider">Karşılama / Tuşlama İsteme Anonsu</div>
                      <div className="flex gap-2">
                        {[
                          { id: "tts", label: "Ses Sentezleme (TTS)" },
                          { id: "recorded", label: "Kayıtlı Anons Dosyası" }
                        ].map((t) => {
                          const active = announcementType === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleUpdateNodeExtraField("announcement_type", t.id)}
                              className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-bold transition cursor-pointer ${
                                active
                                  ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-250"
                                  : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              {t.label}
                            </button>
                          );
                        })}
                      </div>

                      {announcementType === "tts" ? (
                        <textarea
                          value={node.value || ""}
                          onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                          placeholder="Örn: Lütfen sipariş numaranızı tuşlayıp kare tuşuna basınız..."
                          rows={2}
                          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none leading-relaxed italic"
                        />
                      ) : (
                        <select
                          value={node.value || ""}
                          onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                          className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                        >
                          <option value="">-- Özel Anons Seçin --</option>
                          {announcementsList.map((a) => (
                            <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Digit Constraints */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 font-bold">Min. Hane Sayısı</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={node.extra_fields?.min_digits ?? 1}
                          onChange={(e) => handleUpdateNodeExtraField("min_digits", Number(e.target.value) || 1)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 font-bold">Maks. Hane Sayısı</span>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={node.extra_fields?.max_digits ?? 11}
                          onChange={(e) => handleUpdateNodeExtraField("max_digits", Number(e.target.value) || 11)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 font-bold">Onay / Bitirme Tuşu</span>
                        <select
                          value={node.extra_fields?.submit_key ?? "#"}
                          onChange={(e) => handleUpdateNodeExtraField("submit_key", e.target.value)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                        >
                          <option value="#"># (Kare Tuşu)</option>
                          <option value="*">* (Yıldız Tuşu)</option>
                          <option value="none">Tuşsuz (Süre Sonunda)</option>
                        </select>
                      </div>
                    </div>

                    {/* Error Counter / Retry Settings */}
                    <div className="flex flex-col gap-2.5 p-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-2xl">
                      <div className="text-[10px] text-rose-700 dark:text-rose-300 font-extrabold uppercase tracking-wider">
                        Hata Sayıcı (Eksik veya Yanlış Tuşlama Yönetimi)
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-500 font-bold">Maksimum Hatalı Deneme Hakkı</span>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={node.extra_fields?.max_retries ?? 3}
                            onChange={(e) => handleUpdateNodeExtraField("max_retries", Number(e.target.value) || 1)}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-500 font-bold">Tuşlama Zaman Aşımı (Sn)</span>
                          <input
                            type="number"
                            min={2}
                            max={25}
                            value={node.extra_fields?.timeout_seconds ?? 6}
                            onChange={(e) => handleUpdateNodeExtraField("timeout_seconds", Number(e.target.value) || 6)}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-500 font-bold">Hatalı / Eksik Girişte Okunacak Uyarı Mesajı</span>
                        <input
                          type="text"
                          value={node.extra_fields?.retry_prompt ?? "Eksik veya hatalı tuşlama yaptınız, lütfen tekrar deneyin."}
                          onChange={(e) => handleUpdateNodeExtraField("retry_prompt", e.target.value)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* HTTP Request / Web Service / Script Node parameter */}
              {node.type === "http_request" && (
                <div className="flex flex-col gap-3.5 text-left">
                  <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Server size={13} /> Dış Web Servis / Script (JSON Webhook)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateNodeField("value", "http://127.0.0.1:8000/api/v1/demo/order-lookup");
                          handleUpdateNodeExtraField("method", "POST");
                          handleUpdateNodeExtraField("body_template", '{\n  "siparis_no": "{{tuslanan_numara}}",\n  "arayan": "{{arayan_numara}}",\n  "hat": "{{aranan_hat}}"\n}');
                          handleUpdateNodeExtraField("response_key", "target_number");
                          handleUpdateNodeExtraField("response_tts_key", "message");
                        }}
                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[9px] font-bold transition cursor-pointer"
                        title="Dahili test servisini otomatik doldur (12345 -> 05321112233 döner)"
                      >
                        Örnek Test Servisi Doldur
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-700/90 dark:text-amber-300/80 leading-relaxed">
                      Müşterinin API adresine JSON gönderir, dönen yanıttaki telefon numarasını <code className="font-mono font-bold">{"{{api_numara}}"}</code> değişkenine kaydeder.
                    </p>
                  </div>

                  {/* Method & URL */}
                  <div className="flex gap-2">
                    <div className="w-24 flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Metot</span>
                      <select
                        value={node.extra_fields?.method || "POST"}
                        onChange={(e) => handleUpdateNodeExtraField("method", e.target.value)}
                        className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-extrabold text-slate-850 dark:text-white focus:outline-none"
                      >
                        <option value="POST">POST</option>
                        <option value="GET">GET</option>
                      </select>
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Müşteri Web Servis (API) URL Adresi</span>
                      <input
                        type="text"
                        value={node.value || ""}
                        onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                        placeholder="https://musteri.com/api/siparis-sorgula"
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-850 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Optional Auth Header */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Yetkilendirme Başlığı / Bearer Token (Opsiyonel)</span>
                    <input
                      type="text"
                      value={node.extra_fields?.auth_header || ""}
                      onChange={(e) => handleUpdateNodeExtraField("auth_header", e.target.value)}
                      placeholder="Örn: Bearer eyJhbGci... veya X-API-Key: gizli_anahtar"
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-850 dark:text-white focus:outline-none"
                    />
                  </div>

                  {/* JSON Body Template */}
                  {(node.extra_fields?.method || "POST") === "POST" && (
                    <div className="flex flex-col gap-1.5 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">Karşı Tarafa Gönderilecek JSON Şablonu</span>
                        <span className="text-[8px] text-slate-400">Değişken eklemek için tıklayın:</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {[
                          { tag: "{{tuslanan_numara}}", label: "Tuşlanan Numara" },
                          { tag: "{{arayan_numara}}", label: "Arayan Numara (ANI)" },
                          { tag: "{{aranan_hat}}", label: "Aranan Hat (DID)" },
                          { tag: "{{cagri_id}}", label: "Çağrı ID" }
                        ].map((chip) => (
                          <button
                            key={chip.tag}
                            type="button"
                            onClick={() => {
                              const cur = node.extra_fields?.body_template || "";
                              handleUpdateNodeExtraField("body_template", cur + chip.tag);
                            }}
                            className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded text-[9px] font-mono font-bold text-primary hover:bg-indigo-100 transition cursor-pointer"
                            title={`${chip.label} değişkenini ekle`}
                          >
                            + {chip.tag}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={4}
                        value={node.extra_fields?.body_template ?? '{\n  "girilen_kod": "{{tuslanan_numara}}",\n  "arayan": "{{arayan_numara}}"\n}'}
                        onChange={(e) => handleUpdateNodeExtraField("body_template", e.target.value)}
                        className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-850 dark:text-white focus:outline-none leading-relaxed"
                      />
                    </div>
                  )}

                  {/* Response Mapping */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-emerald-800 dark:text-emerald-300 font-bold">Dönen JSON&apos;daki Telefon Alanı</span>
                      <input
                        type="text"
                        value={node.extra_fields?.response_key ?? "target_number"}
                        onChange={(e) => handleUpdateNodeExtraField("response_key", e.target.value)}
                        placeholder="Örn: target_number, number, data.phone"
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-850 dark:text-white focus:outline-none"
                      />
                      <span className="text-[8px] text-slate-400">Örn: <code className="font-mono">target_number</code>, <code className="font-mono">number</code>, <code className="font-mono">data.phone</code></span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-emerald-800 dark:text-emerald-300 font-bold">Dönen Mesaj Alanı (Opsiyonel TTS)</span>
                      <input
                        type="text"
                        value={node.extra_fields?.response_tts_key ?? "message"}
                        onChange={(e) => handleUpdateNodeExtraField("response_tts_key", e.target.value)}
                        placeholder="Örn: message veya aciklama"
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-850 dark:text-white focus:outline-none"
                      />
                      <span className="text-[8px] text-slate-400">Dinamik TTS düğümünde <code className="font-mono">{"{{api_mesaj}}"}</code> ile okunur.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Setvalue Node parameter */}
              {node.type === "setvalue" && (
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Değişken Ataması</label>
                  <input
                    type="text"
                    value={node.value}
                    onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                    placeholder="Örn: MUSTERI_TIPI = 'VIP'"
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-mono"
                  />
                </div>
              )}

              {/* Transfer Node parameter */}
              {node.type === "transfer" && (() => {
                const extensionsList = systemUsers.length > 0
                  ? systemUsers.map((u) => ({
                      id: String(u.extension || u.id),
                      name: `${u.extension || u.id} - ${u.full_name || u.username || 'Abone'}`
                    }))
                  : [{ id: "1000", name: "1000 - ANIL ACAR" }];

                const queuesList = queues.length > 0
                  ? queues.map((q) => ({
                      id: String(q.extension || q.id),
                      name: `${q.extension || q.id} - ${q.name || 'Kuyruk'}`
                    }))
                  : [{ id: "2000", name: "2000 - PBX Kuyruğu" }];

                const trunksList = trunks.length > 0
                  ? trunks.map((t) => ({
                      id: String(t.id),
                      name: t.name || `Trunk #${t.id}`,
                      username: t.username || t.host || ""
                    }))
                  : [{ id: "1", name: "Operator_Trunk (İkon Telekom)", username: "908503607390" }];

                const otherWorkflowsList = workflows
                  .filter((w) => String(w.id) !== String(currentWfId))
                  .map((w) => ({ id: String(w.id), name: `${w.name} (#${w.id})` }));

                const transferSystemAnns = announcements
                  .filter((a) => {
                    const v = String(a?.type || "").trim().toLowerCase();
                    return v === "system" || v === "sistem";
                  })
                  .map((a) => ({
                    id: a.filename || a.id,
                    name: a.name || a.title || a.filename || "Sistem Anonsu"
                  }));
                const transferCustomAnns = announcements
                  .filter((a) => {
                    const v = String(a?.type || "").trim().toLowerCase();
                    return v !== "moh" && v !== "music" && v !== "hold_music" && v !== "system" && v !== "sistem";
                  })
                  .map((a) => ({
                    id: a.filename || a.id,
                    name: a.name || a.title || a.filename || "Özel Anons"
                  }));
                const announcementsList = [...transferSystemAnns, ...transferCustomAnns];

                const currentType = node.extra_fields?.transfer_type || "dahili";
                const playAnnouncement = node.extra_fields?.play_announcement || false;
                const announcementType = node.extra_fields?.announcement_type || "tts";

                const activeList = currentType === "dahili" ? extensionsList : queuesList;
                const isMatch = activeList.some((item) => String(item.id) === String(node.value));
                const selectedValue = isMatch ? String(node.value) : (activeList[0]?.id || "");

                return (
                  <div className="flex flex-col gap-4 text-left">
                    
                    {/* Destination Selection Section */}
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="text-[10px] text-slate-450 dark:text-slate-555 font-bold uppercase tracking-wider">Transfer Hedefi</div>
                      
                      {/* Transfer Target Type Select (5 Modes) */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 font-bold">Hedef Türü</span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "dahili", label: "Dahili Abone" },
                            { id: "kuyruk", label: "Kuyruk" },
                            { id: "external", label: "Harici Numara" },
                            { id: "api_dynamic", label: "API Numarası (Trunk)" },
                            { id: "call_flow", label: "Başka Arama Akışı" }
                          ].map((t) => {
                            const active = currentType === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  handleUpdateNodeExtraField("transfer_type", t.id);
                                  if (t.id === "dahili") {
                                    handleUpdateNodeField("value", extensionsList[0]?.id || "1000");
                                  } else if (t.id === "kuyruk") {
                                    handleUpdateNodeField("value", queuesList[0]?.id || "2000");
                                  } else if (t.id === "call_flow") {
                                    handleUpdateNodeField("value", otherWorkflowsList[0]?.id || "");
                                  } else if (t.id === "api_dynamic") {
                                    handleUpdateNodeField("value", "{{api_numara}}");
                                    if (!node.extra_fields?.trunk_id && trunksList.length > 0) {
                                      handleUpdateNodeExtraField("trunk_id", trunksList[0].id);
                                    }
                                  } else {
                                    handleUpdateNodeField("value", "");
                                    if (!node.extra_fields?.trunk_id && trunksList.length > 0) {
                                      handleUpdateNodeExtraField("trunk_id", trunksList[0].id);
                                    }
                                  }
                                }}
                                className={`py-1.5 px-2 rounded-lg border text-center text-[11px] font-bold transition cursor-pointer ${
                                  active
                                    ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-250"
                                    : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                                }`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Controls for specific destination */}
                      {(currentType === "external" || currentType === "api_dynamic") ? (
                        <div className="flex flex-col gap-3">
                          {currentType === "api_dynamic" ? (
                            <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                              <strong>Web Servis (API) Düğümünden</strong> dönen telefon numarası (<code className="font-mono font-bold">{"{{api_numara}}"}</code>) aşağıda seçtiğiniz <strong>Çıkış Trunk (Dış Hat)</strong> üzerinden otomatik aranır ve çağrı aktarılır.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-slate-400 font-bold">Harici Telefon Numarası</span>
                              <input
                                type="text"
                                value={node.value || ""}
                                onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                                placeholder="Örn: 05321234567 veya {{api_numara}}"
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold font-mono text-slate-850 dark:text-white focus:outline-none"
                              />
                            </div>
                          )}

                          {/* Outbound Trunk Selector */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-400 font-bold">Çıkış Yapılacak SIP Trunk (Dış Hat) Seçin</span>
                            <select
                              value={node.extra_fields?.trunk_id || (trunksList[0]?.id || "")}
                              onChange={(e) => handleUpdateNodeExtraField("trunk_id", e.target.value)}
                              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                            >
                              {trunksList.map((tr) => (
                                <option key={tr.id} value={tr.id}>
                                  {tr.name} {tr.username ? `(${tr.username})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Optional Prefix & Caller ID Mode */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-slate-400 font-bold">Numara Ön Eki / Prefix (Opsiyonel)</span>
                              <input
                                type="text"
                                value={node.extra_fields?.prefix || ""}
                                onChange={(e) => handleUpdateNodeExtraField("prefix", e.target.value)}
                                placeholder="Örn: 9 veya +90 (Boş bırakılabilir)"
                                className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-850 dark:text-white focus:outline-none"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-slate-400 font-bold">Giden Arayan Kimliği (Caller ID)</span>
                              <select
                                value={node.extra_fields?.caller_id_mode || "trunk_did"}
                                onChange={(e) => handleUpdateNodeExtraField("caller_id_mode", e.target.value)}
                                className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                              >
                                <option value="trunk_did">Santral / Trunk Numarası (Önerilen)</option>
                                <option value="orig_caller">Arayan Müşterinin Numarası</option>
                              </select>
                            </div>
                          </div>

                          {currentType === "api_dynamic" && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-slate-400 font-bold">API Numara Döndürmezse Yedek Hedef (Dahili / Kuyruk)</span>
                              <input
                                type="text"
                                value={node.extra_fields?.fallback_target || "1000"}
                                onChange={(e) => handleUpdateNodeExtraField("fallback_target", e.target.value)}
                                placeholder="Örn: 1000 veya 2000"
                                className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-850 dark:text-white focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      ) : currentType === "call_flow" ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] text-slate-400 font-bold">Bağlanacak Arama Akışı (Alt IVR Şeması) Seçin</span>
                          {otherWorkflowsList.length === 0 ? (
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-700 dark:text-amber-300">
                              Henüz başka bir arama akışı bulunmuyor. Büyük IVR&apos;ları bölmek için yeni bir arama akışı oluşturup buradan birbirine bağlayabilirsiniz.
                            </div>
                          ) : (
                            <select
                              value={node.value || (otherWorkflowsList[0]?.id || "")}
                              onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                            >
                              <option value="">-- Arama Akışı Seçin --</option>
                              {otherWorkflowsList.map((wf) => (
                                <option key={wf.id} value={wf.id}>{wf.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] text-slate-400 font-bold">
                            {currentType === "dahili" ? "Abone Seçin" : "Kuyruk Seçin"}
                          </span>
                          <select
                            value={selectedValue}
                            onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                          >
                            {currentType === "dahili" 
                              ? extensionsList.map((e) => (
                                  <option key={e.id} value={e.id}>{e.name}</option>
                                ))
                              : queuesList.map((q) => (
                                  <option key={q.id} value={q.id}>{q.name}</option>
                                ))
                            }
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Play Announcement Before Transfer Section */}
                    <div className="flex flex-col gap-3 p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800/80 rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col text-left">
                          <span className="text-[10px] text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">Transfer Öncesi Anons</span>
                          <span className="text-[9px] text-slate-400">Çağrı aktarılmadan önce arayana anons dinletilsin mi?</span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => handleUpdateNodeExtraField("play_announcement", !playAnnouncement)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            playAnnouncement ? "bg-primary" : "bg-slate-200 dark:bg-slate-800"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-205 ease-in-out ${
                              playAnnouncement ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {playAnnouncement && (
                        <div className="flex flex-col gap-3 border-t border-slate-150 dark:border-slate-850/60 pt-3 animate-in fade-in duration-200">
                          {/* Announcement Type Selector */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-400 font-bold">Anons Türü</span>
                            <div className="flex gap-2">
                              {[
                                { id: "tts", label: "Ses Sentezleme (TTS)" },
                                { id: "recorded", label: "Kayıtlı Anons Dosyası" }
                              ].map((t) => {
                                const active = announcementType === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleUpdateNodeExtraField("announcement_type", t.id)}
                                    className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-bold transition cursor-pointer ${
                                      active
                                        ? "bg-indigo-50 dark:bg-indigo-950/20 text-primary border-indigo-250"
                                        : "bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800"
                                    }`}
                                  >
                                    {t.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Announcement Input Fields */}
                          {announcementType === "tts" ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-slate-455 dark:text-slate-555 font-bold">Seslendirilecek Mesaj Metni (TTS)</span>
                              <textarea
                                value={node.extra_fields?.announcement_tts || ""}
                                onChange={(e) => handleUpdateNodeExtraField("announcement_tts", e.target.value)}
                                placeholder="Örn: Müşteri temsilcisine aktarılıyorsunuz, lütfen bekleyin..."
                                rows={3}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none leading-relaxed italic"
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-slate-455 dark:text-slate-555 font-bold">Transfer Anonsu Seçin (Sistem / Özel Anonslar)</span>
                              <select
                                value={node.extra_fields?.announcement_recorded || ""}
                                onChange={(e) => handleUpdateNodeExtraField("announcement_recorded", e.target.value)}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                              >
                                <option value="">-- Anons Seçin --</option>
                                {node.extra_fields?.announcement_recorded &&
                                  !announcementsList.some((a) => String(a.id) === String(node.extra_fields?.announcement_recorded)) && (
                                    <option value={node.extra_fields.announcement_recorded}>
                                      {node.extra_fields.announcement_recorded} (Kayıtlı Anons)
                                    </option>
                                  )}
                                {transferSystemAnns.length > 0 && (
                                  <optgroup label="Sistem Anonsları">
                                    {transferSystemAnns.map((a) => (
                                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                    ))}
                                  </optgroup>
                                )}
                                {transferCustomAnns.length > 0 && (
                                  <optgroup label="Özel Anonslar">
                                    {transferCustomAnns.map((a) => (
                                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                          )}

                        </div>
                      )}
                    </div>

                  </div>
                );
              })()}

              {/* TTS Node parameter */}
              {node.type === "tts" && (
                <div className="flex flex-col gap-2 text-left">
                  <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">Seslendirilecek Dinamik Mesaj Metni (TTS)</label>
                  <div className="flex flex-wrap gap-1">
                    {["{{api_mesaj}}", "{{tuslanan_numara}}", "{{api_numara}}", "{{arayan_numara}}"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleUpdateNodeField("value", (node.value || "") + " " + tag)}
                        className="px-2 py-0.5 bg-fuchsia-50 dark:bg-fuchsia-950/40 border border-fuchsia-200 dark:border-fuchsia-800 rounded text-[9px] font-mono font-bold text-fuchsia-700 dark:text-fuchsia-300 hover:bg-fuchsia-100 transition cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={node.value}
                    onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                    placeholder="Örn: {{api_mesaj}} veya Girdiğiniz {{tuslanan_numara}} numarası için işleminiz yapılıyor..."
                    rows={4}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none leading-relaxed italic"
                  />
                </div>
              )}

              {/* WhatsApp Notification Node parameter */}
              {node.type === "whatsapp_notify" && (
                <div className="flex flex-col gap-3 text-left">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">Alıcı Telefon Numarası</label>
                    <input
                      type="text"
                      value={node.extra_fields?.recipient ?? "{{arayan_numara}}"}
                      onChange={(e) => handleUpdateNodeExtraField("recipient", e.target.value)}
                      placeholder="{{arayan_numara}} veya 05321234567"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-850 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">Gönderilecek WhatsApp Mesajı</label>
                    <div className="flex flex-wrap gap-1">
                      {["{{tuslanan_numara}}", "{{api_mesaj}}", "{{api_numara}}", "{{arayan_numara}}"].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleUpdateNodeField("value", (node.value || "") + " " + tag)}
                          className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={node.value || ""}
                      onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                      placeholder="Merhaba, {{tuslanan_numara}} numaralı talebiniz alınmıştır."
                      rows={3}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* SR Node parameters */}
              {node.type === "sr" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Tanıma Context Şablonu</label>
                    <input
                      type="text"
                      value={node.value}
                      onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                      placeholder="Örn: evethayir veya ilSecimi"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider">Sonucun Kaydedileceği Değişken</label>
                    <input
                      type="text"
                      value={node.extra_fields?.variable_name || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNodes((prev) => prev.map((n) => {
                          if (n.id === node.id) {
                            return {
                              ...n,
                              extra_fields: {
                                ...n.extra_fields,
                                variable_name: val
                              }
                            };
                          }
                          return n;
                        }));
                      }}
                      placeholder="Örn: TEYIT_DURUMU"
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Compare (Karşılaştırma / Koşul) Node parameter */}
              {node.type === "compare" && (
                <div className="flex flex-col gap-3 text-left">
                  <div className="p-3 rounded-2xl bg-cyan-50/60 dark:bg-cyan-950/25 border border-cyan-200/70 dark:border-cyan-800/50 text-[10px] text-cyan-800 dark:text-cyan-300 leading-relaxed">
                    Seçilen değişkeni belirttiğiniz değerle karşılaştırır. Koşul sağlanırsa <strong>Evet (true)</strong> portundan, sağlanmazsa <strong>Hayır (false)</strong> portundan devam eder.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase">Kontrol Edilecek Değer</label>
                      <select
                        value={node.extra_fields?.source || "tuslanan_numara"}
                        onChange={(e) => handleUpdateNodeExtraField("source", e.target.value)}
                        className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                      >
                        <option value="tuslanan_numara">Tuşlanan Numara (DTMF)</option>
                        <option value="api_numara">API&apos;den Dönen Numara</option>
                        <option value="api_mesaj">API&apos;den Dönen Mesaj</option>
                        <option value="arayan_numara">Arayan Numara (Caller ID)</option>
                        <option value="aranan_hat">Aranan Hat (DID)</option>
                        <option value="input_length">Tuşlanan Hane Uzunluğu</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase">Karşılaştırma Operatörü</label>
                      <select
                        value={node.extra_fields?.operator || "equals"}
                        onChange={(e) => handleUpdateNodeExtraField("operator", e.target.value)}
                        className="px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                      >
                        <option value="equals">Eşittir (==)</option>
                        <option value="not_equals">Eşit Değildir (!=)</option>
                        <option value="starts_with">İle Başlar</option>
                        <option value="contains">İçerir</option>
                        <option value="length_equals">Hane Sayısı Eşittir</option>
                        <option value="greater_than">Büyüktür (&gt;)</option>
                        <option value="less_than">Küçüktür (&lt;)</option>
                        <option value="not_empty">Dolu / Boş Değil</option>
                        <option value="is_empty">Boş</option>
                      </select>
                    </div>
                  </div>
                  {!["not_empty", "is_empty"].includes(node.extra_fields?.operator) && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] text-slate-400 font-bold uppercase">Karşılaştırılacak Değer (Örn: 0, 100, VIP)</label>
                      <input
                        type="text"
                        value={node.value || ""}
                        onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                        placeholder="Örn: 0"
                        className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-mono font-bold"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Loop / Counter (Döngü / Sayaç) Node parameter */}
              {node.type === "loop" && (
                <div className="flex flex-col gap-3 text-left">
                  <div className="p-3 rounded-2xl bg-orange-50/60 dark:bg-orange-950/25 border border-orange-200/70 dark:border-orange-800/50 text-[10px] text-orange-800 dark:text-orange-300 leading-relaxed">
                    Çağrı bu düğüme her geldiğinde sayacı 1 artırır. Belirttiğiniz limite kadar <strong>Tekrarla (loop)</strong> çıkışına, limit dolduğunda ise <strong>Limit Doldu (completed)</strong> çıkışına yönlendirir.
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-slate-400 font-bold uppercase">Maksimum Tekrar Sayısı</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={node.extra_fields?.max_loops ?? (Number(node.value) || 3)}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 1;
                        handleUpdateNodeField("value", String(v));
                        handleUpdateNodeExtraField("max_loops", v);
                      }}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-850 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Timerule Node parameters */}
              {node.type === "timerule" && (
                <div className="flex flex-col gap-3">
                  <div className={`p-3 rounded-xl border ${borderLight} ${lightBg} flex flex-col gap-2`}>
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <Clock size={13} className={text} />
                        Merkezi Mesai & Resmi Tatil Takvimini Kullan
                      </span>
                      <input
                        type="checkbox"
                        checked={node.extra_fields?.use_system_work_hours !== false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNodes((prev) =>
                            prev.map((n) =>
                              n.id === node.id
                                ? {
                                    ...n,
                                    extra_fields: {
                                      ...n.extra_fields,
                                      use_system_work_hours: checked
                                    }
                                  }
                                : n
                            )
                          );
                        }}
                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                      />
                    </label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Aktif olduğunda sistem genelindeki haftalık çalışma saatleri, öğle molası ve resmi/dini tatil günleri otomatik değerlendirilir.
                    </p>
                    {onOpenWorkHours && (
                      <button
                        type="button"
                        onClick={onOpenWorkHours}
                        className={`self-start text-[10px] font-bold ${text} hover:underline flex items-center gap-1`}
                      >
                        Mesai & Resmi Tatil Ayarlarını Aç <ArrowRight size={11} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Başlangıç Saati</label>
                      <input
                        type="text"
                        placeholder="09:00"
                        value={node.extra_fields?.start_time || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes((prev) => prev.map((n) => {
                            if (n.id === node.id) {
                              return {
                                ...n,
                                extra_fields: {
                                  ...n.extra_fields,
                                  start_time: val
                                }
                              };
                            }
                            return n;
                          }));
                        }}
                        className="px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs focus:outline-none font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Bitiş Saati</label>
                      <input
                        type="text"
                        placeholder="18:00"
                        value={node.extra_fields?.end_time || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes((prev) => prev.map((n) => {
                            if (n.id === node.id) {
                              return {
                                ...n,
                                extra_fields: {
                                  ...n.extra_fields,
                                  end_time: val
                                }
                              };
                            }
                            return n;
                          }));
                        }}
                        className="px-2 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs focus:outline-none font-mono text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Aktif Günler</label>
                    <div className="grid grid-cols-4 gap-1 mt-1 text-[9px] font-bold">
                      {[
                        { id: "Mon", label: "Pzt" },
                        { id: "Tue", label: "Sal" },
                        { id: "Wed", label: "Çar" },
                        { id: "Thu", label: "Per" },
                        { id: "Fri", label: "Cum" },
                        { id: "Sat", label: "Cmt" },
                        { id: "Sun", label: "Paz" }
                      ].map((day) => {
                        const isChecked = node.extra_fields?.days?.includes(day.id) || false;
                        return (
                          <button
                            type="button"
                            key={day.id}
                            onClick={() => {
                              let newDays = [...(node.extra_fields?.days || [])];
                              if (isChecked) {
                                newDays = newDays.filter((d) => d !== day.id);
                              } else {
                                newDays.push(day.id);
                              }
                              setNodes((prev) => prev.map((n) => {
                                if (n.id === node.id) {
                                  return {
                                    ...n,
                                    extra_fields: {
                                      ...n.extra_fields,
                                      days: newDays
                                    }
                                  };
                                }
                                return n;
                              }));
                            }}
                            className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${
                              isChecked 
                                ? "bg-amber-50 dark:bg-amber-950/20 text-amber-650 border-amber-250" 
                                : "bg-slate-50 dark:bg-slate-950 text-slate-400 border-slate-200 dark:border-slate-800"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Holidays / Özel Günler */}
                  <div className="flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 text-left">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Özel Günler / Resmi Tatiller</label>
                    
                    {/* Add holiday inputs row */}
                    <div className="flex gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold">Tarih (Örn: 29.10 veya 15.07.2026)</span>
                        <input
                          type="text"
                          value={newHolidayDate}
                          onChange={(e) => setNewHolidayDate(e.target.value)}
                          placeholder="GG.AA veya GG.AA.YYYY"
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold">Açıklama (Örn: Bayram)</span>
                        <input
                          type="text"
                          value={newHolidayLabel}
                          onChange={(e) => setNewHolidayLabel(e.target.value)}
                          placeholder="Açıklama girin"
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddHoliday(node.id)}
                        className="self-end px-3 py-1.5 bg-primary hover:bg-primary text-white text-xs font-bold rounded-xl h-[34px] transition cursor-pointer"
                      >
                        Ekle
                      </button>
                    </div>

                    {/* Holiday List container */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Tanımlı Tatil Günleri</div>
                      <div className="flex flex-col border border-slate-150 dark:border-slate-850 rounded-xl max-h-[140px] overflow-y-auto divide-y divide-slate-150 dark:divide-slate-850 bg-slate-50/20">
                        {getHolidayList(node).length === 0 ? (
                          <div className="text-center py-4 text-[10px] text-slate-400 font-semibold italic">
                            Tanımlı tatil günü bulunmamaktadır.
                          </div>
                        ) : (
                          getHolidayList(node).map((holiday, idx) => (
                            <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-950/40 transition">
                              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{holiday}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteHoliday(node.id, idx)}
                                className="p-1 text-slate-400 hover:text-rose-650 dark:hover:text-rose-455 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Agent Node parameters */}
              {node.type === "ai_agent" && (
                <div className="flex flex-col gap-4 text-left">
                  {/* Select Agent */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">Gemini Yapay Zeka Temsilcisi</label>
                    <select
                      value={node.value}
                      onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-bold"
                    >
                      <option value="">-- Temsilci Seçin --</option>
                      {aiAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.model})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Transfer Rules / Intent Routing */}
                  <div className="flex flex-col gap-2.5 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-primary dark:text-purple-400 flex items-center gap-1">
                        <ArrowRight size={13} /> Çağrı Aktarma Kuralları (Intent Routing) 
                      </span>
                      <p className="text-[10px] text-slate-500 dark:text-slate-450 leading-normal">
                        Yapay zeka görüşme esnasında algılayacağı müşteri taleplerini girin. Tanımladığınız her talep, kanvasta bu düğüm üzerinde ayrı birer **Çıkış Portu** oluşturacak ve istediğiniz düğüme (Anons, Menü, Transfer vb.) bağlayabileceksiniz.
                      </p>
                    </div>

                    {/* Add Transfer Rule Form */}
                    <div className="flex gap-2 items-center bg-slate-50/50 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 p-2.5 rounded-xl">
                      <div className="flex-1 flex flex-col gap-1">
                        <span className="text-[9px] text-slate-400 dark:text-slate-550 font-bold">Talep / Intent (Örn: satis, destek, muhasebe)</span>
                        <input
                          type="text"
                          value={newAgentIntent}
                          onChange={(e) => setNewAgentIntent(e.target.value)}
                          placeholder="Talep adı (intent)"
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddAgentOption(node.id)}
                        className="px-4 py-1.5 bg-primary hover:bg-primary text-white text-xs font-bold rounded-xl h-[34px] transition cursor-pointer self-end shrink-0"
                      >
                        Ekle
                      </button>
                    </div>

                    {/* Configured Rules List */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Aktif Yönlendirme Çıkışları (Intents)</div>
                      <div className="flex flex-col border border-slate-150 dark:border-slate-850 rounded-xl max-h-[140px] overflow-y-auto divide-y divide-slate-150 dark:divide-slate-850 bg-slate-50/20">
                        {(!node.options || node.options.length === 0) ? (
                          <div className="text-center py-4 text-[10px] text-slate-400 font-semibold italic">
                            Tanımlı aktarma çıkışı bulunmamaktadır.
                          </div>
                        ) : (
                          node.options.map((opt, idx) => (
                            <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-955 transition text-xs">
                              <span className="font-bold text-primary dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded text-[10px]">
                                {opt}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAgentOption(node.id, opt)}
                                className="p-1 text-slate-400 hover:text-primary dark:hover:text-primary rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Hangup / Kapat Node parameters */}
              {node.type === "hangup" && (
                <div className="flex flex-col gap-1.5 text-left">
                  <div className="p-3 bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100/40 dark:border-rose-900/35 rounded-xl flex flex-col gap-2">
                    <span className="text-xs font-bold text-primary dark:text-rose-400 flex items-center gap-1.5">
                      <PhoneOff size={13} className="text-primary" /> Çağrıyı Sonlandırma Düğümü
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                      Bu düğüme gelen aramalar otomatik olarak sonlandırılır (hangup). Bu işlem sonrasında akış biter.
                    </p>
                  </div>
                </div>
              )}

              {/* Stargate In / Yıldız Geçidi Girişi parameters */}
              {node.type === "stargate_in" && (
                <div className="flex flex-col gap-3 text-left">
                  <div className="p-3 bg-cyan-50/20 dark:bg-cyan-950/10 border border-cyan-100/40 dark:border-cyan-900/35 rounded-xl flex flex-col gap-2">
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                      <LogOut size={13} className="rotate-90 text-cyan-500" /> Yıldız Geçidi Girişi (Portal Entrance)
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                      Çağrıyı aynı isimli <strong>Yıldız Geçidi Çıkışı</strong> düğümüne kablosuz olarak aktarır. Böylece karmaşık bağlantı çizgilerinden kaçınabilirsiniz.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Geçit (Portal) Adı</label>
                    <input
                      type="text"
                      value={node.value}
                      onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-bold"
                      placeholder="Örn: Ana Menü veya YG-1"
                    />
                  </div>
                </div>
              )}

              {/* Stargate Out / Yıldız Geçidi Çıkışı parameters */}
              {node.type === "stargate_out" && (
                <div className="flex flex-col gap-3 text-left">
                  <div className="p-3 bg-teal-50/20 dark:bg-teal-950/10 border border-teal-100/40 dark:border-teal-900/35 rounded-xl flex flex-col gap-2">
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                      <LogIn size={13} className="rotate-90 text-teal-500" /> Yıldız Geçidi Çıkışı (Portal Exit)
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                      Bu düğüm, aynı isimli <strong>Yıldız Geçidi Girişi</strong> düğümünden ışınlanan çağrının çıkış noktasıdır.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Geçit (Portal) Adı</label>
                    <input
                      type="text"
                      value={node.value}
                      onChange={(e) => handleUpdateNodeField("value", e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-slate-955 border border-slate-200/65 dark:border-slate-800 rounded-xl text-xs text-slate-850 dark:text-white focus:outline-none font-bold"
                      placeholder="Örn: Ana Menü veya YG-1"
                    />
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800 mt-2">
                <button
                  type="button"
                  onClick={closeNodeModal}
                  className={`px-5 py-2.5 ${bg} ${hover} text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer`}
                >
                  Tamam
                </button>
              </div>
            </div>
            )}
          </dialog>
        );
      })()}

      {/* Live CallFlow Simulator Modal */}
      {isSimulatorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setIsSimulatorOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto p-6 flex flex-col gap-4 text-slate-800 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600 text-white">
                  <Play size={16} className="fill-current" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Canlı Akış Simülatörü (Call Flow Test Aracı)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Gerçek telefon araması yapmadan tuşlamaları, karşılaştırmaları ve müşteri Web Servis (API) sorgularını adım adım test edin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulatorOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Simulation Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/50 border border-slate-150 dark:border-slate-800 rounded-2xl text-left">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Arayan Numara (Caller ID)</label>
                <input
                  type="text"
                  value={simCallerNumber}
                  onChange={(e) => setSimCallerNumber(e.target.value)}
                  placeholder="05321234567"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-850 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Aranan Hat (DID)</label>
                <input
                  type="text"
                  value={simDidNumber}
                  onChange={(e) => setSimDidNumber(e.target.value)}
                  placeholder="08503607390"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-850 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">Tuşlanan Numara / Kod (DTMF)</label>
                <input
                  type="text"
                  value={simDtmfInput}
                  onChange={(e) => setSimDtmfInput(e.target.value)}
                  placeholder="Örn: 12345 veya 0"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-mono font-extrabold text-emerald-700 dark:text-emerald-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="text-slate-400 self-center font-bold">Hızlı Test Kodları:</span>
                {[
                  { val: "12345", label: "12345 (Kurye: 05321112233)" },
                  { val: "99999", label: "99999 (Mağaza: 05449998877)" },
                  { val: "100", label: "100 (VIP: 1000)" },
                  { val: "0", label: "0 (Operatör)" }
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setSimDtmfInput(preset.val)}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 rounded-lg font-mono text-[9px] font-bold transition cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={simRunning}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Play size={13} className="fill-current" />
                {simRunning ? "Simüle Ediliyor..." : "Simülasyonu Başlat"}
              </button>
            </div>

            {/* Simulation Results */}
            {simResult && (
              <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-3 text-left">
                {/* Final Destination Summary Banner */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  simResult.final_result?.status === "ok"
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
                    : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Simülasyon Nihai Sonucu
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                      {simResult.final_result?.target_label || simResult.message || "Tamamlandı"}
                    </span>
                    {simResult.final_result?.trunk_id && (
                      <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 font-bold">
                        Çıkış Trunk ID: #{simResult.final_result.trunk_id} | Hedef Numara: {simResult.final_result.extension}
                      </span>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                    {simResult.steps?.length || 0} Adım İşlendi
                  </span>
                </div>

                {/* Flow Variables Snapshot */}
                {simResult.flow_vars && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-wrap gap-2 text-[10px] font-mono">
                    <span className="font-bold text-slate-400">Değişkenler:</span>
                    <span className="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-bold">
                      tuslanan_numara = &quot;{simResult.flow_vars.tuslanan_numara || ""}&quot;
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold">
                      api_numara = &quot;{simResult.flow_vars.api_numara || ""}&quot;
                    </span>
                    {simResult.flow_vars.api_mesaj && (
                      <span className="px-2 py-0.5 rounded bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 font-bold">
                        api_mesaj = &quot;{simResult.flow_vars.api_mesaj}&quot;
                      </span>
                    )}
                  </div>
                )}

                {/* Step-by-Step Trace */}
                <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                  {(simResult.steps || []).map((st, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-150 dark:border-slate-800/80 flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center justify-center shrink-0">
                            {st.step}
                          </span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-100">{st.title}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                            {st.node_type}
                          </span>
                        </div>
                        {st.port && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-primary">
                            Çıkış: {st.port}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 pl-7">
                        {st.detail}
                      </div>
                      {st.http_detail && (
                        <div className="ml-7 mt-1 p-2 rounded-lg bg-slate-900 text-emerald-300 font-mono text-[10px] overflow-x-auto">
                          <div>HTTP {st.http_detail.status_code} ({st.http_detail.elapsed_ms} ms) — Çıkarılan Numara: <strong>{st.http_detail.extracted_number || "Yok"}</strong></div>
                          <div className="text-slate-400 truncate mt-0.5">Yanıt: {st.http_detail.raw_preview}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
