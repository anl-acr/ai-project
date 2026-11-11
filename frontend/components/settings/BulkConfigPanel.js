import React, { useState, useEffect, useMemo } from "react";
import {
  Sliders,
  Users,
  PhoneCall,
  ArrowUpRight,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Shield,
  Volume2,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  Filter,
  History,
  ChevronRight,
  Lock,
  Smartphone,
  MessageSquare
} from "lucide-react";
import { useTheme } from "../../utils/theme";
import { getApiBaseUrl } from "../../utils/apiHost";

const UNCHANGED = "__UNCHANGED__";

const INITIAL_USER_CHANGES = {
  recording_active: UNCHANGED,
  is_active: UNCHANGED,
  role: UNCHANGED,
  department_id: UNCHANGED,
  location_id: UNCHANGED,
  outbound_caller_id: "",
  outbound_caller_id_mode: UNCHANGED, // UNCHANGED | "set" | "clear"
  max_concurrent_outbound: "",
  outbound_quarantined: UNCHANGED,
  voicemail_active: UNCHANGED,
  voicemail_to_email: UNCHANGED,
  voicemail_pin: "",
  mobile_transfer_enabled: UNCHANGED,
  transport: UNCHANGED,
  max_activations: "",
  ring_timeout: "",
  forwarding_reset: false,
  forwarding_always_mode: UNCHANGED, // UNCHANGED | "enable" | "disable"
  forwarding_always_type: "internal",
  forwarding_always_target: "",
  forwarding_busy_mode: UNCHANGED,
  forwarding_busy_type: "internal",
  forwarding_busy_target: "",
  forwarding_no_answer_mode: UNCHANGED,
  forwarding_no_answer_type: "internal",
  forwarding_no_answer_target: "",
  follow_me_enabled: UNCHANGED,
  auto_logout_enabled: UNCHANGED,
  auto_logout_duration: "",
  password_expiry_enabled: UNCHANGED,
  password_expiry_months: "",
  outbound_rule_action: UNCHANGED, // UNCHANGED | "replace" | "add" | "remove" | "clear_all"
  outbound_rule_ids: [],
  subscriber_group_action: UNCHANGED,
  assign_subscriber_group_ids: [],
  pickup_group_action: UNCHANGED,
  pickup_group_ids: [],
  queue_action: UNCHANGED, // UNCHANGED | "add" | "remove"
  queue_ids: []
};

const INITIAL_SUBGROUP_CHANGES = {
  outbound_rule_action: UNCHANGED, // UNCHANGED | "replace" | "add" | "remove" | "clear_all"
  outbound_rule_ids: [],
  allowed_outbound_groups_action: UNCHANGED,
  allowed_outbound_groups: [],
  allowed_inbound_groups_action: UNCHANGED,
  allowed_inbound_groups: [],
  allow_international: UNCHANGED,
  // Member-level changes for all subscribers in the group(s)
  recording_active: UNCHANGED,
  is_active: UNCHANGED,
  role: UNCHANGED,
  department_id: UNCHANGED,
  location_id: UNCHANGED,
  ring_timeout: "",
  forwarding_reset: false,
  voicemail_active: UNCHANGED,
  mobile_transfer_enabled: UNCHANGED,
  outbound_quarantined: UNCHANGED,
  pickup_group_action: UNCHANGED,
  pickup_group_ids: [],
  queue_action: UNCHANGED,
  queue_ids: []
};

const INITIAL_QUEUE_CHANGES = {
  strategy: UNCHANGED,
  timeout: "",
  retry: "",
  wrapup_time: "",
  max_wait_time_enabled: UNCHANGED,
  max_wait_time: "",
  max_len: "",
  max_concurrent_breaks: "",
  show_queue_name: UNCHANGED,
  notify_missed_calls: UNCHANGED,
  service_level: "",
  weight: "",
  ring_in_use: UNCHANGED,
  hold_music_class: UNCHANGED,
  announce_position: UNCHANGED,
  announce_holdtime: UNCHANGED,
  periodic_announcement_enabled: UNCHANGED,
  periodic_announcement_interval: "",
  all_busy_routing_enabled: UNCHANGED,
  auto_pause_missed_enabled: UNCHANGED,
  auto_pause_missed_count: "",
  auto_pause_disconnect_enabled: UNCHANGED,
  auto_pause_disconnect_grace_sec: "",
  survey_enabled: UNCHANGED,
  survey_scale: UNCHANGED,
  smart_callback_enabled: UNCHANGED,
  smart_callback_max_wait_seconds: "",
  omnichannel_enabled: UNCHANGED,
  omnichannel_channels_mode: UNCHANGED, // UNCHANGED | "set"
  omnichannel_channels: ["whatsapp", "email", "instagram", "facebook", "telegram"],
  omnichannel_sla_sec: "",
  omnichannel_max_chats_per_agent: "",
  member_action: UNCHANGED, // UNCHANGED | "add" | "remove"
  member_extensions: []
};

const INITIAL_OUTBOUND_RULE_CHANGES = {
  trunk_id: UNCHANGED,
  caller_id_mode: UNCHANGED, // UNCHANGED | "set" | "clear"
  caller_id: "",
  pin_mode: UNCHANGED, // UNCHANGED | "none" | "always" | "outside_work_hours" | "custom_hours"
  pin_code: "",
  pin_start_time: "18:00",
  pin_end_time: "09:00",
  allowed_users_action: UNCHANGED,
  allowed_users: []
};

