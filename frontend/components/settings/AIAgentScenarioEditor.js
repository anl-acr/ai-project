import React, { useState, useEffect, useRef } from "react";
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
  Edit2,
  Search,
  ArrowLeft,
  Server,
  PhoneOff,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  RefreshCw,
  PhoneCall,
  UserCheck,
  Send,
  Users
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

// Pre-built scenario templates
const SCENARIO_TEMPLATES = {
  sales: {
    name: "Satış & Ürün Danışmanlığı Senaryosu",
    description: "Müşteriyi selamlama, ürün teklifi sunma, fiyat sorgulama ve onay halinde satış temsilcisine aktarma akışı.",
    nodes: [
      { id: "node-1", type: "greeting", x: 60, y: 150, title: "Açılış & Selamlama", data: { text: "Merhaba! ben şirketimizin yapay zeka satış asistanıyım. Ürünlerimiz ve kampanyalarımız hakkında bilgi almak ister misiniz?", tone: "attractive" } },
      { id: "node-2", type: "intent_branch", x: 380, y: 150, title: "Müşteri Yanıt Kontrolü", data: { intents: [
        { key: "yes", label: "Müşteri İstekli / Evet Dedi", targetNode: "node-3" },
        { key: "no", label: "Müşteri İlgilenmiyor / Hayır Dedi", targetNode: "node-6" },
        { key: "transfer", label: "İnsan Temsilci İstedi", targetNode: "node-5" }
      ]} },
      { id: "node-3", type: "dialogue", x: 720, y: 80, title: "Ürün Tanıtımı & Teklif", data: { script: "Harika! Bu ay %20 indirimli Kurumsal Bulut Santral paketimizi sunuyoruz. Fiyatlandırma hakkında detaylı bilgi almak ister misiniz?" } },
      { id: "node-4", type: "kvkk", x: 1060, y: 80, title: "KVKK & Onay Kontrolü", data: { consent_text: "Devam etmeden önce kişisel verilerinizin işlenmesine onay veriyor musunuz?" } },
      { id: "node-5", type: "transfer", x: 1060, y: 280, title: "Satış Temsilcisine Aktar", data: { target_type: "queue", target: "2000", target_name: "2000 - Satış Kuyruğu", announcement: "Sizi satış uzmanımıza aktarıyorum, lütfen hatta kalınız." } },
      { id: "node-6", type: "hangup", x: 720, y: 320, title: "Kapanış & Teşekkür", data: { farewell: "Zaman ayırdığınız için teşekkür ederiz. İyi günler dileriz!" } }
    ],
    connections: [
      { id: "c1", fromNode: "node-1", fromPort: "out", toNode: "node-2", toPort: "in" },
      { id: "c2", fromNode: "node-2", fromPort: "yes", toNode: "node-3", toPort: "in" },
      { id: "c3", fromNode: "node-2", fromPort: "no", toNode: "node-6", toPort: "in" },
      { id: "c4", fromNode: "node-2", fromPort: "transfer", toNode: "node-5", toPort: "in" },
      { id: "c5", fromNode: "node-3", fromPort: "out", toNode: "node-4", toPort: "in" },
      { id: "c6", fromNode: "node-4", fromPort: "out", toNode: "node-5", toPort: "in" }
    ]
  },
  support: {
    name: "Teknik Destek & Arıza Kaydı Senaryosu",
    description: "Müşterinin teknik sorununu dinleme, çözüm önerme ve arıza kaydı oluşturma akışı.",
    nodes: [
      { id: "node-1", type: "greeting", x: 60, y: 150, title: "Açılış & Destek Karşılama", data: { text: "Merhaba, Teknik Destek asistanınızım. Yaşadığınız sorunu kısaca özetleyebilir misiniz?", tone: "calm" } },
      { id: "node-2", type: "intent_branch", x: 380, y: 150, title: "Sorun Türü Tespiti", data: { intents: [
        { key: "internet", label: "İnternet / Bağlantı Kesintisi", targetNode: "node-3" },
        { key: "hardware", label: "Cihaz Arızası", targetNode: "node-4" }
      ]} },
      { id: "node-3", type: "dialogue", x: 720, y: 80, title: "Modem Reset Yönlendirmesi", data: { script: "Lütfen modeminizi 10 saniye kapatıp tekrar açmayı deneyiniz. Sorun devam ederse sizi uzman teknik ekibimize yönlendiriyorum." } },
      { id: "node-4", type: "form_capture", x: 720, y: 280, title: "Arıza Formu Oluşturma", data: { fields: ["Ad Soyad", "Abone No", "Arıza Tanımı"] } },
      { id: "node-5", type: "transfer", x: 1060, y: 150, title: "Teknik Ekibe Transfer", data: { target_type: "extension", target: "1000", target_name: "1000 - ANIL ACAR", announcement: "Teknik uzmanımıza yönlendiriliyorsunuz." } }
    ],
    connections: [
      { id: "c1", fromNode: "node-1", fromPort: "out", toNode: "node-2", toPort: "in" },
      { id: "c2", fromNode: "node-2", fromPort: "internet", toNode: "node-3", toPort: "in" },
      { id: "c3", fromNode: "node-2", fromPort: "hardware", toNode: "node-4", toPort: "in" },
      { id: "c4", fromNode: "node-3", fromPort: "out", toNode: "node-5", toPort: "in" },
      { id: "c5", fromNode: "node-4", fromPort: "out", toNode: "node-5", toPort: "in" }
    ]
  }
};

export default function AIAgentScenarioEditor({ agent, backendHost = "localhost:8000", onBack }) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight, colorCode } = useTheme();
  
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // System Users and Queues for Transfer Node Selection
  const [systemUsers, setSystemUsers] = useState([]);
  const [systemQueues, setSystemQueues] = useState([]);
  const [targetSearch, setTargetSearch] = useState("");

  // Dragging state for canvas nodes
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Node editing modal/drawer state
  const [editingNode, setEditingNode] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // General Status & Feedback
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // AI Natural Language Scenario Builder Engine
  const [aiPromptText, setAiPromptText] = useState("");
  const [generatingScenario, setGeneratingScenario] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Test Simulator Panel state
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [simulating, setSimulating] = useState(false);

  const canvasRef = useRef(null);
  const API_BASE = getApiBaseUrl(backendHost);

  // AI Scenario Generator Engine via Backend AI Service + Semantic Parser
  const handleGenerateScenarioFromPrompt = async (inputPrompt) => {
    const prompt = (inputPrompt || aiPromptText).trim();
    if (!prompt) return;

    setGeneratingScenario(true);

    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-agents/generate-scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
          setConnections(data.connections || []);
          setSelectedNodeId(null);
          setAiPromptText("");
          setIsAiModalOpen(false);
          setGeneratingScenario(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Backend scenario generation API failed, using semantic parser:", err);
    }

    // Semantic Parser Fallback
    const lower = prompt.toLowerCase();
    const rawLines = prompt.split(/\n+|\d+[\.\)]|•|-/).map(l => l.trim()).filter(Boolean);
    const lines = rawLines.length > 0 ? rawLines : prompt.split('.').map(l => l.trim()).filter(Boolean);

    let generatedNodes = [];
    let generatedConns = [];

    // 1. Greeting Node (from user text)
    const firstSentence = lines[0] || prompt;
    const greetingText = firstSentence.length > 130 ? firstSentence.substring(0, 127) + "..." : firstSentence;

    generatedNodes.push({
      id: "node-1",
      type: "greeting",
      x: 60,
      y: 160,
      title: "1. Açılış & Karşılama",
      data: { text: greetingText, tone: "friendly" }
    });

    let currentStep = 2;
    let lastNodeId = "node-1";
    let currentX = 380;

    const remainingLines = lines.slice(1);

    // 2. Check for KVKK
    if (lower.includes("kvkk") || lower.includes("onay") || lower.includes("izin") || lower.includes("aydınlatma")) {
      const kvkkLine = remainingLines.find(l => /kvkk|onay|izin/i.test(l)) || "Devam etmeden önce kişisel verilerinizin işlenmesine onay veriyor musunuz?";
      const kvkkId = `node-${currentStep}`;
      generatedNodes.push({
        id: kvkkId,
        type: "kvkk",
        x: currentX,
        y: 160,
        title: `${currentStep}. KVKK & Onay Kontrolü`,
        data: { consent_text: kvkkLine }
      });
      generatedConns.push({
        id: `c-${lastNodeId}-${kvkkId}`,
        fromNode: lastNodeId,
        fromPort: "out",
        toNode: kvkkId,
        toPort: "in"
      });
      lastNodeId = kvkkId;
      currentStep++;
      currentX += 340;
    }

    // 3. Check for Intent Branching
    const branchTriggers = ["eğer", "ise", "derse", "seçerse", "istediğinde", "isterse", "tercih", "veya", "ya da"];
    const hasBranch = remainingLines.some(l => branchTriggers.some(bt => l.toLowerCase().includes(bt))) || (lower.includes("satış") && lower.includes("destek"));

    if (hasBranch) {
      const branchId = `node-${currentStep}`;
      const branchLines = remainingLines.filter(l => branchTriggers.some(bt => l.toLowerCase().includes(bt)) || /satış|destek|iade|rehber|temsilci|bilgi/i.test(l));
      const activeBranchLines = branchLines.length > 0 ? branchLines : ["Satış veya Ürün Talebi", "Teknik Destek veya Arıza", "Diğer / İnsan Temsilci"];

      const intents = activeBranchLines.slice(0, 4).map((bl, idx) => ({
        key: `intent_${idx + 1}`,
        label: bl.length > 35 ? bl.substring(0, 32) + "..." : bl,
        targetNode: ""
      }));

      generatedNodes.push({
        id: branchId,
        type: "intent_branch",
        x: currentX,
        y: 160,
        title: `${currentStep}. Müşteri Niyeti & Dallanma`,
        data: { intents }
      });

      generatedConns.push({
        id: `c-${lastNodeId}-${branchId}`,
        fromNode: lastNodeId,
        fromPort: "out",
        toNode: branchId,
        toPort: "in"
      });

      const branchX = currentX + 340;
      let branchY = 60;

      intents.forEach((intent) => {
        const ikey = intent.key;
        const ilabel = intent.label.toLowerCase();
        const targetId = `node-${currentStep}_${ikey}`;

        if (/rehber|isim|personel/i.test(ilabel)) {
          generatedNodes.push({
            id: targetId,
            type: "directory_lookup",
            x: branchX,
            y: branchY,
            title: "İsimle Personel Aktarımı",
            data: { announcement: "Aradığınız personeli rehberden sorgulayıp aktarıyorum.", fallback_target: "1000", fallback_name: "1000 - ANIL ACAR" }
          });
        } else if (/form|kayıt|arıza/i.test(ilabel)) {
          const fields = ["Ad Soyad", "Telefon"];
          if (/tarih|saat/i.test(ilabel)) fields.push("Tarih / Saat");
          if (/sipariş/i.test(ilabel)) fields.push("Sipariş No");
          generatedNodes.push({
            id: targetId,
            type: "form_capture",
            x: branchX,
            y: branchY,
            title: "Bilgi & Form Kaydı",
            data: { fields }
          });
        } else if (/kapat|sonlandır|hayır|vazgeç/i.test(ilabel)) {
          generatedNodes.push({
            id: targetId,
            type: "hangup",
            x: branchX,
            y: branchY,
            title: "Görüşme Kapatma",
            data: { farewell: "Zaman ayırdığınız için teşekkür ederiz. İyi günler dileriz!" }
          });
        } else if (/aktar|bağla|temsilci|kuyruk|satış|destek/i.test(ilabel)) {
          const numMatch = ilabel.match(/\b(1\d{3}|2\d{3}|3\d{3}|4\d{3})\b/);
          const targetNum = numMatch ? numMatch[1] : (ilabel.includes("satış") ? "2000" : "1000");
          generatedNodes.push({
            id: targetId,
            type: "transfer",
            x: branchX,
            y: branchY,
            title: "Temsilciye Aktarım",
            data: { target_type: targetNum.startsWith("2") ? "queue" : "extension", target: targetNum, target_name: `${targetNum} - Birim/Kuyruk`, announcement: "Sizi ilgili birime bağlıyorum." }
          });
        } else {
          generatedNodes.push({
            id: targetId,
            type: "dialogue",
            x: branchX,
            y: branchY,
            title: "Diyalog Adımı",
            data: { script: intent.label }
          });
        }

        generatedConns.push({
          id: `c-b-${ikey}`,
          fromNode: branchId,
          fromPort: ikey,
          toNode: targetId,
          toPort: "in"
        });

        branchY += 180;
      });

    } else {
      // Sequential flow from remaining sentences
      remainingLines.forEach((line) => {
        if (!line) return;
        const lineLower = line.toLowerCase();
        const stepId = `node-${currentStep}`;

        if (/rehber|isim|personel/i.test(lineLower)) {
          generatedNodes.push({
            id: stepId,
            type: "directory_lookup",
            x: currentX,
            y: 160,
            title: `${currentStep}. İsimle Dahili Aktarımı`,
            data: { announcement: line, fallback_target: "1000", fallback_name: "1000 - ANIL ACAR" }
          });
        } else if (/form|kayıt|arıza|bilgi al/i.test(lineLower)) {
          const fields = ["Ad Soyad", "Telefon"];
          if (/tarih|saat/i.test(lineLower)) fields.push("Tarih / Saat");
          if (/sipariş/i.test(lineLower)) fields.push("Sipariş No");
          generatedNodes.push({
            id: stepId,
            type: "form_capture",
            x: currentX,
            y: 160,
            title: `${currentStep}. Veri & Form Toplama`,
            data: { fields }
          });
        } else if (/aktar|bağla|yönlendir|kuyruk|temsilci/i.test(lineLower)) {
          const numMatch = lineLower.match(/\b(1\d{3}|2\d{3}|3\d{3}|4\d{3})\b/);
          const targetNum = numMatch ? numMatch[1] : "2000";
          generatedNodes.push({
            id: stepId,
            type: "transfer",
            x: currentX,
            y: 160,
            title: `${currentStep}. Temsilciye Aktarım`,
            data: { target_type: targetNum.startsWith("2") ? "queue" : "extension", target: targetNum, target_name: `${targetNum} - Birim/Kuyruk`, announcement: line }
          });
        } else if (/kapat|sonlandır|vedalaş/i.test(lineLower)) {
          generatedNodes.push({
            id: stepId,
            type: "hangup",
            x: currentX,
            y: 160,
            title: `${currentStep}. Çağrı Kapatma`,
            data: { farewell: line }
          });
        } else {
          generatedNodes.push({
            id: stepId,
            type: "dialogue",
            x: currentX,
            y: 160,
            title: `${currentStep}. Bilgi Sunumu`,
            data: { script: line }
          });
        }

        generatedConns.push({
          id: `c-${lastNodeId}-${stepId}`,
          fromNode: lastNodeId,
          fromPort: "out",
          toNode: stepId,
          toPort: "in"
        });
        lastNodeId = stepId;
        currentStep++;
        currentX += 340;
      });
    }

    setNodes(generatedNodes);
    setConnections(generatedConns);
    setSelectedNodeId(null);
    setGeneratingScenario(false);
    setAiPromptText("");
    setIsAiModalOpen(false);
  };

  useEffect(() => {
    // Fetch Real System Users & Extensions
    fetch(`${API_BASE}/api/settings/users?tenant_id=all`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setSystemUsers(data); })
      .catch(err => console.error("Users fetch error:", err));

    // Fetch Real ACD Queues
    fetch(`${API_BASE}/api/settings/queues?tenant_id=all`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setSystemQueues(data); })
      .catch(err => console.error("Queues fetch error:", err));
  }, [API_BASE]);

  useEffect(() => {
    if (agent && agent.id) {
      fetchAgentScenario();
    } else {
      loadTemplate("sales");
    }
  }, [agent]);

  const fetchAgentScenario = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/ai-agents/${agent.id}/scenario?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
          setConnections(data.connections || []);
        } else {
          loadTemplate("sales");
        }
      } else {
        loadTemplate("sales");
      }
    } catch (err) {
      console.error("Scenario fetch error:", err);
      loadTemplate("sales");
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = (key) => {
    const tmpl = SCENARIO_TEMPLATES[key];
    if (tmpl) {
      setNodes(JSON.parse(JSON.stringify(tmpl.nodes)));
      setConnections(JSON.parse(JSON.stringify(tmpl.connections)));
      setSelectedNodeId(null);
    }
  };

  // Node Creation Handler
  const handleAddNode = (type) => {
    const newId = `node-${Date.now()}`;
    const defaultTitles = {
      greeting: "Karşılama & Açılış",
      dialogue: "Diyalog & Konuşma Adımı",
      intent_branch: "Niyet & Koşul Dallanması",
      kvkk: "KVKK Onay Kontrolü",
      form_capture: "Form & Veri Toplama",
      directory_lookup: "İsimle Dahili / Personel Transferi",
      transfer: "Temsilciye Transfer",
      hangup: "Çağrı Sonlandırma",
      api_lookup: "CRM / API Sorgusu"
    };

    const newNode = {
      id: newId,
      type,
      x: 100 + Math.random() * 80,
      y: 100 + Math.random() * 80,
      title: defaultTitles[type] || "Yeni Düğüm",
      data: getDefaultDataForType(type)
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newId);
  };

  const getDefaultDataForType = (type) => {
    switch (type) {
      case "greeting":
        return { text: "Merhaba, size nasıl yardımcı olabilirim?", tone: "friendly" };
      case "dialogue":
        return { script: "Konuşma detaylarını buraya giriniz." };
      case "intent_branch":
        return { intents: [
          { key: "yes", label: "Müşteri Onay Verdi", targetNode: "" },
          { key: "no", label: "Müşteri Reddetti", targetNode: "" }
        ]};
      case "kvkk":
        return { consent_text: "Kişisel verilerinizin işlenmesini onaylıyor musunuz?" };
      case "form_capture":
        return { fields: ["Ad Soyad", "Telefon"] };
      case "directory_lookup":
        return { announcement: "Sizi aradığınız kişiye yönlendiriyorum, lütfen hatta kalınız.", fallback_target: "1000", fallback_name: "1000 - ANIL ACAR" };
      case "transfer":
        return { target_type: "extension", target: "1000", target_name: "1000 - ANIL ACAR", announcement: "Sizi ilgili birime aktarıyorum." };
      case "hangup":
        return { farewell: "İyi günler dileriz!" };
      case "api_lookup":
        return { url: "https://api.sirketiniz.com/crm/user", method: "GET" };
      default:
        return {};
    }
  };

  // Canvas Mouse Dragging Handlers
  const handleMouseDown = (e, nodeId) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDragOffset({
        x: e.clientX - node.x,
        y: e.clientY - node.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (draggingNodeId) {
      const canvasRect = canvasRef.current?.getBoundingClientRect();
      if (!canvasRect) return;

      const newX = Math.max(10, e.clientX - dragOffset.x);
      const newY = Math.max(10, e.clientY - dragOffset.y);

      setNodes(prev => prev.map(node => {
        if (node.id === draggingNodeId) {
          return { ...node, x: newX, y: newY };
        }
        return node;
      }));
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleDeleteNode = (nodeId) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleOpenEditModal = (node) => {
    setEditingNode(JSON.parse(JSON.stringify(node)));
    setTargetSearch("");
    setIsEditModalOpen(true);
  };

  const handleSaveNodeEdit = () => {
    if (!editingNode) return;
    setNodes(prev => prev.map(n => n.id === editingNode.id ? editingNode : n));
    setIsEditModalOpen(false);
    setEditingNode(null);
  };

  // Save Scenario to Backend API
  const handleSaveScenario = async () => {
    if (!agent || !agent.id) return;
    setSaving(true);
    setSaveSuccess(false);
    setErrorMsg("");

    try {
      const payload = {
        nodes,
        connections
      };

      const res = await fetch(`${API_BASE}/api/settings/ai-agents/${agent.id}/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.detail || "Senaryo kaydedilirken bir hata oluştu.");
      }
    } catch (err) {
      console.error("Save scenario error:", err);
      setErrorMsg("Sunucuya bağlanırken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  // Simulator Test Handlers
  const handleStartSimulator = () => {
    setIsSimulatorOpen(true);
    const greetingNode = nodes.find(n => n.type === "greeting");
    const initMsg = greetingNode?.data?.text || "Merhaba, ben yapay zeka temsilciniz. Size nasıl yardımcı olabilirim?";
    setChatMessages([
      { sender: "ai", text: initMsg, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    ]);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { sender: "user", text: userText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setSimulating(true);

    setTimeout(() => {
      let responseText = "Anladım, talebinizi kaydediyorum.";
      const lower = userText.toLowerCase();

      if (lower.includes("fiyat") || lower.includes("ücret") || lower.includes("indirim")) {
        const dialogueNode = nodes.find(n => n.type === "dialogue");
        responseText = dialogueNode?.data?.script || "Fiyatlandırma paketlerimiz aylık 250 TL'den başlamaktadır.";
      } else if (lower.includes("görüşmek") || lower.includes("bağla") || lower.includes("bey") || lower.includes("hanım") || lower.includes("akar") || lower.includes("yılmaz") || lower.includes("anıl")) {
        const dirNode = nodes.find(n => n.type === "directory_lookup");
        if (dirNode) {
          responseText = `${dirNode.data?.announcement || "Sizi aradığınız kişiye yönlendiriyorum..."} [AKSIYON: İsimle eşleştirilen dahili telefon çalıyor...]`;
        } else {
          const transferNode = nodes.find(n => n.type === "transfer");
          const tTarget = transferNode?.data?.target_name || transferNode?.data?.target || "Temsilci";
          responseText = transferNode?.data?.announcement || `[AKSIYON: ${tTarget} birimine aktarılıyor...]`;
        }
      } else if (lower.includes("temsilci") || lower.includes("insan")) {
        const transferNode = nodes.find(n => n.type === "transfer");
        const tTarget = transferNode?.data?.target_name || transferNode?.data?.target || "Temsilci";
        responseText = transferNode?.data?.announcement || `[AKSIYON: ${tTarget} birimine aktarılıyor...]`;
      } else if (lower.includes("hayır") || lower.includes("kapat") || lower.includes("görüşürüz")) {
        const hangupNode = nodes.find(n => n.type === "hangup");
        responseText = hangupNode?.data?.farewell || "[AKSIYON: Çağrı sonlandırıldı. İyi günler!]";
      }

      setChatMessages(prev => [...prev, { sender: "ai", text: responseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setSimulating(false);
    }, 800);
  };

  // Filter Users / Queues for Target Selection
  const filteredUsers = systemUsers.filter(u => {
    const q = targetSearch.toLowerCase();
    return (
      (u.extension && u.extension.toLowerCase().includes(q)) ||
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  const filteredQueues = systemQueues.filter(q => {
    const query = targetSearch.toLowerCase();
    return (
      (q.extension && String(q.extension).toLowerCase().includes(query)) ||
      (q.name && q.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full flex flex-col h-[calc(100vh-140px)] min-h-[600px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden text-slate-900 dark:text-white relative shadow-sm">
      
      {/* Top Header Toolbar */}
      <div className="px-5 py-3.5 bg-slate-50/90 dark:bg-slate-950/90 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition-colors shadow-sm"
            title="Temsilci Listesine Dön"
          >
            <ArrowLeft size={16} />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className={"p-2 rounded-xl " + lightBg + " " + lightText}>
              <GitBranch size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {agent?.name || "Yapay Zeka Temsilcisi"} - Senaryo & Davranış Editörü
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                AI temsilcinizin çağrı esnasında ne söyleyeceğini, niyetlere göre nasıl dallanacağını ve aksiyonlarını tasarlayın.
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-2.5">
          <select
            onChange={(e) => loadTemplate(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer shadow-sm"
          >
            <option value="">Hazır Şablon Yükle...</option>
            <option value="sales">Satış & Ürün Danışmanlığı</option>
            <option value="support">Teknik Destek & Arıza Kaydı</option>
          </select>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors shadow-sm"
            title="Yazarak Otomatik Senaryo Çiz"
          >
            <Sparkles size={14} className="text-purple-500 animate-pulse" />
            <span>✨ AI ile Otomatik Çiz</span>
          </button>

          <button
            onClick={handleStartSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-sm"
          >
            <Play size={14} />
            <span>Senaryoyu Test Et</span>
          </button>

          <button
            onClick={handleSaveScenario}
            disabled={saving}
            className={"flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all " + bg + " " + hover + " disabled:opacity-50"}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? "Kaydediliyor..." : "Kaydet ve Yayınla"}</span>
          </button>
        </div>
      </div>

      {/* AI Scenario Assistant Modal Popup */}
      {isAiModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Sparkles size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>AI Senaryo Asistanı</span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold border border-purple-300 dark:border-purple-800">
                      Doğal Dil İle Akış Tasarımı
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Temsilcinizin çağrı esnasında izleyeceği adımları detaylıca yazın, şemayı yapay zeka otomatik çizsin.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAiModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Senaryo Açıklamanız (Türkçe Metin)</span>
                  <span className="text-[11px] font-normal text-slate-400">İstediğiniz kadar detaylı yazabilirsiniz</span>
                </label>
                <textarea
                  rows={7}
                  value={aiPromptText}
                  onChange={(e) => setAiPromptText(e.target.value)}
                  placeholder={`Örn:\n1. Gelen müşteriyi KVKK aydınlatma metni okuyarak karşıla.\n2. Bu aya özel avantajlı Kurumsal Bulut Santral paketlerimiz hakkında bilgi ver.\n3. Müşteri evet derse veya satış ile ilgilenirse 2000 Satış Kuyruğuna aktar.\n4. Müşteri belirli bir çalışanın ismini söylerse dahili rehberden sorgulayıp 1000 Anıl Acar dahili hattına aktar.\n5. Hayır derse veya sonlandırmak isterse kibarca teşekkür edip aramayı kapat.`}
                  className="w-full p-4 rounded-2xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 shadow-inner font-mono leading-relaxed resize-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Örnek Hazır Senaryo Komutları:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiPromptText("Gelen müşteriyi KVKK ile karşıla, indirimli bulut santral teklifi yap, kabul ederse 2000 satış kuyruğuna, insan temsilci isterse dahili rehberden aktar")}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-purple-50/60 dark:hover:bg-purple-950/40 border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-800 text-left transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-purple-600 dark:group-hover:text-purple-400 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-purple-500" />
                      Satış & KVKK Akışı
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      Karşılama, onay, teklif ve 2000 kuyruğuna aktarım.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiPromptText("Teknik destek ve arıza bildirim modunda karşıla, arıza detaylarını form olarak al ve 1000 Anıl Acar dahilisini bağla")}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/40 border border-slate-200 dark:border-slate-800 hover:border-cyan-300 dark:hover:border-cyan-800 text-left transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-cyan-500" />
                      Arıza & Destek Kaydı
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      Destek karşılama, form toplama ve dahili aktarım.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiPromptText("Müşteri ismiyle rehberden dahili sorgula ve direkt personel telefonuna aktar")}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 text-left transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-500" />
                      İsimle Dahili Rehber
                    </span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      Sesli rehber eşleştirmesi ve doğrudan dahili aktarımı.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50/90 dark:bg-slate-950/90 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={() => handleGenerateScenarioFromPrompt()}
                disabled={generatingScenario || !aiPromptText.trim()}
                className={"flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all " + bg + " " + hover + " disabled:opacity-50"}
              >
                {generatingScenario ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Akış Çiziliyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>✨ Senaryoyu Çiz ve Oluştur</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Main Content Area: Sidebar Palette + Node Canvas */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* Left Palette: Add Node Types */}
        <div className="w-56 bg-slate-50/70 dark:bg-slate-950/60 border-r border-slate-200/80 dark:border-slate-800 p-3 flex flex-col gap-2 shrink-0 overflow-y-auto">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Düğüm Bileşenleri
          </span>

          <div className="space-y-1.5">
            <button
              onClick={() => handleAddNode("greeting")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <Volume2 size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>Açılış / Karşılama</span>
            </button>

            <button
              onClick={() => handleAddNode("dialogue")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <FileText size={14} className="text-blue-500 dark:text-blue-400 shrink-0" />
              <span>Diyalog / Konuşma Adımı</span>
            </button>

            <button
              onClick={() => handleAddNode("intent_branch")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <Shuffle size={14} className="text-purple-500 dark:text-purple-400 shrink-0" />
              <span>Niyet Dallanması</span>
            </button>

            <button
              onClick={() => handleAddNode("kvkk")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <ShieldCheck size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
              <span>KVKK & Onay Kontrolü</span>
            </button>

            <button
              onClick={() => handleAddNode("form_capture")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <UserCheck size={14} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
              <span>Form & Veri Toplama</span>
            </button>

            <button
              onClick={() => handleAddNode("directory_lookup")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <Users size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>İsimle Dahili Transferi</span>
            </button>

            <button
              onClick={() => handleAddNode("transfer")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <PhoneCall size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>Temsilciye Transfer</span>
            </button>

            <button
              onClick={() => handleAddNode("hangup")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <PhoneOff size={14} className="text-rose-500 dark:text-rose-400 shrink-0" />
              <span>Çağrı Sonlandırma</span>
            </button>

            <button
              onClick={() => handleAddNode("api_lookup")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200 transition-colors text-left shadow-sm"
            >
              <Database size={14} className="text-teal-500 dark:text-teal-400 shrink-0" />
              <span>CRM / Webhook Sorgusu</span>
            </button>
          </div>
        </div>

        {/* Center Interactive Node Canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 bg-slate-50/50 dark:bg-slate-900/50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] relative overflow-auto select-none p-6"
        >
          {/* SVG Connection Lines Canvas */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {connections.map(conn => {
              const fromNode = nodes.find(n => n.id === conn.fromNode);
              const toNode = nodes.find(n => n.id === conn.toNode);
              if (!fromNode || !toNode) return null;

              const x1 = fromNode.x + 256;
              const y1 = fromNode.y + 40;
              const x2 = toNode.x;
              const y2 = toNode.y + 40;
              const dx = Math.abs(x2 - x1) * 0.5;

              const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <path
                  key={conn.id}
                  d={path}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                  className="animate-[dash_20s_linear_infinite]"
                />
              );
            })}
          </svg>

          {/* Render Nodes */}
          {nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
                style={{ left: node.x, top: node.y }}
                className={`absolute w-64 bg-white/95 dark:bg-slate-950/90 rounded-2xl border backdrop-blur-md shadow-lg transition-shadow z-10 ${
                  isSelected 
                    ? "border-sky-500 ring-2 ring-sky-500/30" 
                    : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Node Card Header */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{node.title}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(node); }}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800"
                      title="Düğümü Düzenle"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                      className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800"
                      title="Düğümü Sil"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Node Card Content */}
                <div className="p-3 text-[11px] text-slate-600 dark:text-slate-300 space-y-1.5">
                  {node.type === "greeting" && (
                    <p className="italic text-slate-500 dark:text-slate-400 truncate">"{node.data?.text}"</p>
                  )}
                  {node.type === "dialogue" && (
                    <p className="text-slate-700 dark:text-slate-300 line-clamp-2">{node.data?.script}</p>
                  )}
                  {node.type === "intent_branch" && (
                    <div className="space-y-1">
                      {node.data?.intents?.map((intent, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                          <span className="text-sky-600 dark:text-sky-400 font-medium">{intent.label}</span>
                          <ArrowRight size={10} className="text-slate-400" />
                        </div>
                      ))}
                    </div>
                  )}
                  {node.type === "directory_lookup" && (
                    <div className="space-y-1">
                      <p className="text-emerald-600 dark:text-emerald-300 font-semibold truncate">
                        Otomatik Rehber Eşleştirme
                      </p>
                      <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-200/50 dark:border-emerald-900/40">
                        Kişi İsmi → Dahili Aktarım
                      </span>
                    </div>
                  )}
                  {node.type === "transfer" && (
                    <div className="space-y-1">
                      <p className="text-indigo-600 dark:text-indigo-300 font-semibold truncate">
                        Hedef: {node.data?.target_name || node.data?.target || "Belirtilmedi"}
                      </p>
                      <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono border border-indigo-200/50 dark:border-indigo-900/40">
                        {node.data?.target_type === "queue" ? "ACD Kuyruk" : node.data?.target_type === "custom" ? "Özel Numara" : "Dahili Temsilci"}
                      </span>
                    </div>
                  )}
                  {node.type === "hangup" && (
                    <p className="text-rose-600 dark:text-rose-300 italic">"{node.data?.farewell}"</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Chat Simulator Drawer Panel */}
        {isSimulatorOpen && (
          <div className="w-80 bg-white dark:bg-slate-950 border-l border-slate-200/80 dark:border-slate-800 flex flex-col shrink-0 z-20 shadow-xl">
            <div className="p-3.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500 dark:text-amber-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-200">Senaryo Test Simülatörü</span>
              </div>
              <button
                onClick={() => setIsSimulatorOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <X size={14} />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2.5 text-xs bg-slate-50/50 dark:bg-slate-900/40">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl ${
                      msg.sender === "user"
                        ? "bg-sky-600 text-white rounded-br-none shadow-sm"
                        : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1">{msg.timestamp}</span>
                </div>
              ))}
              {simulating && (
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 italic">
                  <RefreshCw size={11} className="animate-spin" />
                  <span>AI temsilci düşünüyor...</span>
                </div>
              )}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 flex gap-2 bg-white dark:bg-slate-950">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
                placeholder="Müşteri gibi mesaj yazın..."
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={handleSendChatMessage}
                className={"p-2 rounded-xl text-white shadow-sm " + bg}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Edit Node Modal Drawer */}
      {isEditModalOpen && editingNode && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Edit2 size={16} className="text-sky-500" />
                Düğüm Özelliklerini Düzenle
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Düğüm Başlığı</label>
                <input
                  type="text"
                  value={editingNode.title}
                  onChange={(e) => setEditingNode(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {editingNode.type === "greeting" && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Açılış Metni</label>
                  <textarea
                    rows={3}
                    value={editingNode.data?.text || ""}
                    onChange={(e) => setEditingNode(prev => ({ ...prev, data: { ...prev.data, text: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              )}

              {editingNode.type === "dialogue" && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Diyalog / Konuşma Scripti</label>
                  <textarea
                    rows={4}
                    value={editingNode.data?.script || ""}
                    onChange={(e) => setEditingNode(prev => ({ ...prev, data: { ...prev.data, script: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              )}

              {editingNode.type === "directory_lookup" && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
                    <p className="font-bold mb-1">Dinamik İsimle Dahili Bağlama Rehberi</p>
                    <p className="text-[11px] leading-relaxed">
                      Arayan kişi sistemdeki herhangi bir personelin adını söylediğinde (Örn: "Anıl Acar ile görüşmek istiyorum", "Ahmet Bey'e bağlar mısın"), AI temsilci rehberdeki kullanıcı adlarını eşleştirerek çağrıyı doğrudan o kullanıcının dahili telefonuna aktarır.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Transfer Öncesi Anons Metni</label>
                    <input
                      type="text"
                      value={editingNode.data?.announcement || ""}
                      onChange={(e) => setEditingNode(prev => ({ ...prev, data: { ...prev.data, announcement: e.target.value } }))}
                      placeholder="Örn: Sizi aradığınız kişiye yönlendiriyorum, lütfen hatta kalınız..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-600 dark:text-slate-400 font-semibold">Bulunamassa Varsayılan Dahili</label>
                      <span className="text-[10px] text-slate-400">{filteredUsers.length} Temsilci</span>
                    </div>

                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={targetSearch}
                        onChange={(e) => setTargetSearch(e.target.value)}
                        placeholder="Dahili veya isim ara..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-950">
                      {filteredUsers.map((u) => {
                        const isSelected = editingNode.data?.fallback_target === str(u.extension);
                        return (
                          <div
                            key={u.id || u.extension}
                            onClick={() => setEditingNode(prev => ({
                              ...prev,
                              data: {
                                ...prev.data,
                                fallback_target: str(u.extension),
                                fallback_name: `${u.extension} - ${u.full_name}`
                              }
                            }))}
                            className={`p-2 rounded-lg flex items-center justify-between cursor-pointer border text-xs transition-colors ${
                              isSelected
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <span className="font-mono font-bold text-xs">{u.extension} - {u.full_name}</span>
                            <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {editingNode.type === "transfer" && (
                <div className="space-y-3">
                  {/* Transfer Target Type Switcher */}
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Hedef Türü</label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingNode(prev => ({ ...prev, data: { ...prev.data, target_type: "extension" } }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                          (editingNode.data?.target_type || "extension") === "extension"
                            ? "bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <Users size={13} />
                        <span>Dahili</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingNode(prev => ({ ...prev, data: { ...prev.data, target_type: "queue" } }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                          editingNode.data?.target_type === "queue"
                            ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <Layers size={13} />
                        <span>ACD Kuyruk</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingNode(prev => ({ ...prev, data: { ...prev.data, target_type: "custom" } }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                          editingNode.data?.target_type === "custom"
                            ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                            : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <PhoneCall size={13} />
                        <span>Özel / GSM</span>
                      </button>
                    </div>
                  </div>

                  {/* Transfer Announcement Prompt */}
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Transfer Öncesi Anons Metni</label>
                    <input
                      type="text"
                      value={editingNode.data?.announcement || ""}
                      onChange={(e) => setEditingNode(prev => ({ ...prev, data: { ...prev.data, announcement: e.target.value } }))}
                      placeholder="Örn: Sizi müşteri hizmetleri temsilcimize aktarıyorum..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  {/* Target Selection Lists */}
                  {(editingNode.data?.target_type || "extension") === "extension" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-600 dark:text-slate-400 font-semibold">Dahili Temsilci Seçimi</label>
                        <span className="text-[10px] text-slate-400">{filteredUsers.length} Temsilci</span>
                      </div>

                      {/* Search Input Filter */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={targetSearch}
                          onChange={(e) => setTargetSearch(e.target.value)}
                          placeholder="Dahili veya isim ile ara..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                        />
                      </div>

                      {/* Scrollable Users List */}
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {filteredUsers.map((u) => {
                          const isSelected = editingNode.data?.target === str(u.extension);
                          return (
                            <div
                              key={u.id || u.extension}
                              onClick={() => setEditingNode(prev => ({
                                ...prev,
                                data: {
                                  ...prev.data,
                                  target: str(u.extension),
                                  target_name: `${u.extension} - ${u.full_name}`
                                }
                              }))}
                              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer border transition-colors ${
                                isSelected
                                  ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-700 dark:text-sky-300 font-bold shadow-sm"
                                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">{u.extension}</span>
                                <span className="truncate">{u.full_name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                            </div>
                          );
                        })}
                        {filteredUsers.length === 0 && (
                          <p className="text-center py-3 text-slate-400 text-[11px] italic">Eşleşen dahili temsilci bulunamadı.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {editingNode.data?.target_type === "queue" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-slate-600 dark:text-slate-400 font-semibold">ACD Kuyruk Seçimi</label>
                        <span className="text-[10px] text-slate-400">{filteredQueues.length} Kuyruk</span>
                      </div>

                      {/* Search Input Filter */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={targetSearch}
                          onChange={(e) => setTargetSearch(e.target.value)}
                          placeholder="Kuyruk adı veya numarası ile ara..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                        />
                      </div>

                      {/* Scrollable Queues List */}
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {filteredQueues.map((q) => {
                          const qVal = q.extension ? str(q.extension) : str(q.name);
                          const qLabel = q.extension ? `${q.extension} - ${q.name}` : q.name;
                          const isSelected = editingNode.data?.target === qVal;
                          return (
                            <div
                              key={q.id || qVal}
                              onClick={() => setEditingNode(prev => ({
                                ...prev,
                                data: {
                                  ...prev.data,
                                  target: qVal,
                                  target_name: qLabel
                                }
                              }))}
                              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer border transition-colors ${
                                isSelected
                                  ? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 font-bold shadow-sm"
                                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {q.extension && <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">{q.extension}</span>}
                                <span className="truncate">{q.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 uppercase">{q.strategy || "ACD"}</span>
                            </div>
                          );
                        })}
                        {filteredQueues.length === 0 && (
                          <p className="text-center py-3 text-slate-400 text-[11px] italic">Eşleşen ACD kuyruğu bulunamadı.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {editingNode.data?.target_type === "custom" && (
                    <div>
                      <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Harici Numara / GSM</label>
                      <input
                        type="text"
                        value={editingNode.data?.target || ""}
                        onChange={(e) => setEditingNode(prev => ({
                          ...prev,
                          data: {
                            ...prev.data,
                            target: e.target.value,
                            target_name: e.target.value
                          }
                        }))}
                        placeholder="Örn: 0507XXXXXXX"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none font-mono"
                      />
                    </div>
                  )}
                </div>
              )}

              {editingNode.type === "hangup" && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Kapanış Anonsu</label>
                  <input
                    type="text"
                    value={editingNode.data?.farewell || ""}
                    onChange={(e) => setEditingNode(prev => ({ ...prev, data: { ...prev.data, farewell: e.target.value } }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveNodeEdit}
                className={"px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm " + bg}
              >
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Helper to stringify values safely
function str(val) {
  return val !== null && val !== undefined ? String(val) : "";
}