export default function BulkConfigPanel({
  backendHost,
  canWrite = true,
  canDelete = true,
  isModal = false,
  initialModule = "users",
  initialTargetMode = null,
  initialSelectedIds = [],
  initialSubscriberGroupId = null,
  onClose = null,
  onApplied = null
}) {
  const { bg, hover, text, border, ring, lightBg, lightText, borderLight } = useTheme();
  const API_BASE = getApiBaseUrl(backendHost);

  const [activeModule, setActiveModule] = useState(initialModule || "users");
  const [targetMode, setTargetMode] = useState(
    initialTargetMode || "selected"
  );
  const [selectedIds, setSelectedIds] = useState(
    Array.isArray(initialSelectedIds) ? initialSelectedIds.map((x) => String(x)) : []
  );
  const [filterSubGroupId, setFilterSubGroupId] = useState(
    initialSubscriberGroupId ? String(initialSubscriberGroupId) : ""
  );
  const [filterPickupGroupId, setFilterPickupGroupId] = useState("");
  const [filterRoleCode, setFilterRoleCode] = useState("agent");
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [filterLocationId, setFilterLocationId] = useState("");
  const [extStart, setExtStart] = useState("1000");
  const [extEnd, setExtEnd] = useState("1099");
  const [targetSearch, setTargetSearch] = useState("");
  const [selectedTargetSearch, setSelectedTargetSearch] = useState("");

  const [metadata, setMetadata] = useState({
    users: [],
    subscriber_groups: [],
    call_pickup_groups: [],
    outbound_rules: [],
    inbound_rules: [],
    queues: [],
    trunks: [],
    roles: [],
    locations: [],
    departments: [],
    history: []
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [undoingId, setUndoingId] = useState(null);
  const [confirmUndoOp, setConfirmUndoOp] = useState(null);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const [userChanges, setUserChanges] = useState(INITIAL_USER_CHANGES);
  const [subGroupChanges, setSubGroupChanges] = useState(INITIAL_SUBGROUP_CHANGES);
  const [queueChanges, setQueueChanges] = useState(INITIAL_QUEUE_CHANGES);
  const [outboundRuleChanges, setOutboundRuleChanges] = useState(INITIAL_OUTBOUND_RULE_CHANGES);

  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  const getHeaders = () => ({
    "Content-Type": "application/json",
    "X-User-ID":
      (typeof window !== "undefined" &&
        (localStorage.getItem("current_user_id") ||
          localStorage.getItem("user_id"))) ||
      "admin",
    "X-Tenant-ID":
      (typeof window !== "undefined" &&
        (localStorage.getItem("active_tenant_id") ||
          localStorage.getItem("selected_tenant_id"))) ||
      "tenant-default"
  });

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      const headers = getHeaders();
      let metaObj = {
        users: [],
        subscriber_groups: [],
        call_pickup_groups: [],
        outbound_rules: [],
        inbound_rules: [],
        queues: [],
        trunks: [],
        roles: [],
        locations: [],
        departments: [],
        history: []
      };

      try {
        const res = await fetch(`${API_BASE}/api/settings/bulk-config/metadata`, {
          headers
        });
        if (res.ok) {
          const data = await res.json();
          metaObj = {
            users: Array.isArray(data.users) ? data.users : [],
            subscriber_groups: Array.isArray(data.subscriber_groups)
              ? data.subscriber_groups
              : [],
            call_pickup_groups: Array.isArray(data.call_pickup_groups)
              ? data.call_pickup_groups
              : [],
            outbound_rules: Array.isArray(data.outbound_rules)
              ? data.outbound_rules
              : [],
            inbound_rules: Array.isArray(data.inbound_rules)
              ? data.inbound_rules
              : [],
            queues: Array.isArray(data.queues) ? data.queues : [],
            trunks: Array.isArray(data.trunks) ? data.trunks : [],
            roles: Array.isArray(data.roles) ? data.roles : [],
            locations: Array.isArray(data.locations) ? data.locations : [],
            departments: Array.isArray(data.departments) ? data.departments : [],
            history: Array.isArray(data.history) ? data.history : []
          };
        }
      } catch (eMeta) {
        console.warn("Bulk metadata endpoint fallback devrede:", eMeta);
      }

      // Fallback / enrichment from direct settings endpoints if any primary list is empty
      const needsFallback =
        metaObj.users.length === 0 ||
        metaObj.subscriber_groups.length === 0 ||
        metaObj.queues.length === 0 ||
        metaObj.outbound_rules.length === 0;

      if (needsFallback) {
        const safeJson = async (url) => {
          try {
            const r = await fetch(url, { headers });
            if (r.ok) return await r.json();
          } catch (_) {}
          return null;
        };

        const [
          rawUsers,
          rawGroups,
          rawPickup,
          rawOutRules,
          rawQueues,
          rawTrunks,
          rawRoles,
          rawLocations,
          rawDepartments
        ] = await Promise.all([
          metaObj.users.length === 0
            ? safeJson(`${API_BASE}/api/settings/users`)
            : null,
          metaObj.subscriber_groups.length === 0
            ? safeJson(`${API_BASE}/api/settings/subscriber_groups`)
            : null,
          metaObj.call_pickup_groups.length === 0
            ? safeJson(`${API_BASE}/api/settings/call_pickup_groups`)
            : null,
          metaObj.outbound_rules.length === 0
            ? safeJson(`${API_BASE}/api/settings/outbound_rules`)
            : null,
          metaObj.queues.length === 0
            ? safeJson(`${API_BASE}/api/settings/queues`)
            : null,
          metaObj.trunks.length === 0
            ? safeJson(`${API_BASE}/api/settings/trunks`)
            : null,
          metaObj.roles.length === 0
            ? safeJson(`${API_BASE}/api/settings/roles`)
            : null,
          metaObj.locations.length === 0
            ? safeJson(`${API_BASE}/api/settings/locations`)
            : null,
          metaObj.departments.length === 0
            ? safeJson(`${API_BASE}/api/settings/departments`)
            : null
        ]);

        if (rawUsers) {
          const uList = Array.isArray(rawUsers)
            ? rawUsers
            : rawUsers?.users || [];
          metaObj.users = uList.filter(
            (u) => String(u?.username || "").toLowerCase() !== "admin"
          );
        }
        if (rawGroups) {
          metaObj.subscriber_groups = Array.isArray(rawGroups)
            ? rawGroups
            : rawGroups?.subscriber_groups || [];
        }
        if (rawPickup) {
          metaObj.call_pickup_groups = Array.isArray(rawPickup)
            ? rawPickup
            : rawPickup?.call_pickup_groups || [];
        }
        if (rawOutRules) {
          metaObj.outbound_rules = Array.isArray(rawOutRules)
            ? rawOutRules
            : rawOutRules?.outbound_rules || [];
        }
        if (rawQueues) {
          metaObj.queues = Array.isArray(rawQueues)
            ? rawQueues
            : rawQueues?.queues || [];
        }
        if (rawTrunks) {
          metaObj.trunks = Array.isArray(rawTrunks)
            ? rawTrunks
            : rawTrunks?.trunks || [];
        }
        if (rawRoles) {
          metaObj.roles = Array.isArray(rawRoles)
            ? rawRoles
            : rawRoles?.roles || [];
        }
        if (rawLocations) {
          metaObj.locations = Array.isArray(rawLocations)
            ? rawLocations
            : rawLocations?.locations || [];
        }
        if (rawDepartments) {
          metaObj.departments = Array.isArray(rawDepartments)
            ? rawDepartments
            : rawDepartments?.departments || [];
        }
      }

      setMetadata(metaObj);
      if (!filterSubGroupId && metaObj.subscriber_groups?.length > 0) {
        setFilterSubGroupId(String(metaObj.subscriber_groups[0].id));
      }
      if (!filterPickupGroupId && metaObj.call_pickup_groups?.length > 0) {
        setFilterPickupGroupId(String(metaObj.call_pickup_groups[0].id));
      }
    } catch (err) {
      console.error("Toplu konfigürasyon verisi çekilemedi:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [backendHost]);

  useEffect(() => {
    if (initialModule) setActiveModule(initialModule);
  }, [initialModule]);

  useEffect(() => {
    if (Array.isArray(initialSelectedIds) && initialSelectedIds.length > 0) {
      setSelectedIds(initialSelectedIds.map((x) => String(x)));
      setTargetMode("selected");
    }
  }, [initialSelectedIds]);

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  const getRoleLabel = (roleCode) => {
    const r = (metadata.roles || []).find((x) => x.role_code === roleCode);
    if (r) return r.name || r.role_name || roleCode;
    if (roleCode === "admin") return "Sistem Yöneticisi";
    if (roleCode === "supervisor") return "Takım Lideri";
    if (roleCode === "agent") return "Müşteri Temsilcisi";
    return roleCode || "Kullanıcı";
  };

  const getGroupMemberUserIds = (group, usersList = metadata.users) => {
    const rawExts = group?.extensions || group?.members || [];
    const matchedIds = [];
    rawExts.forEach((val) => {
      const u = (usersList || []).find(
        (usr) =>
          usr.id === val ||
          String(usr.id) === String(val) ||
          String(usr.extension) === String(val)
      );
      if (u && !matchedIds.includes(String(u.id))) {
        matchedIds.push(String(u.id));
      }
    });
    return matchedIds;
  };

  // Compute matched targets preview
  const matchedTargets = useMemo(() => {
    if (activeModule === "users") {
      const allUsers = metadata.users || [];
      if (targetMode === "all") return allUsers;
      if (targetMode === "selected") {
        const setIds = new Set(selectedIds.map(String));
        selectedIds.forEach((tok) => {
          const sTok = String(tok);
          if (sTok.startsWith("group_")) {
            const gid = sTok.replace("group_", "");
            const grp = (metadata.subscriber_groups || []).find(
              (g) => String(g.id) === gid
            );
            if (grp) {
              getGroupMemberUserIds(grp, allUsers).forEach((uid) =>
                setIds.add(String(uid))
              );
            }
          }
        });
        return allUsers.filter(
          (u) => setIds.has(String(u.id)) || setIds.has(String(u.extension))
        );
      }
      if (targetMode === "subscriber_group") {
        const sg = (metadata.subscriber_groups || []).find(
          (g) => String(g.id) === String(filterSubGroupId)
        );
        if (!sg) return [];
        const tokens = new Set((sg.extensions || []).map(String));
        return allUsers.filter(
          (u) => tokens.has(String(u.id)) || tokens.has(String(u.extension))
        );
      }
      if (targetMode === "pickup_group") {
        const pg = (metadata.call_pickup_groups || []).find(
          (g) => String(g.id) === String(filterPickupGroupId)
        );
        if (!pg) return [];
        const tokens = new Set((pg.extensions || []).map(String));
        return allUsers.filter(
          (u) => tokens.has(String(u.id)) || tokens.has(String(u.extension))
        );
      }
      if (targetMode === "role") {
        return allUsers.filter(
          (u) => String(u.role || "").toLowerCase() === String(filterRoleCode || "").toLowerCase()
        );
      }
      if (targetMode === "department") {
        return allUsers.filter(
          (u) => String(u.department_id || "") === String(filterDepartmentId || "")
        );
      }
      if (targetMode === "location") {
        return allUsers.filter(
          (u) => String(u.location_id || "") === String(filterLocationId || "")
        );
      }
      if (targetMode === "range") {
        const s = parseInt(String(extStart || "0").replace(/\D/g, ""), 10) || 0;
        const e = parseInt(String(extEnd || "999999").replace(/\D/g, ""), 10) || 999999;
        const min = Math.min(s, e);
        const max = Math.max(s, e);
        return allUsers.filter((u) => {
          const num = parseInt(String(u.extension || "").replace(/\D/g, ""), 10);
          return !Number.isNaN(num) && num >= min && num <= max;
        });
      }
      return [];
    }

    if (activeModule === "subscriber_groups") {
      const allGroups = metadata.subscriber_groups || [];
      if (targetMode === "all") return allGroups;
      const setIds = new Set(selectedIds.map(String));
      return allGroups.filter((g) => setIds.has(String(g.id)));
    }

    if (activeModule === "queues") {
      const allQueues = metadata.queues || [];
      if (targetMode === "all") return allQueues;
      const setIds = new Set(selectedIds.map(String));
      return allQueues.filter(
        (q) =>
          setIds.has(String(q.id)) ||
          setIds.has(String(q.extension || q.queue_number || ""))
      );
    }

    if (activeModule === "outbound_rules") {
      const allRules = metadata.outbound_rules || [];
      if (targetMode === "all") return allRules;
      const setIds = new Set(selectedIds.map(String));
      return allRules.filter((r) => setIds.has(String(r.id)));
    }

    return [];
  }, [
    activeModule,
    targetMode,
    selectedIds,
    filterSubGroupId,
    filterPickupGroupId,
    filterRoleCode,
    filterDepartmentId,
    filterLocationId,
    extStart,
    extEnd,
    metadata
  ]);

  // Build clean changes payload for API
  const buildChangesPayload = () => {
    if (activeModule === "users") {
      const out = {};
      if (userChanges.recording_active !== UNCHANGED)
        out.recording_active = userChanges.recording_active === "true";
      if (userChanges.is_active !== UNCHANGED)
        out.is_active = userChanges.is_active === "true";
      if (userChanges.role !== UNCHANGED) out.role = userChanges.role;
      if (userChanges.department_id !== UNCHANGED)
        out.department_id = userChanges.department_id;
      if (userChanges.location_id !== UNCHANGED)
        out.location_id = userChanges.location_id;
      if (userChanges.outbound_caller_id_mode === "clear") {
        out.outbound_caller_id = "__CLEAR__";
      } else if (
        userChanges.outbound_caller_id_mode === "set" &&
        userChanges.outbound_caller_id.trim()
      ) {
        out.outbound_caller_id = userChanges.outbound_caller_id.trim();
      }
      if (userChanges.max_concurrent_outbound !== "")
        out.max_concurrent_outbound = Number(userChanges.max_concurrent_outbound);
      if (userChanges.outbound_quarantined !== UNCHANGED)
        out.outbound_quarantined = userChanges.outbound_quarantined === "true";
      if (userChanges.voicemail_active !== UNCHANGED)
        out.voicemail_active = userChanges.voicemail_active === "true";
      if (userChanges.voicemail_to_email !== UNCHANGED)
        out.voicemail_to_email = userChanges.voicemail_to_email === "true";
      if (userChanges.voicemail_pin.trim())
        out.voicemail_pin = userChanges.voicemail_pin.trim();
      if (userChanges.mobile_transfer_enabled !== UNCHANGED)
        out.mobile_transfer_enabled = userChanges.mobile_transfer_enabled === "true";
      if (userChanges.transport !== UNCHANGED) out.transport = userChanges.transport;
      if (userChanges.max_activations !== "")
        out.max_activations = Number(userChanges.max_activations);
      if (userChanges.ring_timeout !== "")
        out.ring_timeout = Number(userChanges.ring_timeout);
      if (userChanges.forwarding_reset) out.forwarding_reset = true;

      if (userChanges.forwarding_always_mode !== UNCHANGED) {
        out.forwarding_always = {
          active: userChanges.forwarding_always_mode === "enable",
          type: userChanges.forwarding_always_type,
          target: userChanges.forwarding_always_target.trim()
        };
      }
      if (userChanges.forwarding_busy_mode !== UNCHANGED) {
        out.forwarding_busy = {
          active: userChanges.forwarding_busy_mode === "enable",
          type: userChanges.forwarding_busy_type,
          target: userChanges.forwarding_busy_target.trim()
        };
      }
      if (userChanges.forwarding_no_answer_mode !== UNCHANGED) {
        out.forwarding_no_answer = {
          active: userChanges.forwarding_no_answer_mode === "enable",
          type: userChanges.forwarding_no_answer_type,
          target: userChanges.forwarding_no_answer_target.trim(),
          timeout: Number(userChanges.ring_timeout) || 30
        };
      }
      if (userChanges.follow_me_enabled !== UNCHANGED)
        out.follow_me_enabled = userChanges.follow_me_enabled === "true";
      if (userChanges.auto_logout_enabled !== UNCHANGED)
        out.auto_logout_enabled = userChanges.auto_logout_enabled === "true";
      if (userChanges.auto_logout_duration !== "")
        out.auto_logout_duration = Number(userChanges.auto_logout_duration);
      if (userChanges.password_expiry_enabled !== UNCHANGED)
        out.password_expiry_enabled = userChanges.password_expiry_enabled === "true";
      if (userChanges.password_expiry_months !== "")
        out.password_expiry_months = Number(userChanges.password_expiry_months);

      if (userChanges.outbound_rule_action !== UNCHANGED) {
        out.outbound_rule_action = userChanges.outbound_rule_action;
        out.outbound_rule_ids = userChanges.outbound_rule_ids;
      }
      if (userChanges.subscriber_group_action !== UNCHANGED) {
        out.subscriber_group_action = userChanges.subscriber_group_action;
        out.assign_subscriber_group_ids = userChanges.assign_subscriber_group_ids;
      }
      if (userChanges.pickup_group_action !== UNCHANGED) {
        out.pickup_group_action = userChanges.pickup_group_action;
        out.pickup_group_ids = userChanges.pickup_group_ids;
      }
      if (userChanges.queue_action !== UNCHANGED) {
        out.queue_action = userChanges.queue_action;
        out.queue_ids = userChanges.queue_ids;
      }
      return out;
    }

    if (activeModule === "subscriber_groups") {
      const out = {};
      if (subGroupChanges.outbound_rule_action !== UNCHANGED) {
        out.outbound_rule_action = subGroupChanges.outbound_rule_action;
        out.outbound_rule_ids = subGroupChanges.outbound_rule_ids;
      }
      if (subGroupChanges.allowed_outbound_groups_action !== UNCHANGED) {
        out.allowed_outbound_groups_action = subGroupChanges.allowed_outbound_groups_action;
        out.allowed_outbound_groups = subGroupChanges.allowed_outbound_groups;
      }
      if (subGroupChanges.allowed_inbound_groups_action !== UNCHANGED) {
        out.allowed_inbound_groups_action = subGroupChanges.allowed_inbound_groups_action;
        out.allowed_inbound_groups = subGroupChanges.allowed_inbound_groups;
      }
      if (subGroupChanges.allow_international !== UNCHANGED) {
        out.allow_international = subGroupChanges.allow_international === "true";
      }
      if (subGroupChanges.recording_active !== UNCHANGED)
        out.recording_active = subGroupChanges.recording_active === "true";
      if (subGroupChanges.is_active !== UNCHANGED)
        out.is_active = subGroupChanges.is_active === "true";
      if (subGroupChanges.role !== UNCHANGED) out.role = subGroupChanges.role;
      if (subGroupChanges.department_id !== UNCHANGED)
        out.department_id = subGroupChanges.department_id;
      if (subGroupChanges.location_id !== UNCHANGED)
        out.location_id = subGroupChanges.location_id;
      if (subGroupChanges.ring_timeout !== "")
        out.ring_timeout = Number(subGroupChanges.ring_timeout);
      if (subGroupChanges.forwarding_reset) out.forwarding_reset = true;
      if (subGroupChanges.voicemail_active !== UNCHANGED)
        out.voicemail_active = subGroupChanges.voicemail_active === "true";
      if (subGroupChanges.mobile_transfer_enabled !== UNCHANGED)
        out.mobile_transfer_enabled = subGroupChanges.mobile_transfer_enabled === "true";
      if (subGroupChanges.outbound_quarantined !== UNCHANGED)
        out.outbound_quarantined = subGroupChanges.outbound_quarantined === "true";
      if (subGroupChanges.pickup_group_action !== UNCHANGED) {
        out.pickup_group_action = subGroupChanges.pickup_group_action;
        out.pickup_group_ids = subGroupChanges.pickup_group_ids;
      }
      if (subGroupChanges.queue_action !== UNCHANGED) {
        out.queue_action = subGroupChanges.queue_action;
        out.queue_ids = subGroupChanges.queue_ids;
      }
      return out;
    }

    if (activeModule === "queues") {
      const out = {};
      if (queueChanges.strategy !== UNCHANGED) out.strategy = queueChanges.strategy;
      if (queueChanges.timeout !== "") out.timeout = Number(queueChanges.timeout);
      if (queueChanges.retry !== "") out.retry = Number(queueChanges.retry);
      if (queueChanges.wrapup_time !== "")
        out.wrapup_time = Number(queueChanges.wrapup_time);
      if (queueChanges.max_wait_time_enabled !== UNCHANGED)
        out.max_wait_time_enabled = queueChanges.max_wait_time_enabled === "true";
      if (queueChanges.max_wait_time !== "")
        out.max_wait_time = Number(queueChanges.max_wait_time);
      if (queueChanges.max_len !== "") out.max_len = Number(queueChanges.max_len);
      if (queueChanges.max_concurrent_breaks !== "")
        out.max_concurrent_breaks = Number(queueChanges.max_concurrent_breaks);
      if (queueChanges.show_queue_name !== UNCHANGED)
        out.show_queue_name = queueChanges.show_queue_name === "true";
      if (queueChanges.notify_missed_calls !== UNCHANGED)
        out.notify_missed_calls = queueChanges.notify_missed_calls === "true";
      if (queueChanges.service_level !== "")
        out.service_level = Number(queueChanges.service_level);
      if (queueChanges.weight !== "") out.weight = Number(queueChanges.weight);
      if (queueChanges.ring_in_use !== UNCHANGED)
        out.ring_in_use = queueChanges.ring_in_use === "true";
      if (queueChanges.hold_music_class !== UNCHANGED)
        out.hold_music_class = queueChanges.hold_music_class;
      if (queueChanges.announce_position !== UNCHANGED)
        out.announce_position = queueChanges.announce_position === "true";
      if (queueChanges.announce_holdtime !== UNCHANGED)
        out.announce_holdtime = queueChanges.announce_holdtime === "true";
      if (queueChanges.periodic_announcement_enabled !== UNCHANGED)
        out.periodic_announcement_enabled =
          queueChanges.periodic_announcement_enabled === "true";
      if (queueChanges.periodic_announcement_interval !== "")
        out.periodic_announcement_interval = Number(
          queueChanges.periodic_announcement_interval
        );
      if (queueChanges.all_busy_routing_enabled !== UNCHANGED)
        out.all_busy_routing_enabled =
          queueChanges.all_busy_routing_enabled === "true";
      if (queueChanges.auto_pause_missed_enabled !== UNCHANGED)
        out.auto_pause_missed_enabled =
          queueChanges.auto_pause_missed_enabled === "true";
      if (queueChanges.auto_pause_missed_count !== "")
        out.auto_pause_missed_count = Number(queueChanges.auto_pause_missed_count);
      if (queueChanges.auto_pause_disconnect_enabled !== UNCHANGED)
        out.auto_pause_disconnect_enabled =
          queueChanges.auto_pause_disconnect_enabled === "true";
      if (queueChanges.auto_pause_disconnect_grace_sec !== "")
        out.auto_pause_disconnect_grace_sec = Number(
          queueChanges.auto_pause_disconnect_grace_sec
        );
      if (queueChanges.survey_enabled !== UNCHANGED)
        out.survey_enabled = queueChanges.survey_enabled === "true";
      if (queueChanges.survey_scale !== UNCHANGED)
        out.survey_scale = queueChanges.survey_scale;
      if (queueChanges.smart_callback_enabled !== UNCHANGED)
        out.smart_callback_enabled = queueChanges.smart_callback_enabled === "true";
      if (queueChanges.smart_callback_max_wait_seconds !== "")
        out.smart_callback_max_wait_seconds = Number(
          queueChanges.smart_callback_max_wait_seconds
        );
      if (queueChanges.omnichannel_enabled !== UNCHANGED)
        out.omnichannel_enabled = queueChanges.omnichannel_enabled === "true";
      if (queueChanges.omnichannel_channels_mode === "set")
        out.omnichannel_channels = queueChanges.omnichannel_channels;
      if (queueChanges.omnichannel_sla_sec !== "")
        out.omnichannel_sla_sec = Number(queueChanges.omnichannel_sla_sec);
      if (queueChanges.omnichannel_max_chats_per_agent !== "")
        out.omnichannel_max_chats_per_agent = Number(
          queueChanges.omnichannel_max_chats_per_agent
        );
      if (queueChanges.member_action !== UNCHANGED) {
        out.member_action = queueChanges.member_action;
        out.member_extensions = queueChanges.member_extensions;
      }
      return out;
    }

    if (activeModule === "outbound_rules") {
      const out = {};
      if (outboundRuleChanges.trunk_id !== UNCHANGED)
        out.trunk_id = outboundRuleChanges.trunk_id;
      if (outboundRuleChanges.caller_id_mode === "clear") {
        out.caller_id = "__CLEAR__";
      } else if (
        outboundRuleChanges.caller_id_mode === "set" &&
        outboundRuleChanges.caller_id.trim()
      ) {
        out.caller_id = outboundRuleChanges.caller_id.trim();
      }
      if (outboundRuleChanges.pin_mode !== UNCHANGED) {
        out.pin_mode = outboundRuleChanges.pin_mode;
        if (outboundRuleChanges.pin_code.trim())
          out.pin_code = outboundRuleChanges.pin_code.trim();
        out.pin_start_time = outboundRuleChanges.pin_start_time;
        out.pin_end_time = outboundRuleChanges.pin_end_time;
      }
      if (outboundRuleChanges.allowed_users_action !== UNCHANGED) {
        out.allowed_users_action = outboundRuleChanges.allowed_users_action;
        out.allowed_users = outboundRuleChanges.allowed_users;
      }
      return out;
    }

    return {};
  };

  const activeChangesObj = useMemo(
    () => buildChangesPayload(),
    [activeModule, userChanges, subGroupChanges, queueChanges, outboundRuleChanges]
  );
  const changedFieldsCount = Object.keys(activeChangesObj).length;

  const resetCurrentForm = () => {
    if (activeModule === "users") setUserChanges(INITIAL_USER_CHANGES);
    else if (activeModule === "subscriber_groups")
      setSubGroupChanges(INITIAL_SUBGROUP_CHANGES);
    else if (activeModule === "queues") setQueueChanges(INITIAL_QUEUE_CHANGES);
    else if (activeModule === "outbound_rules")
      setOutboundRuleChanges(INITIAL_OUTBOUND_RULE_CHANGES);
  };

  // Quick One-Click Presets
  const applyPresetTemplate = (presetKey) => {
    if (presetKey === "disable_all_recordings") {
      if (!isModal) setActiveModule("users");
      if (!isModal) setTargetMode("all");
      setUserChanges({ ...INITIAL_USER_CHANGES, recording_active: "false" });
      showToast("success", "Şablon yüklendi: Seçili kullanıcılarda Ses Kayıt -> Kapalı.");
    } else if (presetKey === "enable_all_recordings") {
      if (!isModal) setActiveModule("users");
      if (!isModal) setTargetMode("all");
      setUserChanges({ ...INITIAL_USER_CHANGES, recording_active: "true" });
      showToast("success", "Şablon yüklendi: Seçili kullanıcılarda Ses Kayıt -> Açık.");
    } else if (presetKey === "change_subgroup_outbound_rule") {
      if (!isModal) setActiveModule("subscriber_groups");
      setTargetMode("selected");
      if (selectedIds.length === 0 && metadata.subscriber_groups.length > 0) {
        setSelectedIds([String(metadata.subscriber_groups[0].id)]);
      }
      const firstRuleId = metadata.outbound_rules?.[0]?.id;
      setSubGroupChanges({
        ...INITIAL_SUBGROUP_CHANGES,
        outbound_rule_action: "replace",
        outbound_rule_ids: firstRuleId ? [firstRuleId] : []
      });
      showToast("success", "Şablon yüklendi: Abone Grubu Giden Arama Kuralı Değiştirme.");
    } else if (presetKey === "enable_subgroup_recordings") {
      if (!isModal) setActiveModule("subscriber_groups");
      setSubGroupChanges({ ...INITIAL_SUBGROUP_CHANGES, recording_active: "true" });
      showToast("success", "Şablon yüklendi: Seçili abone gruplarındaki abonelerde Ses Kayıt -> Açık.");
    } else if (presetKey === "disable_subgroup_recordings") {
      if (!isModal) setActiveModule("subscriber_groups");
      setSubGroupChanges({ ...INITIAL_SUBGROUP_CHANGES, recording_active: "false" });
      showToast("success", "Şablon yüklendi: Seçili abone gruplarındaki abonelerde Ses Kayıt -> Kapalı.");
    } else if (presetKey === "reset_all_forwardings") {
      if (!isModal) setActiveModule("users");
      if (!isModal) setTargetMode("all");
      setUserChanges({ ...INITIAL_USER_CHANGES, forwarding_reset: true });
      showToast("success", "Şablon yüklendi: Seçili kullanıcılarda çağrı yönlendirmeleri sıfırlanacak.");
    } else if (presetKey === "clear_all_quarantines") {
      if (!isModal) setActiveModule("users");
      if (!isModal) setTargetMode("all");
      setUserChanges({ ...INITIAL_USER_CHANGES, outbound_quarantined: "false" });
      showToast("success", "Şablon yüklendi: Seçili kullanıcılarda dış arama karantinası kaldırılacak.");
    } else if (presetKey === "enable_queue_omnichannel") {
      if (!isModal) setActiveModule("queues");
      if (!isModal) setTargetMode("all");
      setQueueChanges({
        ...INITIAL_QUEUE_CHANGES,
        omnichannel_enabled: "true",
        omnichannel_sla_sec: "180"
      });
      showToast("success", "Şablon yüklendi: Seçili kuyruklarda Omnichannel otomatik dağıtım (180 sn SLA) açılacak.");
    } else if (presetKey === "queue_strategy_rrmemory") {
      if (!isModal) setActiveModule("queues");
      setQueueChanges({
        ...INITIAL_QUEUE_CHANGES,
        strategy: "rrmemory",
        timeout: "20",
        wrapup_time: "15"
      });
      showToast("success", "Şablon yüklendi: Kuyruklarda Sırayla Hatırlamalı (rrmemory), 20 sn Çaldırma ve 15 sn ACW seçildi.");
    } else if (presetKey === "queue_enable_rona") {
      if (!isModal) setActiveModule("queues");
      setQueueChanges({
        ...INITIAL_QUEUE_CHANGES,
        auto_pause_missed_enabled: "true",
        auto_pause_missed_count: "2",
        auto_pause_disconnect_enabled: "true",
        auto_pause_disconnect_grace_sec: "45"
      });
      showToast("success", "Şablon yüklendi: Kuyruklarda Otomatik Mola (RONA) ve Bağlantı Kopma Koruması açılacak.");
    } else if (presetKey === "queue_enable_survey_callback") {
      if (!isModal) setActiveModule("queues");
      setQueueChanges({
        ...INITIAL_QUEUE_CHANGES,
        survey_enabled: "true",
        survey_scale: "1-5",
        smart_callback_enabled: "true",
        smart_callback_max_wait_seconds: "120"
      });
      showToast("success", "Şablon yüklendi: Kuyruklarda Memnuniyet Anketi (1-5) ve Otomatik Geri Arama (120 sn) açılacak.");
    } else if (presetKey === "outbound_clear_pins") {
      if (!isModal) setActiveModule("outbound_rules");
      setOutboundRuleChanges({
        ...INITIAL_OUTBOUND_RULE_CHANGES,
        pin_mode: "none"
      });
      showToast("success", "Şablon yüklendi: Seçili giden arama kurallarında PIN zorunluluğu kaldırılacak.");
    } else if (presetKey === "outbound_outside_work_hours_pin") {
      if (!isModal) setActiveModule("outbound_rules");
      setOutboundRuleChanges({
        ...INITIAL_OUTBOUND_RULE_CHANGES,
        pin_mode: "outside_work_hours"
      });
      showToast("success", "Şablon yüklendi: Seçili giden arama kurallarında Mesai Dışı PIN zorunluluğu seçildi.");
    }
  };

  const handleExecuteBulkApply = async () => {
    if (!canWrite) return;
    if (matchedTargets.length === 0) {
      showToast("error", "Seçilen hedef kriterlerine uygun hiçbir kayıt bulunamadı.");
      setConfirmApplyOpen(false);
      return;
    }
    if (changedFieldsCount === 0) {
      showToast("error", "Lütfen en az bir özellikte yapılacak değişikliği seçin.");
      setConfirmApplyOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        module: activeModule,
        target_mode: targetMode,
        target_ids: selectedIds,
        subscriber_group_id: filterSubGroupId || null,
        pickup_group_id: filterPickupGroupId || null,
        role_code: filterRoleCode || null,
        department_id: filterDepartmentId || null,
        location_id: filterLocationId || null,
        ext_start: extStart || null,
        ext_end: extEnd || null,
        changes: activeChangesObj
      };

      const res = await fetch(`${API_BASE}/api/settings/bulk-config/apply`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Toplu konfigürasyon uygulanırken hata oluştu.");
      }

      setConfirmApplyOpen(false);
      showToast(
        "success",
        `Toplu konfigürasyon başarıyla uygulandı! Etkilenen kayıt: ${data.affected_count} (${data.summary})`
      );
      resetCurrentForm();
      await fetchMetadata();
      if (typeof onApplied === "function") {
        onApplied(data);
      }
    } catch (err) {
      showToast("error", err.message || "Sunucu hatası oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoOperation = async (operationId) => {
    setUndoingId(operationId);
    try {
      const res = await fetch(`${API_BASE}/api/settings/bulk-config/undo`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ operation_id: operationId })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Geri alma işlemi başarısız oldu.");
      }
      setConfirmUndoOp(null);
      showToast("success", `İşlem geri alındı ve eski ayarlar geri yüklendi: ${data.summary}`);
      await fetchMetadata();
      if (typeof onApplied === "function") {
        onApplied(data);
      }
    } catch (err) {
      showToast("error", err.message || "Geri alma sırasında hata oluştu.");
    } finally {
      setUndoingId(null);
    }
  };

  const toggleIdInList = (list, idVal) => {
    const exists = list.some((x) => String(x) === String(idVal));
    if (exists) return list.filter((x) => String(x) !== String(idVal));
    return [...list, idVal];
  };

  const matchedTargetIdSet = useMemo(
    () => new Set((matchedTargets || []).map((t) => String(t.id))),
    [matchedTargets]
  );

  // Combined available items for the Queue-style 2-column transfer picker
  const allDualPickerItems = useMemo(() => {
    if (activeModule === "users") {
      const groupItems = (metadata.subscriber_groups || []).map((g) => {
        const memberUserIds = getGroupMemberUserIds(g, metadata.users || []);
        return {
          id: `group_${g.id}`,
          group_id: g.id,
          full_name: g.name,
          extension: `Abone Grubu (${memberUserIds.length} Abone)`,
          role: "subscriber_group",
          is_subscriber_group: true,
          memberUserIds
        };
      });
      const userItems = (metadata.users || []).map((u) => ({
        ...u,
        id: String(u.id),
        is_subscriber_group: false
      }));
      return [...groupItems, ...userItems];
    }
    if (activeModule === "subscriber_groups") {
      return (metadata.subscriber_groups || []).map((g) => ({
        ...g,
        id: String(g.id),
        full_name: g.name,
        extension: `${(g.extensions || []).length} Abone`,
        is_subscriber_group: true,
        memberUserIds: getGroupMemberUserIds(g, metadata.users || [])
      }));
    }
    if (activeModule === "queues") {
      return (metadata.queues || []).map((q) => ({
        ...q,
        id: String(q.id),
        full_name: q.name,
        extension: String(q.extension || q.queue_number || "-")
      }));
    }
    if (activeModule === "outbound_rules") {
      return (metadata.outbound_rules || []).map((r) => ({
        ...r,
        id: String(r.id),
        full_name: r.name,
        extension: r.prefix ? `Önek: ${r.prefix}` : "Genel Kural"
      }));
    }
    return [];
  }, [activeModule, metadata]);

  // Effective selected IDs set (includes group_X tokens and matched target IDs)
  const effectiveSelectedIdSet = useMemo(() => {
    if (targetMode === "selected") {
      const set = new Set(selectedIds.map(String));
      // Also resolve extensions to user/queue IDs
      if (activeModule === "users") {
        (metadata.users || []).forEach((u) => {
          if (set.has(String(u.extension))) set.add(String(u.id));
        });
        selectedIds.forEach((tok) => {
          const sTok = String(tok);
          if (sTok.startsWith("group_")) {
            const gid = sTok.replace("group_", "");
            const grp = (metadata.subscriber_groups || []).find(
              (g) => String(g.id) === gid
            );
            if (grp) {
              getGroupMemberUserIds(grp, metadata.users || []).forEach((uid) =>
                set.add(String(uid))
              );
            }
          }
        });
      } else if (activeModule === "queues") {
        (metadata.queues || []).forEach((q) => {
          const qExt = String(q.extension || q.queue_number || "");
          if (qExt && set.has(qExt)) set.add(String(q.id));
        });
      }
      return set;
    }
    const set = new Set((matchedTargets || []).map((t) => String(t.id)));
    if (
      activeModule === "users" &&
      targetMode === "subscriber_group" &&
      filterSubGroupId
    ) {
      set.add(`group_${filterSubGroupId}`);
    }
    return set;
  }, [targetMode, selectedIds, matchedTargets, activeModule, metadata, filterSubGroupId]);

  const unassignedPickerItems = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return allDualPickerItems.filter((item) => {
      if (effectiveSelectedIdSet.has(String(item.id))) return false;
      if (!q) return true;
      return (
        String(item.full_name || item.name || "").toLowerCase().includes(q) ||
        String(item.extension || "").toLowerCase().includes(q) ||
        (item.is_subscriber_group && "abone grubu".includes(q))
      );
    });
  }, [allDualPickerItems, effectiveSelectedIdSet, targetSearch]);

  const selectedPickerItems = useMemo(() => {
    const q = selectedTargetSearch.trim().toLowerCase();
    return allDualPickerItems.filter((item) => {
      if (!effectiveSelectedIdSet.has(String(item.id))) return false;
      if (!q) return true;
      return (
        String(item.full_name || item.name || "").toLowerCase().includes(q) ||
        String(item.extension || "").toLowerCase().includes(q) ||
        (item.is_subscriber_group && "abone grubu".includes(q))
      );
    });
  }, [allDualPickerItems, effectiveSelectedIdSet, selectedTargetSearch]);

  const toggleSelectedTarget = (item) => {
    const sId = String(item.id);
    const extStr = String(item.extension || item.queue_number || "");
    const isSubGroup =
      activeModule === "users" &&
      (!!item.is_subscriber_group || sId.startsWith("group_"));

    const getBaseIds = () => {
      if (targetMode === "selected") {
        return Array.from(effectiveSelectedIdSet);
      }
      const list = (matchedTargets || []).map((t) => String(t.id));
      if (
        activeModule === "users" &&
        targetMode === "subscriber_group" &&
        filterSubGroupId
      ) {
        list.push(`group_${filterSubGroupId}`);
      }
      return list;
    };

    const baseIds = getBaseIds();
    setTargetMode("selected");

    if (isSubGroup) {
      const grpKey = sId;
      const grpId = grpKey.replace("group_", "");
      const grpObj = (metadata.subscriber_groups || []).find(
        (g) => String(g.id) === grpId
      );
      const memberUserIds =
        item.memberUserIds ||
        (grpObj ? getGroupMemberUserIds(grpObj, metadata.users || []) : []);
      const exists = baseIds.includes(grpKey);

      if (exists) {
        // Abone grubu çıkarıldığında hem grubu hem de içindeki kullanıcıları (başka seçili grupta değillerse) çıkar
        const remainingGroupKeys = baseIds.filter(
          (uid) => String(uid).startsWith("group_") && String(uid) !== grpKey
        );
        const protectedUserIds = new Set();
        remainingGroupKeys.forEach((rk) => {
          const otherGid = String(rk).replace("group_", "");
          const otherGrp = (metadata.subscriber_groups || []).find(
            (g) => String(g.id) === otherGid
          );
          if (otherGrp) {
            getGroupMemberUserIds(otherGrp, metadata.users || []).forEach((uid) =>
              protectedUserIds.add(String(uid))
            );
          }
        });
        const next = baseIds.filter((qid) => {
          const sQid = String(qid);
          if (sQid === grpKey) return false;
          if (
            memberUserIds.some((uid) => String(uid) === sQid) &&
            !protectedUserIds.has(sQid)
          ) {
            return false;
          }
          return true;
        });
        setSelectedIds(next);
      } else {
        // Abone grubu eklendiğinde hem abone grubunu hem de içindeki tüm aboneleri ekle
        const next = [...baseIds];
        if (!next.includes(grpKey)) next.push(grpKey);
        memberUserIds.forEach((uid) => {
          const sUid = String(uid);
          if (!next.includes(sUid)) next.push(sUid);
        });
        setSelectedIds(next);
      }
      return;
    }

    const exists =
      baseIds.includes(sId) || (!isSubGroup && extStr && baseIds.includes(extStr));
    if (exists) {
      setSelectedIds(
        baseIds.filter((x) => x !== sId && (!extStr || x !== extStr))
      );
    } else {
      setSelectedIds([...baseIds, sId]);
    }
  };

  const contentBody = (
    <div className="flex flex-col gap-5">
      {/* Header & Quick Presets */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl ${lightBg} ${text} shrink-0`}>
              <Sliders size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {activeModule === "queues"
                    ? "ACD Arama Kuyrukları — Toplu Konfigürasyon"
                    : activeModule === "subscriber_groups"
                    ? "Abone Grupları & Kuralları — Toplu Konfigürasyon"
                    : activeModule === "outbound_rules"
                    ? "Giden Arama Kuralları — Toplu Konfigürasyon"
                    : isModal
                    ? "Kullanıcılar & Aboneler — Toplu Konfigürasyon"
                    : "Toplu Konfigürasyon & Kitle Yönetimi Merkezi"}
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${lightBg} ${text} border ${borderLight}`}>
                  Tek Seferde Çoklu Güncelleme & Geri Alma (Undo)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeModule === "queues"
                  ? "Seçtiğiniz ACD arama kuyruklarında çalma stratejisi, kapasite, otomatik mola (RONA), anonslar, geri arama, anket, Omnichannel ve kuyruk temsilcilerini tek seferde topluca yapılandırın."
                  : activeModule === "subscriber_groups"
                  ? "Seçtiğiniz abone gruplarında giden arama kurallarını ve gruptaki abonelerin ses kayıt / yönlendirme politikalarını tek seferde topluca değiştirin."
                  : activeModule === "outbound_rules"
                  ? "Seçtiğiniz giden arama kurallarında birincil dış hat (SIP Trunk), giden CallerID ve PIN şifre zorunluluğu ayarlarını tek seferde topluca değiştirin."
                  : "Seçtiğiniz kullanıcılar ve abone grupları üzerinde ses kaydı, dış arama, yönlendirme, sesli posta ve SIP güvenlik özelliklerini tek seferde topluca değiştirin."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
              <History size={15} className={text} />
              <span>İşlem Geçmişi & Geri Al ({metadata.history?.length || 0})</span>
            </button>
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Hızlı Tek Tık Şablonları (Aktif Sekmeye Özel) */}
        <div className="mt-4">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 flex items-center gap-1.5">
            <Sparkles size={13} className={text} />
            Hızlı İşlem Şablonları (Tek Tıkla Doldur)
          </div>
          <div className="flex flex-wrap gap-2">
            {activeModule === "users" && (
              <>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("disable_all_recordings")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Volume2 size={13} className="text-rose-500" />
                  Ses Kaydını Kapat
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("enable_all_recordings")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Volume2 size={13} className="text-emerald-500" />
                  Ses Kaydını Aç
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("reset_all_forwardings")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={13} className="text-amber-500" />
                  Çağrı Yönlendirmelerini Sıfırla
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("clear_all_quarantines")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Shield size={13} className="text-blue-500" />
                  Dış Arama Karantinalarını Kaldır
                </button>
              </>
            )}

            {activeModule === "subscriber_groups" && (
              <>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("change_subgroup_outbound_rule")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <ArrowUpRight size={13} className="text-indigo-500" />
                  Giden Arama Kuralını Değiştir
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("enable_subgroup_recordings")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Volume2 size={13} className="text-emerald-500" />
                  Gruptaki Abonelerde Ses Kaydını Aç
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("disable_subgroup_recordings")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Volume2 size={13} className="text-rose-500" />
                  Gruptaki Abonelerde Ses Kaydını Kapat
                </button>
              </>
            )}

            {activeModule === "queues" && (
              <>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("queue_strategy_rrmemory")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:border-indigo-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <PhoneCall size={13} className="text-indigo-500" />
                  Sırayla Hatırlamalı (rrmemory) & 20sn Çaldırma
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("queue_enable_rona")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Clock size={13} className="text-amber-500" />
                  Otomatik Mola (RONA) & Kopma Korumasını Aç
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("queue_enable_survey_callback")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Sparkles size={13} className="text-emerald-500" />
                  Memnuniyet Anketi & Otomatik Geri Aramayı Aç
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("enable_queue_omnichannel")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:border-purple-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <MessageSquare size={13} className="text-purple-500" />
                  Kuyruklarda Omnichannel Dağıtımı Aç
                </button>
              </>
            )}

            {activeModule === "outbound_rules" && (
              <>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("outbound_clear_pins")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Lock size={13} className="text-emerald-500" />
                  PIN Şifre Zorunluluğunu Kaldır (Serbest)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetTemplate("outbound_outside_work_hours_pin")}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:border-amber-300 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Lock size={13} className="text-amber-500" />
                  Mesai Saatleri Dışında PIN Sor
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm ${
            feedback.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
              : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {feedback.type === "error" ? (
              <AlertTriangle size={18} className="shrink-0" />
            ) : (
              <CheckCircle size={18} className="shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* History & Undo Drawer */}
      {showHistoryDrawer && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <History size={16} className={text} />
              Son Uygulanan Toplu Konfigürasyonlar & Tek Tıkla Geri Alma (Undo)
            </h3>
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Kapat
            </button>
          </div>
          {(!metadata.history || metadata.history.length === 0) ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              Henüz kaydedilmiş bir toplu konfigürasyon geçmişi bulunmuyor.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {metadata.history.map((h) => (
                <div
                  key={h.operation_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${lightBg} ${text}`}>
                        {h.module === "users"
                          ? "Kullanıcılar"
                          : h.module === "subscriber_groups"
                          ? "Abone Grubu"
                          : h.module === "queues"
                          ? "Kuyruklar"
                          : "Giden Kural"}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {h.summary}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        ({h.affected_count} kayıt)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {h.timestamp} • Uygulayan: {h.user}
                      {Array.isArray(h.affected_preview) && h.affected_preview.length > 0 && (
                        <span> • Hedefler: {h.affected_preview.slice(0, 4).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  {canWrite && (
                    <button
                      type="button"
                      disabled={undoingId === h.operation_id}
                      onClick={() => setConfirmUndoOp(h)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shrink-0 transition-all"
                    >
                      <RotateCcw size={13} />
                      {undoingId === h.operation_id ? "Geri Alınıyor..." : "Geri Al (Undo)"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Module Selector Tabs (Sadece merkezi ekranda göster, sekme içinden açılan popup'ta gizle) */}
      {!isModal && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            {
              id: "users",
              title: "Kullanıcılar & Aboneler",
              desc: `${metadata.users?.length || 0} Dahili Abone`,
              icon: Users
            },
            {
              id: "subscriber_groups",
              title: "Abone Grupları & Kuralları",
              desc: `${metadata.subscriber_groups?.length || 0} Abone Grubu`,
              icon: Layers
            },
            {
              id: "queues",
              title: "ACD Arama Kuyrukları",
              desc: `${metadata.queues?.length || 0} Çağrı Kuyruğu`,
              icon: PhoneCall
            },
            {
              id: "outbound_rules",
              title: "Giden Arama Kuralları",
              desc: `${metadata.outbound_rules?.length || 0} Dış Arama Kuralı`,
              icon: ArrowUpRight
            }
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = activeModule === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveModule(tab.id);
                  setSelectedIds([]);
                  setTargetMode("all");
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                  isAct
                    ? `${lightBg} ${border} ring-2 ${ring} shadow-sm`
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    isAct
                      ? `${bg} text-white`
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {tab.title}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Step 1: Target Scope Selection */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter size={16} className={text} />
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">
              1. Adım: Hangi Kayıtlar Etkilenecek? (Hedef Kitle Seçimi)
            </h3>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-extrabold ${lightBg} ${text} border ${borderLight}`}>
            Etkilenecek Kayıt Sayısı: {matchedTargets.length}
          </div>
        </div>

        {/* Target Mode Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {activeModule === "users" ? (
            <>
              {[
                { id: "all", label: "Tüm Kullanıcılar" },
                { id: "subscriber_group", label: "1 Abone Grubundaki Kullanıcılar" },
                { id: "pickup_group", label: "Çağrı Toplama Grubuna Göre" },
                { id: "role", label: "Role Göre (Temsilci / Şef)" },
                { id: "department", label: "Departmana Göre" },
                { id: "location", label: "Lokasyona Göre" },
                { id: "range", label: "Dahili Numara Aralığı (Örn: 1000-1050)" },
                { id: "selected", label: `Elle Seçilen Kullanıcılar (${selectedIds.length})` }
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setTargetMode(m.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    targetMode === m.id
                      ? `${bg} text-white border-transparent shadow-sm`
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setTargetMode("all")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  targetMode === "all"
                    ? `${bg} text-white border-transparent shadow-sm`
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                Tüm Kayıtlar
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("selected")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  targetMode === "selected"
                    ? `${bg} text-white border-transparent shadow-sm`
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                Belirli Kayıtları Seç ({selectedIds.length})
              </button>
            </>
          )}
        </div>

        {/* Sub-filter inputs depending on targetMode */}
        {activeModule === "users" && targetMode === "subscriber_group" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Hedef Abone Grubu Seçin
              </label>
              <select
                value={filterSubGroupId}
                onChange={(e) => setFilterSubGroupId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="">-- Abone Grubu Seçin --</option>
                {(metadata.subscriber_groups || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({(g.extensions || []).length} Abone)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeModule === "users" && targetMode === "pickup_group" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Hedef Çağrı Toplama Grubu Seçin
              </label>
              <select
                value={filterPickupGroupId}
                onChange={(e) => setFilterPickupGroupId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="">-- Çağrı Toplama Grubu Seçin --</option>
                {(metadata.call_pickup_groups || []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({(g.extensions || []).length} Abone)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeModule === "users" && targetMode === "role" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Hedef Sistem Rolü Seçin
              </label>
              <select
                value={filterRoleCode}
                onChange={(e) => setFilterRoleCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                {(metadata.roles || []).map((r) => (
                  <option key={r.id || r.role_code} value={r.role_code}>
                    {r.name} ({r.role_code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeModule === "users" && targetMode === "department" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Hedef Departman Seçin
              </label>
              <select
                value={filterDepartmentId}
                onChange={(e) => setFilterDepartmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="">-- Departman Seçin --</option>
                {(metadata.departments || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeModule === "users" && targetMode === "location" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Hedef Lokasyon Seçin
              </label>
              <select
                value={filterLocationId}
                onChange={(e) => setFilterLocationId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              >
                <option value="">-- Lokasyon Seçin --</option>
                {(metadata.locations || []).map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeModule === "users" && targetMode === "range" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Başlangıç Dahili No
              </label>
              <input
                type="text"
                value={extStart}
                onChange={(e) => setExtStart(e.target.value)}
                placeholder="1000"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Bitiş Dahili No
              </label>
              <input
                type="text"
                value={extEnd}
                onChange={(e) => setExtEnd(e.target.value)}
                placeholder="1099"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Queue-Style 2-Column Member & Subscriber Group Transfer Picker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          {/* Sol: Uygun Kullanıcılar & Abone Grupları / Kayıtlar */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 h-[320px]">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-2">
              <div className="flex justify-between items-center gap-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  {activeModule === "users"
                    ? "Kullanıcılar & Abone Grupları"
                    : activeModule === "subscriber_groups"
                    ? "Abone Grupları"
                    : activeModule === "queues"
                    ? "ACD Kuyrukları"
                    : "Giden Arama Kuralları"}
                </h4>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                    {unassignedPickerItems.length} Uygun
                  </span>
                  {unassignedPickerItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const addIds = new Set(Array.from(effectiveSelectedIdSet));
                        unassignedPickerItems.forEach((it) => {
                          addIds.add(String(it.id));
                          if (it.is_subscriber_group && Array.isArray(it.memberUserIds)) {
                            it.memberUserIds.forEach((uid) => addIds.add(String(uid)));
                          }
                        });
                        setSelectedIds(Array.from(addIds));
                        setTargetMode("selected");
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${lightBg} ${text} border ${borderLight} hover:opacity-90 cursor-pointer`}
                    >
                      Tümünü Ekle
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  autoComplete="off"
                  placeholder={
                    activeModule === "users"
                      ? "Temsilci, dahili veya abone grubu ara..."
                      : "Kayıt ara..."
                  }
                  value={targetSearch}
                  onChange={(e) => setTargetSearch(e.target.value)}
                  className={`w-full pl-8 pr-7 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
                {targetSearch && (
                  <button
                    type="button"
                    onClick={() => setTargetSearch("")}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {unassignedPickerItems.map((u) => (
                <div
                  key={u.id}
                  onClick={() => toggleSelectedTarget(u)}
                  className={`flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 ${
                    u.is_subscriber_group ? `${lightBg} border ${borderLight}` : ""
                  }`}
                >
                  {u.is_subscriber_group ? (
                    <div
                      className={`w-8 h-8 rounded-lg ${lightBg} ${text} flex items-center justify-center shrink-0 border ${borderLight}`}
                    >
                      <Users size={16} />
                    </div>
                  ) : activeModule === "users" ? (
                    <img
                      src={
                        u.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          u.full_name || "U"
                        )}&background=random`
                      }
                      alt=""
                      className="w-8 h-8 rounded-lg bg-slate-200 shrink-0"
                    />
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-lg ${lightBg} ${text} flex items-center justify-center shrink-0 border ${borderLight}`}
                    >
                      {activeModule === "queues" ? (
                        <PhoneCall size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {u.full_name || u.name}
                      </p>
                      {u.is_subscriber_group && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text} border ${borderLight}`}
                        >
                          Abone Grubu
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {u.is_subscriber_group
                        ? `${(u.memberUserIds || []).length} Abone`
                        : activeModule === "users"
                        ? `${getRoleLabel(u.role)} • Dahili: ${u.extension}`
                        : activeModule === "queues"
                        ? `Kuyruk Dahili: ${u.extension}`
                        : u.extension}
                    </p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 shrink-0" />
                </div>
              ))}
              {unassignedPickerItems.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  {targetSearch
                    ? "Aramayla eşleşen kayıt bulunamadı."
                    : "Eklenebilecek başka kayıt kalmadı."}
                </div>
              )}
            </div>
          </div>

          {/* Sağ: Seçili Aboneler, Abone Grupları veya Kayıtlar */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 h-[320px]">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 flex flex-col gap-2">
              <div className="flex justify-between items-center gap-2">
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                  {activeModule === "users"
                    ? "Seçili Aboneler & Abone Grupları"
                    : "Seçili Hedef Kayıtlar"}
                </h4>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-lg ${lightBg} ${text} text-[10px] font-bold`}
                  >
                    {matchedTargets.length} Seçili
                  </span>
                  {selectedPickerItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds([]);
                        setTargetMode("selected");
                      }}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-rose-500 cursor-pointer"
                    >
                      Tümünü Çıkar
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  autoComplete="off"
                  placeholder={
                    activeModule === "users"
                      ? "Seçili üyelerde veya dahilide ara..."
                      : "Seçili kayıtlarda ara..."
                  }
                  value={selectedTargetSearch}
                  onChange={(e) => setSelectedTargetSearch(e.target.value)}
                  className={`w-full pl-8 pr-7 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${ring} transition-all`}
                />
                {selectedTargetSearch && (
                  <button
                    type="button"
                    onClick={() => setSelectedTargetSearch("")}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {selectedPickerItems.map((u) => (
                <div
                  key={u.id}
                  onClick={() => toggleSelectedTarget(u)}
                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border shadow-sm transition-all cursor-pointer group ${
                    u.is_subscriber_group
                      ? `${lightBg} border ${borderLight}`
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {u.is_subscriber_group ? (
                      <div
                        className={`w-7 h-7 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}
                      >
                        <Users size={15} />
                      </div>
                    ) : activeModule === "users" ? (
                      <img
                        src={
                          u.avatar ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(
                            u.full_name || "U"
                          )}&background=random`
                        }
                        alt=""
                        className="w-7 h-7 rounded-lg bg-slate-200 shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-7 h-7 rounded-lg ${lightBg} ${text} border ${borderLight} flex items-center justify-center shrink-0`}
                      >
                        {activeModule === "queues" ? (
                          <PhoneCall size={14} />
                        ) : (
                          <ArrowUpRight size={14} />
                        )}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                          {u.full_name || u.name}
                        </p>
                        {u.is_subscriber_group && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${lightBg} ${text} border ${borderLight}`}
                          >
                            Abone Grubu
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {u.is_subscriber_group
                          ? activeModule === "users"
                            ? `${(u.memberUserIds || []).length} Abone (Grup çıkarıldığında üyeleri de çıkarılır)`
                            : `${(u.memberUserIds || []).length} Abone`
                          : activeModule === "users"
                          ? `${getRoleLabel(u.role)} • Dahili: ${u.extension || "-"}`
                          : activeModule === "queues"
                          ? `Kuyruk Dahili: ${u.extension}`
                          : u.extension}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectedTarget(u);
                    }}
                    className="w-6 h-6 rounded-md hover:bg-rose-50 hover:text-rose-500 text-slate-300 flex items-center justify-center transition-all shrink-0"
                    title={
                      u.is_subscriber_group
                        ? "Abone Grubunu ve Üyelerini Çıkar"
                        : "Çıkar"
                    }
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              {selectedPickerItems.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-400">
                  {selectedTargetSearch
                    ? "Aramayla eşleşen seçili kayıt bulunamadı."
                    : "Henüz kayıt seçilmedi. Sol listeden abone veya abone grubu tıklayarak ekleyebilirsiniz."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Module-Specific Bulk Property Editors */}
      {activeModule === "users" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Ses Kayıt, Sesli Posta & Hesap Durumu */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Volume2 size={15} className={text} />
              Ses Kayıt, Sesli Posta & Hesap Durumu
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ses Kayıt Özelliği
                </label>
                <select
                  value={userChanges.recording_active}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, recording_active: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme (Mevcut Kalsın) —</option>
                  <option value="true">Aç (Tüm Görüşmeleri Kaydet)</option>
                  <option value="false">Kapat (Ses Kaydını Devre Dışı Bırak)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kullanıcı Hesap Durumu
                </label>
                <select
                  value={userChanges.is_active}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, is_active: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme (Mevcut Kalsın) —</option>
                  <option value="true">Aktif Et</option>
                  <option value="false">Pasife Al</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sesli Posta (Voicemail)
                </label>
                <select
                  value={userChanges.voicemail_active}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, voicemail_active: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sesli Postayı E-Postaya Gönder
                </label>
                <select
                  value={userChanges.voicemail_to_email}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, voicemail_to_email: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sistem Rolü (Yetki Profili)
                </label>
                <select
                  value={userChanges.role}
                  onChange={(e) => setUserChanges({ ...userChanges, role: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  {(metadata.roles || []).map((r) => (
                    <option key={r.id || r.role_code} value={r.role_code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobil Çağrı Aktarım Yetkisi
                </label>
                <select
                  value={userChanges.mobile_transfer_enabled}
                  onChange={(e) =>
                    setUserChanges({
                      ...userChanges,
                      mobile_transfer_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Departman
                </label>
                <select
                  value={userChanges.department_id}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, department_id: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="__CLEAR__">Departmanı Temizle</option>
                  {(metadata.departments || []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lokasyon
                </label>
                <select
                  value={userChanges.location_id}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, location_id: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="__CLEAR__">Lokasyonu Temizle</option>
                  {(metadata.locations || []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Arama Kuralı, Abone Grubu, Çağrı Toplama & Kuyruk Üyelikleri */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <ArrowUpRight size={15} className={text} />
              Giden Arama Kuralı, Abone Grubu & Kuyruk Atamaları
            </h4>

            {/* Outbound Rules */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Giden Arama Kuralı Yetkisi
              </label>
              <select
                value={userChanges.outbound_rule_action}
                onChange={(e) =>
                  setUserChanges({ ...userChanges, outbound_rule_action: e.target.value })
                }
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="replace">Sadece Seçilen Kurallara İzin Ver (Değiştir / Üzerine Yaz)</option>
                <option value="add">Mevcut Kurallarına Seçilenleri Ekle</option>
                <option value="remove">Seçilen Kurallardan Çıkar</option>
                <option value="clear_all">Tüm Giden Arama Kuralı Yetkilerini Kaldır</option>
              </select>
              {["replace", "add", "remove"].includes(userChanges.outbound_rule_action) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(metadata.outbound_rules || []).map((r) => {
                    const active = userChanges.outbound_rule_ids.some(
                      (x) => String(x) === String(r.id)
                    );
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setUserChanges({
                            ...userChanges,
                            outbound_rule_ids: toggleIdInList(
                              userChanges.outbound_rule_ids,
                              r.id
                            )
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                          active
                            ? `${bg} text-white border-transparent`
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {r.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subscriber Groups */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Abone Grubu Üyeliği
              </label>
              <select
                value={userChanges.subscriber_group_action}
                onChange={(e) =>
                  setUserChanges({
                    ...userChanges,
                    subscriber_group_action: e.target.value
                  })
                }
                className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="replace">Sadece Seçilen Abone Grubuna Taşı (Değiştir)</option>
                <option value="add">Seçilen Abone Grubuna Ekle</option>
                <option value="remove">Seçilen Abone Grubundan Çıkar</option>
                <option value="clear_all">Tüm Abone Gruplarından Çıkar</option>
              </select>
              {["replace", "add", "remove"].includes(userChanges.subscriber_group_action) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(metadata.subscriber_groups || []).map((g) => {
                    const active = userChanges.assign_subscriber_group_ids.some(
                      (x) => String(x) === String(g.id)
                    );
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setUserChanges({
                            ...userChanges,
                            assign_subscriber_group_ids: toggleIdInList(
                              userChanges.assign_subscriber_group_ids,
                              g.id
                            )
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                          active
                            ? `${bg} text-white border-transparent`
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pickup Groups & ACD Queues */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  Çağrı Toplama Grubu (*8)
                </label>
                <select
                  value={userChanges.pickup_group_action}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, pickup_group_action: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="replace">Değiştir</option>
                  <option value="add">Gruba Ekle</option>
                  <option value="remove">Gruptan Çıkar</option>
                  <option value="clear_all">Tümünden Çıkar</option>
                </select>
                {["replace", "add", "remove"].includes(userChanges.pickup_group_action) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(metadata.call_pickup_groups || []).map((pg) => {
                      const active = userChanges.pickup_group_ids.some(
                        (x) => String(x) === String(pg.id)
                      );
                      return (
                        <button
                          key={pg.id}
                          type="button"
                          onClick={() =>
                            setUserChanges({
                              ...userChanges,
                              pickup_group_ids: toggleIdInList(
                                userChanges.pickup_group_ids,
                                pg.id
                              )
                            })
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                            active
                              ? `${bg} text-white border-transparent`
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {pg.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                  ACD Çağrı Kuyruğu Üyeliği
                </label>
                <select
                  value={userChanges.queue_action}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, queue_action: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="add">Seçilen Kuyruklara Ekle</option>
                  <option value="remove">Seçilen Kuyruklardan Çıkar</option>
                </select>
                {["add", "remove"].includes(userChanges.queue_action) && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(metadata.queues || []).map((q) => {
                      const active = userChanges.queue_ids.some(
                        (x) => String(x) === String(q.id)
                      );
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() =>
                            setUserChanges({
                              ...userChanges,
                              queue_ids: toggleIdInList(userChanges.queue_ids, q.id)
                            })
                          }
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                            active
                              ? `${bg} text-white border-transparent`
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {q.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Çağrı Yönlendirme, Çalma Süresi & Beni Takip Et */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <PhoneCall size={15} className={text} />
              Çağrı Yönlendirme, Çaldırma Süresi & Beni Takip Et
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Çaldırma Süresi (Cevapsız Zaman Aşımı - sn)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={userChanges.ring_timeout}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, ring_timeout: e.target.value })
                  }
                  placeholder="Değiştirme (Örn: 30)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Beni Takip Et (Follow Me)
                </label>
                <select
                  value={userChanges.follow_me_enabled}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, follow_me_enabled: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer">
              <input
                type="checkbox"
                checked={userChanges.forwarding_reset}
                onChange={(e) =>
                  setUserChanges({ ...userChanges, forwarding_reset: e.target.checked })
                }
                className="w-4 h-4 rounded"
              />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Tüm Çağrı Yönlendirmelerini (Her Zaman / Meşgul / Cevapsız) Sıfırla ve Kapat
              </span>
            </label>

            {!userChanges.forwarding_reset && (
              <div className="space-y-2.5">
                {[
                  {
                    label: "Her Zaman Yönlendirme",
                    modeKey: "forwarding_always_mode",
                    typeKey: "forwarding_always_type",
                    targetKey: "forwarding_always_target"
                  },
                  {
                    label: "Meşgulde Yönlendirme",
                    modeKey: "forwarding_busy_mode",
                    typeKey: "forwarding_busy_type",
                    targetKey: "forwarding_busy_target"
                  },
                  {
                    label: "Cevapsızda Yönlendirme",
                    modeKey: "forwarding_no_answer_mode",
                    typeKey: "forwarding_no_answer_type",
                    targetKey: "forwarding_no_answer_target"
                  }
                ].map((fRow) => (
                  <div
                    key={fRow.modeKey}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800"
                  >
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        {fRow.label}
                      </label>
                      <select
                        value={userChanges[fRow.modeKey]}
                        onChange={(e) =>
                          setUserChanges({
                            ...userChanges,
                            [fRow.modeKey]: e.target.value
                          })
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      >
                        <option value={UNCHANGED}>Değiştirme</option>
                        <option value="enable">Aktif Et</option>
                        <option value="disable">Kapat</option>
                      </select>
                    </div>
                    {userChanges[fRow.modeKey] === "enable" && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Hedef Tipi
                          </label>
                          <select
                            value={userChanges[fRow.typeKey]}
                            onChange={(e) =>
                              setUserChanges({
                                ...userChanges,
                                [fRow.typeKey]: e.target.value
                              })
                            }
                            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          >
                            <option value="internal">Dahili / Kuyruk</option>
                            <option value="external">Dış Numara (GSM)</option>
                            <option value="voicemail">Sesli Posta</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">
                            Hedef Numara / Kuyruk
                          </label>
                          <input
                            type="text"
                            value={userChanges[fRow.targetKey]}
                            onChange={(e) =>
                              setUserChanges({
                                ...userChanges,
                                [fRow.targetKey]: e.target.value
                              })
                            }
                            placeholder={
                              userChanges[fRow.typeKey] === "voicemail"
                                ? "VOICEMAIL"
                                : "Örn: 1005 veya 0532..."
                            }
                            className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4: Güvenlik, Dış Arama Limitleri & SIP Ayarları */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Shield size={15} className={text} />
              Dış Arama Güvenliği, CallerID, SIP & Oturum Politikası
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dış Arama Karantina Durumu
                </label>
                <select
                  value={userChanges.outbound_quarantined}
                  onChange={(e) =>
                    setUserChanges({
                      ...userChanges,
                      outbound_quarantined: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="false">Karantinayı Kaldır (Dış Aramaya Aç)</option>
                  <option value="true">Karantinaya Al (Dış Aramayı Kilitle)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Eşzamanlı Dış Arama Kanal Limiti
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={userChanges.max_concurrent_outbound}
                  onChange={(e) =>
                    setUserChanges({
                      ...userChanges,
                      max_concurrent_outbound: e.target.value
                    })
                  }
                  placeholder="Değiştirme (0 = Varsayılan)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Giden Arama Numarası (CallerID)
                </label>
                <select
                  value={userChanges.outbound_caller_id_mode}
                  onChange={(e) =>
                    setUserChanges({
                      ...userChanges,
                      outbound_caller_id_mode: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="set">Yeni CallerID Belirle</option>
                  <option value="clear">Özel CallerID'yi Temizle</option>
                </select>
                {userChanges.outbound_caller_id_mode === "set" && (
                  <input
                    type="text"
                    value={userChanges.outbound_caller_id}
                    onChange={(e) =>
                      setUserChanges({
                        ...userChanges,
                        outbound_caller_id: e.target.value
                      })
                    }
                    placeholder="Örn: 908503607390"
                    className="w-full mt-2 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SIP İletişim Protokolü (Transport)
                </label>
                <select
                  value={userChanges.transport}
                  onChange={(e) =>
                    setUserChanges({ ...userChanges, transport: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="UDP">UDP</option>
                  <option value="TCP">TCP</option>
                  <option value="TLS">TLS (Şifreli)</option>
                  <option value="WSS">WSS (WebRTC)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Otomatik Oturum Kapatma (Hareketsizlik)
                </label>
                <select
                  value={userChanges.auto_logout_enabled}
                  onChange={(e) =>
                    setUserChanges({
                      ...userChanges,
                      auto_logout_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Aktif</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Periyodik Şifre Yenileme Zorunluluğu
                </label>
                <select
                  value={userChanges.password_expiry_enabled}
                  onChange={(e) =>
                    setUserChanges({
                      ...userChanges,
                      password_expiry_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Aktif</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Module 2: Subscriber Groups & Group Calling Rules */}
      {activeModule === "subscriber_groups" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <ArrowUpRight size={15} className={text} />
              Abone Grubunun Arama Kurallarını Değiştir
            </h4>

            {/* External Outbound Rule for the Group */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-white">
                Dış Hat Giden Arama Kuralı (Gruptaki Tüm Aboneler İçin)
              </label>
              <p className="text-[11px] text-slate-500">
                Seçilen abone grubundaki tüm kullanıcıların dış arama yaparken kullanacağı Giden Arama Kuralını tek seferde değiştirir.
              </p>
              <select
                value={subGroupChanges.outbound_rule_action}
                onChange={(e) =>
                  setSubGroupChanges({
                    ...subGroupChanges,
                    outbound_rule_action: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="replace">Grubun Giden Arama Kuralını Değiştir (Üzerine Yaz)</option>
                <option value="add">Gruba Yeni Giden Arama Kuralı Ekle</option>
                <option value="remove">Gruptan Seçili Arama Kuralını Çıkar</option>
                <option value="clear_all">Grubun Tüm Dış Arama Kuralı Yetkilerini Kaldır</option>
              </select>
              {["replace", "add", "remove"].includes(
                subGroupChanges.outbound_rule_action
              ) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(metadata.outbound_rules || []).map((r) => {
                    const active = subGroupChanges.outbound_rule_ids.some(
                      (x) => String(x) === String(r.id)
                    );
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setSubGroupChanges({
                            ...subGroupChanges,
                            outbound_rule_ids: toggleIdInList(
                              subGroupChanges.outbound_rule_ids,
                              r.id
                            )
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          active
                            ? `${bg} text-white border-transparent shadow-sm`
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {r.name} {r.prefix ? `(Önek: ${r.prefix})` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Internal Group ACL */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 space-y-2.5">
              <label className="block text-xs font-extrabold text-slate-800 dark:text-white">
                Gruplar Arası İç Arama Yetkisi (Arayabileceği Abone Grupları)
              </label>
              <select
                value={subGroupChanges.allowed_outbound_groups_action}
                onChange={(e) =>
                  setSubGroupChanges({
                    ...subGroupChanges,
                    allowed_outbound_groups_action: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="replace">Sadece Seçilen Grupları Arayabilsin (Değiştir)</option>
                <option value="add">Arayabileceği Gruplara Ekle</option>
                <option value="remove">Arayabileceği Gruplardan Çıkar</option>
                <option value="clear_all">Kısıtlamayı Kaldır (Tüm Grupları Arayabilsin)</option>
              </select>
              {["replace", "add", "remove"].includes(
                subGroupChanges.allowed_outbound_groups_action
              ) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(metadata.subscriber_groups || []).map((g) => {
                    const active = subGroupChanges.allowed_outbound_groups.some(
                      (x) => String(x) === String(g.id)
                    );
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          setSubGroupChanges({
                            ...subGroupChanges,
                            allowed_outbound_groups: toggleIdInList(
                              subGroupChanges.allowed_outbound_groups,
                              g.id
                            )
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          active
                            ? `${bg} text-white border-transparent`
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Uluslararası (Yurtdışı) Arama Yetkisi
              </label>
              <select
                value={subGroupChanges.allow_international}
                onChange={(e) =>
                  setSubGroupChanges({
                    ...subGroupChanges,
                    allow_international: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="true">İzin Ver (Açık)</option>
                <option value="false">Engelle (Kapalı)</option>
              </select>
            </div>
          </div>

          {/* Right Card: Member-Level Bulk Settings for the Subscriber Group */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Users size={15} className={text} />
              Gruptaki Tüm Abonelerin Kullanıcı Özelliklerini Değiştir
            </h4>
            <p className="text-[11px] text-slate-500">
              Seçtiğiniz abone grubuna üye olan tüm dahili abonelerin bireysel ayarlarını da aynı anda güncelleyebilirsiniz:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Grup Üyelerinde Ses Kayıt
                </label>
                <select
                  value={subGroupChanges.recording_active}
                  onChange={(e) =>
                    setSubGroupChanges({
                      ...subGroupChanges,
                      recording_active: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Tüm Üyelerde Aç</option>
                  <option value="false">Tüm Üyelerde Kapat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Grup Üyelerinde Çaldırma Süresi (sn)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={subGroupChanges.ring_timeout}
                  onChange={(e) =>
                    setSubGroupChanges({
                      ...subGroupChanges,
                      ring_timeout: e.target.value
                    })
                  }
                  placeholder="Değiştirme (Örn: 25)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Grup Üyelerinde Sesli Posta
                </label>
                <select
                  value={subGroupChanges.voicemail_active}
                  onChange={(e) =>
                    setSubGroupChanges({
                      ...subGroupChanges,
                      voicemail_active: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Tüm Üyelerde Aç</option>
                  <option value="false">Tüm Üyelerde Kapat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Grup Üyelerinde Mobil Aktarım
                </label>
                <select
                  value={subGroupChanges.mobile_transfer_enabled}
                  onChange={(e) =>
                    setSubGroupChanges({
                      ...subGroupChanges,
                      mobile_transfer_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Tüm Üyelerde Aç</option>
                  <option value="false">Tüm Üyelerde Kapat</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={subGroupChanges.forwarding_reset}
                onChange={(e) =>
                  setSubGroupChanges({
                    ...subGroupChanges,
                    forwarding_reset: e.target.checked
                  })
                }
                className="w-4 h-4 rounded"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Gruptaki Tüm Abonelerin Çağrı Yönlendirmelerini Sıfırla
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Module 3: ACD Queues */}
      {activeModule === "queues" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Genel, Dağıtım Stratejisi, Kapasite & Ekran */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <PhoneCall size={15} className={text} />
              Çağrı Dağıtım Stratejisi, Kapasite & Ekran Ayarları
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Çağrı Dağıtım Stratejisi
                </label>
                <select
                  value={queueChanges.strategy}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, strategy: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="ringall">Tümü Çalsın (ringall)</option>
                  <option value="rrmemory">Sırayla Hatırlamalı (rrmemory)</option>
                  <option value="leastrecent">En Az Çağrı Alan (leastrecent)</option>
                  <option value="fewestcalls">En Az Konuşan (fewestcalls)</option>
                  <option value="random">Rastgele (random)</option>
                  <option value="linear">Doğrusal Sıralı (linear)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Temsilci Çaldırma Süresi (sn)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={queueChanges.timeout}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, timeout: e.target.value })
                  }
                  placeholder="Değiştirme (Örn: 20)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Toparlanma / ACW Süresi (sn)
                </label>
                <input
                  type="number"
                  min={0}
                  max={600}
                  value={queueChanges.wrapup_time}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, wrapup_time: e.target.value })
                  }
                  placeholder="Değiştirme (Örn: 15)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kuyruk Maksimum Çağrı Sayısı
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={queueChanges.max_len}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, max_len: e.target.value })
                  }
                  placeholder="Değiştirme (0 = Sınırsız)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Aynı Anda Molaya Çıkacak Kişi Sayısı
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={queueChanges.max_concurrent_breaks}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      max_concurrent_breaks: e.target.value
                    })
                  }
                  placeholder="Değiştirme (0 = Sınırsız)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kuyruk Adını Ekranda Göster
                </label>
                <select
                  value={queueChanges.show_queue_name}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      show_queue_name: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık (Göster)</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cevapsız Çağrıları Bildir
                </label>
                <select
                  value={queueChanges.notify_missed_calls}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      notify_missed_calls: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık (Bildir)</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Meşguldeki Temsilciyi Çaldır
                </label>
                <select
                  value={queueChanges.ring_in_use}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, ring_in_use: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SLA Hedef Süresi (Service Level - sn)
                </label>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={queueChanges.service_level}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, service_level: e.target.value })
                  }
                  placeholder="Değiştirme (Örn: 20)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kuyruk Öncelik Ağırlığı (Weight)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={queueChanges.weight}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, weight: e.target.value })
                  }
                  placeholder="Değiştirme (Örn: 0)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Otomatik Mola (RONA) & Bağlantı Kopma Koruması */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Clock size={15} className={text} />
              Otomatik Mola (RONA) & Bağlantı Kopma Koruması
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cevapsız Çağrıda Otomatik Mola (RONA)
                </label>
                <select
                  value={queueChanges.auto_pause_missed_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      auto_pause_missed_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Aktif (Molaya Al)</option>
                  <option value="false">Pasif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Üst Üste Kaç Cevapsızda Molaya Alınsın?
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={queueChanges.auto_pause_missed_count}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      auto_pause_missed_count: e.target.value
                    })
                  }
                  placeholder="Değiştirme (Örn: 2)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bağlantı Kopmasında (Offline) Otomatik Mola
                </label>
                <select
                  value={queueChanges.auto_pause_disconnect_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      auto_pause_disconnect_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Aktif (Koruma Açık)</option>
                  <option value="false">Pasif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Yeniden Bağlanma Toleransı (Grace - sn)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={queueChanges.auto_pause_disconnect_grace_sec}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      auto_pause_disconnect_grace_sec: e.target.value
                    })
                  }
                  placeholder="Değiştirme (Örn: 45)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Maksimum Bekleme Süresi Kuralı
                </label>
                <select
                  value={queueChanges.max_wait_time_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      max_wait_time_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Maksimum Bekleme Süresi (sn)
                </label>
                <input
                  type="number"
                  min={10}
                  max={7200}
                  value={queueChanges.max_wait_time}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, max_wait_time: e.target.value })
                  }
                  placeholder="Değiştirme (Örn: 180)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tüm Temsilciler Meşgulse / Çevrimdışıysa Yönlendirme
                </label>
                <select
                  value={queueChanges.all_busy_routing_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      all_busy_routing_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Anonslar, Bekleme Müziği, Geri Arama & Anket */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Volume2 size={15} className={text} />
              Anonslar, Bekleme Müziği, Otomatik Geri Arama & Anket
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bekleme Müziği Sınıfı (MoH)
                </label>
                <select
                  value={queueChanges.hold_music_class}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      hold_music_class: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="default">Varsayılan (Default)</option>
                  <option value="kurumsal_klasik">Kurumsal Klasik</option>
                  <option value="modern_jazz">Modern Jazz</option>
                  <option value="relax_piano">Relax Piyano</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sıra Numarası Anonsu
                </label>
                <select
                  value={queueChanges.announce_position}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      announce_position: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tahmini Bekleme Süresi Anonsu
                </label>
                <select
                  value={queueChanges.announce_holdtime}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      announce_holdtime: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Periyodik Bekleme Anonsu
                </label>
                <select
                  value={queueChanges.periodic_announcement_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      periodic_announcement_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Periyodik Anons Sıklığı (sn)
                </label>
                <input
                  type="number"
                  min={15}
                  max={600}
                  value={queueChanges.periodic_announcement_interval}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      periodic_announcement_interval: e.target.value
                    })
                  }
                  placeholder="Değiştirme (Örn: 45)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Otomatik Geri Arama (Smart Callback)
                </label>
                <select
                  value={queueChanges.smart_callback_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      smart_callback_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Geri Arama Teklif Süresi (sn)
                </label>
                <input
                  type="number"
                  min={15}
                  max={1800}
                  value={queueChanges.smart_callback_max_wait_seconds}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      smart_callback_max_wait_seconds: e.target.value
                    })
                  }
                  placeholder="Değiştirme (Örn: 120)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Çağrı Sonu Memnuniyet Anketi
                </label>
                <select
                  value={queueChanges.survey_enabled}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, survey_enabled: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Anket Puanlama Ölçeği
                </label>
                <select
                  value={queueChanges.survey_scale}
                  onChange={(e) =>
                    setQueueChanges({ ...queueChanges, survey_scale: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="1-5">1 - 5 Puanlama</option>
                  <option value="1-10">1 - 10 (NPS) Puanlama</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 4: Omnichannel & Kuyruk Temsilcileri (Toplu Ekle / Çıkar) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <MessageSquare size={15} className={text} />
              Omnichannel Dağıtım & Kuyruk Temsilcisi Yönetimi
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Omnichannel Dağıtım
                </label>
                <select
                  value={queueChanges.omnichannel_enabled}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      omnichannel_enabled: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                >
                  <option value={UNCHANGED}>— Değiştirme —</option>
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Omnichannel SLA (sn)
                </label>
                <input
                  type="number"
                  min={15}
                  max={3600}
                  value={queueChanges.omnichannel_sla_sec}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      omnichannel_sla_sec: e.target.value
                    })
                  }
                  placeholder="Örn: 180"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Maks. Eşzamanlı Sohbet
                </label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={queueChanges.omnichannel_max_chats_per_agent}
                  onChange={(e) =>
                    setQueueChanges({
                      ...queueChanges,
                      omnichannel_max_chats_per_agent: e.target.value
                    })
                  }
                  placeholder="Örn: 3"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Seçili Kuyruklarda Temsilci (Abone) Ekleme / Çıkarma İşlemi
              </label>
              <select
                value={queueChanges.member_action}
                onChange={(e) =>
                  setQueueChanges({
                    ...queueChanges,
                    member_action: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value={UNCHANGED}>— Kuyruk Temsilcilerine Dokunma —</option>
                <option value="add">Seçilen Temsilcileri Kuyruklara Ekle</option>
                <option value="remove">Seçilen Temsilcileri Kuyruklardan Çıkar</option>
                <option value="replace">Kuyruk Temsilcilerini Sadece Seçilenlerle Değiştir</option>
              </select>

              {queueChanges.member_action !== UNCHANGED && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(metadata.users || []).map((u) => {
                    const extStr = String(u.extension || "");
                    if (!extStr) return null;
                    const checked = (queueChanges.member_extensions || []).includes(extStr);
                    return (
                      <label
                        key={u.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          checked
                            ? `${lightBg} ${border}`
                            : "bg-white dark:bg-slate-900 border-slate-200/70 dark:border-slate-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setQueueChanges({
                              ...queueChanges,
                              member_extensions: toggleIdInList(
                                queueChanges.member_extensions || [],
                                extStr
                              )
                            })
                          }
                          className="rounded"
                        />
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {u.full_name} ({extStr})
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module 4: Outbound Rules */}
      {activeModule === "outbound_rules" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ArrowUpRight size={15} className={text} />
            Giden Arama Kurallarında Dış Hat (Trunk), CallerID & PIN Politikası
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Birincil Dış Hat (SIP Trunk)
              </label>
              <select
                value={outboundRuleChanges.trunk_id}
                onChange={(e) =>
                  setOutboundRuleChanges({
                    ...outboundRuleChanges,
                    trunk_id: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                {(metadata.trunks || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.trunk_name} ({t.did_number || t.host})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kural Giden CallerID Numarası
              </label>
              <select
                value={outboundRuleChanges.caller_id_mode}
                onChange={(e) =>
                  setOutboundRuleChanges({
                    ...outboundRuleChanges,
                    caller_id_mode: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="set">Yeni CallerID Belirle</option>
                <option value="clear">CallerID'yi Temizle</option>
              </select>
              {outboundRuleChanges.caller_id_mode === "set" && (
                <input
                  type="text"
                  value={outboundRuleChanges.caller_id}
                  onChange={(e) =>
                    setOutboundRuleChanges({
                      ...outboundRuleChanges,
                      caller_id: e.target.value
                    })
                  }
                  placeholder="Örn: 908503607390"
                  className="w-full mt-2 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Giden Arama PIN (Şifre) Zorunluluğu
              </label>
              <select
                value={outboundRuleChanges.pin_mode}
                onChange={(e) =>
                  setOutboundRuleChanges({
                    ...outboundRuleChanges,
                    pin_mode: e.target.value
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value={UNCHANGED}>— Değiştirme —</option>
                <option value="none">Parola Yok (Serbest)</option>
                <option value="always">Her Zaman PIN Sor</option>
                <option value="outside_work_hours">Sadece Mesai Saatleri Dışında PIN Sor</option>
              </select>
              {["always", "outside_work_hours"].includes(
                outboundRuleChanges.pin_mode
              ) && (
                <input
                  type="text"
                  value={outboundRuleChanges.pin_code}
                  onChange={(e) =>
                    setOutboundRuleChanges({
                      ...outboundRuleChanges,
                      pin_code: e.target.value
                    })
                  }
                  placeholder="4-10 Haneli PIN Kodu (Örn: 1453)"
                  className="w-full mt-2 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`px-3 py-1 rounded-xl text-xs font-extrabold ${lightBg} ${text}`}>
            Hedef: {matchedTargets.length} Kayıt
          </span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Değiştirilecek Özellik Sayısı:{" "}
            <strong className="font-extrabold text-slate-900 dark:text-white">
              {changedFieldsCount}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={resetCurrentForm}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Seçimleri Sıfırla
          </button>
          {canWrite && (
            <button
              type="button"
              disabled={submitting || matchedTargets.length === 0 || changedFieldsCount === 0}
              onClick={() => setConfirmApplyOpen(true)}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white ${bg} ${hover} disabled:opacity-50 flex items-center gap-2 shadow-sm transition-all`}
            >
              <Check size={16} />
              <span>
                Toplu Değişiklikleri Uygula ({matchedTargets.length} Kayıt)
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal Before Bulk Apply */}
      {confirmApplyOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${lightBg} ${text}`}>
                <Sliders size={22} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Toplu Konfigürasyon Onayı
                </h4>
                <p className="text-xs text-slate-500">
                  İşlem öncesi otomatik geri alma yedeği (snapshot) alınacaktır.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs space-y-1.5">
              <div>
                <span className="font-bold text-slate-500">Etkilenecek Kayıt: </span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {matchedTargets.length} adet
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-500">Güncellenecek Alan Sayısı: </span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {changedFieldsCount} özellik
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmApplyOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleExecuteBulkApply}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white ${bg} ${hover}`}
              >
                {submitting ? "Uygulanıyor..." : "Onayla ve Şimdi Uygula"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Undo */}
      {confirmUndoOp && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                <RotateCcw size={22} />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Toplu İşlemi Geri Al (Undo)
                </h4>
                <p className="text-xs text-slate-500">
                  {confirmUndoOp.summary} ({confirmUndoOp.affected_count} kayıt) işleminden önceki yedek geri yüklenecektir.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmUndoOp(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => handleUndoOperation(confirmUndoOp.operation_id)}
                className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-500"
              >
                Evet, Eski Haline Döndür
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-100 dark:bg-slate-950 p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
          {contentBody}
        </div>
      </div>
    );
  }

  return contentBody;
}
