import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Send, ArrowRight } from "lucide-react";
import { SITE_CONFIG } from "../data/siteContent";

const DEPLOYMENT_OPTIONS = [
  { value: "cloud", label: "Nornia Bulut (Yönetilen)" },
  { value: "onprem", label: "Kurumsal On-Premise (Kendi Sunucumuz)" },
  { value: "hybrid", label: "Çok Şubeli / Henüz Karar Vermedik" },
];

const TEAM_SIZES = [
  { value: "1-20", label: "1 – 20 Kullanıcı" },
  { value: "21-50", label: "21 – 50 Kullanıcı" },
  { value: "51-150", label: "51 – 150 Kullanıcı" },
  { value: "151-500", label: "151 – 500 Kullanıcı" },
  { value: "500-1000", label: "500 – 1.000 Kullanıcı" },
  { value: "1000+", label: "1.000+ Kullanıcı / Operatör" },
];

export default function DemoRequestForm({
  preselectedDeployment = "cloud",
  preselectedPlan = "",
}) {
  const formRef = useRef(null);
  const announcerRef = useRef(null);

  const [deployment, setDeployment] = useState(preselectedDeployment);
  const [selectedPlanLabel, setSelectedPlanLabel] = useState(preselectedPlan);
  const [submitting, setSubmitting] = useState(false);
  const [submittedInfo, setSubmittedInfo] = useState(null);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (preselectedDeployment) {
      setDeployment(preselectedDeployment);
    }
  }, [preselectedDeployment]);

  useEffect(() => {
    if (preselectedPlan !== undefined) {
      setSelectedPlanLabel(preselectedPlan);
    }
  }, [preselectedPlan]);

  // Consistent ARIA sync + :user-invalid fallback (modern-web-guidance: validate-input-after-interaction)
  useEffect(() => {
    const form = formRef.current;
    if (!form || typeof window === "undefined") return;

    const supportsUserInvalid =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("selector(:user-invalid)");

    const dirtyState = new WeakMap();
    const flagged = new WeakSet();
    const announced = new WeakSet();
    let announceTimer = null;
    let announcedField = null;

    const linkError = (el, shown) => {
      const errorId = el.dataset?.error;
      if (!errorId) return;
      const ids = (el.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };

    const announceError = (el) => {
      const errorEl = el.dataset?.error ? document.getElementById(el.dataset.error) : null;
      const liveEl = announcerRef.current;
      if (!errorEl || !liveEl) return;
      const labelText = el.labels?.[0]?.textContent?.replace("*", "").trim() || "";
      const errText = errorEl.textContent?.replace(/\s+/g, " ").trim() || "";
      clearTimeout(announceTimer);
      liveEl.textContent = "";
      announcedField = el;
      announceTimer = setTimeout(() => {
        liveEl.textContent = labelText ? `${labelText}: ${errText}` : errText;
      }, 450);
    };

    const syncControl = (el, announce = false) => {
      if (!el?.matches?.("input, select, textarea") || el.type === "radio" || el.type === "hidden" || el.tabIndex === -1) {
        return;
      }

      let isInvalid = false;
      if (supportsUserInvalid) {
        isInvalid = el.matches(":user-invalid");
      } else {
        const st = dirtyState.get(el);
        if (st && st.hasInteracted && st.hasBlurred) {
          isInvalid = !el.validity.valid;
          el.classList.toggle("user-invalid-fallback", isInvalid);
          el.classList.toggle("user-valid-fallback", !isInvalid);
        }
      }

      if (isInvalid) {
        if (announce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute("aria-invalid", "true");
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute("aria-invalid") !== "true") {
        el.setAttribute("aria-invalid", "false");
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el && announcerRef.current) {
          clearTimeout(announceTimer);
          announcerRef.current.textContent = "";
        }
      }
    };

    // Start every control at aria-invalid="false" so Firefox/Safari never expose empty required fields as invalid on load
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (el.type !== "radio" && el.type !== "hidden" && el.tabIndex !== -1) {
        el.setAttribute("aria-invalid", "false");
      }
    });

    const onBlur = (e) => {
      const el = e.target;
      if (!el?.matches?.("input, select, textarea")) return;
      const st = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
      st.hasBlurred = true;
      dirtyState.set(el, st);
      syncControl(el, true);
    };

    const onInput = (e) => {
      const el = e.target;
      if (!el?.matches?.("input, select, textarea")) return;
      const st = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      dirtyState.set(el, st);
      if (el.hasAttribute("aria-invalid")) {
        syncControl(el, false);
      }
    };

    const onChange = (e) => {
      const el = e.target;
      if (!el?.matches?.("input, select, textarea")) return;
      const st = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
      st.hasInteracted = true;
      dirtyState.set(el, st);
      syncControl(el, true);
    };

    const onInvalid = (e) => {
      const el = e.target;
      dirtyState.set(el, { hasInteracted: true, hasBlurred: true });
      announced.add(el);
      syncControl(el, false);
    };

    form.addEventListener("blur", onBlur, true);
    form.addEventListener("input", onInput);
    form.addEventListener("change", onChange, true);
    form.addEventListener("invalid", onInvalid, true);

    return () => {
      clearTimeout(announceTimer);
      form.removeEventListener("blur", onBlur, true);
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("invalid", onInvalid, true);
    };
  }, [submittedInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = formRef.current;
    if (!form) return;

    setServerError("");
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(":invalid");
      if (firstInvalid && typeof firstInvalid.focus === "function") {
        firstInvalid.focus();
      }
      return;
    }

    const fd = new FormData(form);
    const rawNotes = String(fd.get("notes") || "").trim();
    const mergedNotes = selectedPlanLabel
      ? `[İlgilenilen Plan: ${selectedPlanLabel}]${rawNotes ? " " + rawNotes : ""}`
      : rawNotes;
    const payload = {
      full_name: String(fd.get("full_name") || "").trim(),
      company: String(fd.get("company") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      deployment: String(fd.get("deployment") || deployment),
      plan_interest: selectedPlanLabel || undefined,
      team_size: String(fd.get("team_size") || "21-50"),
      notes: mergedNotes,
      website_hp: String(fd.get("website_hp") || "").trim(),
      source: "www.nornia.com.tr",
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/public/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSubmittedInfo({
          name: payload.full_name,
          email: payload.email,
          mode: "api",
        });
      } else {
        throw new Error("API unavailable");
      }
    } catch {
      // Graceful fallback when viewing static preview or offline
      setSubmittedInfo({
        name: payload.full_name,
        email: payload.email,
        mode: "fallback",
        payload,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedInfo) {
    const mailBody = submittedInfo.payload
      ? encodeURIComponent(
          `Ad Soyad: ${submittedInfo.payload.full_name}\nKurum: ${submittedInfo.payload.company}\nE-posta: ${submittedInfo.payload.email}\nTelefon: ${submittedInfo.payload.phone}\nKurulum: ${submittedInfo.payload.deployment}\nKullanıcı Sayısı: ${submittedInfo.payload.team_size}\nNotlar: ${submittedInfo.payload.notes}`
        )
      : "";

    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Demo Talebiniz Alındı
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              Teşekkürler <strong>{submittedInfo.name}</strong>. Çözüm mühendisliği
              ekibimiz en kısa sürede <strong>{submittedInfo.email}</strong> adresi
              veya telefon numaranız üzerinden sizinle iletişime geçecektir.
            </p>
            {submittedInfo.mode === "fallback" && (
              <div className="mt-4 flex flex-wrap gap-2.5">
                <a
                  href={`mailto:${SITE_CONFIG.email}?subject=${encodeURIComponent(
                    "Nornia Canlı Demo & Teklif Talebi"
                  )}&body=${mailBody}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-950 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-900 transition"
                >
                  E-posta ile Hemen İlet
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <a
                  href={SITE_CONFIG.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition"
                >
                  WhatsApp&apos;tan Yaz
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSubmittedInfo(null)}
              className="mt-5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-4"
            >
              Yeni bir talep gönder
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card">
      <div ref={announcerRef} aria-live="polite" className="visually-hidden" />

      <form
        ref={formRef}
        action="/api/v1/public/demo-request"
        method="POST"
        noValidate
        onSubmit={handleSubmit}
        aria-labelledby="demo-form-heading"
        className="space-y-5"
      >
        <div>
          <h3 id="demo-form-heading" className="text-xl font-bold text-slate-900">
            Ücretsiz Canlı Demo &amp; Teklif Talep Edin
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            İhtiyacınıza özel canlı Nornia ortamı ve kapasite önerisi hazırlayalım.
          </p>
          {selectedPlanLabel && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
              <span>Seçilen Paket: {selectedPlanLabel}</span>
              <button
                type="button"
                onClick={() => setSelectedPlanLabel("")}
                aria-label="Seçilen paketi temizle"
                className="ml-1 text-indigo-500 hover:text-indigo-900"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Accessible spam honeypot hidden from keyboard and assistive technology */}
        <div className="visually-hidden" aria-hidden="true">
          <label htmlFor="website_hp">Web sitesi</label>
          <input
            type="text"
            id="website_hp"
            name="website_hp"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Full Name */}
          <div>
            <label
              htmlFor="demo-full-name"
              className="block text-sm font-semibold text-slate-800 mb-1"
            >
              Ad Soyad <span aria-hidden="true" className="text-rose-600">*</span>
            </label>
            <input
              id="demo-full-name"
              name="full_name"
              type="text"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              enterKeyHint="next"
              data-error="demo-full-name-error"
              className="nornia-field-control"
              placeholder="Örn. Ayşe Yılmaz"
            />
            <div id="demo-full-name-error" className="nornia-error-msg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Hata: Lütfen adınızı ve soyadınızı girin.</span>
            </div>
          </div>

          {/* Organization */}
          <div>
            <label
              htmlFor="demo-company"
              className="block text-sm font-semibold text-slate-800 mb-1"
            >
              Kurum / Şirket Adı <span aria-hidden="true" className="text-rose-600">*</span>
            </label>
            <input
              id="demo-company"
              name="company"
              type="text"
              required
              minLength={2}
              maxLength={120}
              autoComplete="organization"
              enterKeyHint="next"
              data-error="demo-company-error"
              className="nornia-field-control"
              placeholder="Örn. Anadolu Sağlık Grubu"
            />
            <div id="demo-company-error" className="nornia-error-msg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Hata: Lütfen şirket veya kurum adınızı girin.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Work Email */}
          <div>
            <label
              htmlFor="demo-email"
              className="block text-sm font-semibold text-slate-800 mb-0.5"
            >
              Kurumsal E-posta <span aria-hidden="true" className="text-rose-600">*</span>
            </label>
            <span id="demo-email-hint" className="block text-xs text-slate-500 mb-1.5">
              Biçim: ad.soyad@sirketiniz.com
            </span>
            <input
              id="demo-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              aria-describedby="demo-email-hint"
              data-error="demo-email-error"
              className="nornia-field-control"
              placeholder="ad.soyad@sirketiniz.com"
            />
            <div id="demo-email-error" className="nornia-error-msg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Hata: Geçerli bir e-posta adresi girin (ör. ad@sirket.com).</span>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="demo-phone"
              className="block text-sm font-semibold text-slate-800 mb-0.5"
            >
              Telefon Numarası <span aria-hidden="true" className="text-rose-600">*</span>
            </label>
            <span id="demo-phone-hint" className="block text-xs text-slate-500 mb-1.5">
              GSM veya şirket numaranız (ör. 05XX XXX XX XX)
            </span>
            <input
              id="demo-phone"
              name="phone"
              type="tel"
              required
              minLength={10}
              maxLength={24}
              autoComplete="tel"
              enterKeyHint="next"
              aria-describedby="demo-phone-hint"
              data-error="demo-phone-error"
              className="nornia-field-control"
              placeholder="05XX XXX XX XX"
            />
            <div id="demo-phone-error" className="nornia-error-msg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>Hata: Ulaşabileceğimiz geçerli bir telefon numarası girin.</span>
            </div>
          </div>
        </div>

        {/* Deployment Model: 3 mutually exclusive choices as visible radio buttons (forms guide matrix) */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-slate-800">
            Tercih Edilen Kurulum Modeli
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1">
            {DEPLOYMENT_OPTIONS.map((opt) => {
              const checked = deployment === opt.value;
              const optId = `deploy-${opt.value}`;
              return (
                <label
                  key={opt.value}
                  htmlFor={optId}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-xs font-semibold cursor-pointer transition min-h-[48px] ${
                    checked
                      ? "border-indigo-600 bg-indigo-50/70 text-indigo-950"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  <input
                    id={optId}
                    type="radio"
                    name="deployment"
                    value={opt.value}
                    checked={checked}
                    onChange={() => setDeployment(opt.value)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Team size select (6 options) */}
        <div>
          <label
            htmlFor="demo-team-size"
            className="block text-sm font-semibold text-slate-800 mb-1"
          >
            Tahmini Dahili / Kullanıcı Sayısı
          </label>
          <select
            id="demo-team-size"
            name="team_size"
            defaultValue="21-50"
            className="nornia-field-control"
          >
            {TEAM_SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Optional Notes */}
        <div>
          <label
            htmlFor="demo-notes"
            className="block text-sm font-semibold text-slate-800 mb-1"
          >
            Kısa İhtiyaç Özeti (Opsiyonel)
          </label>
          <textarea
            id="demo-notes"
            name="notes"
            rows={3}
            maxLength={1000}
            enterKeyHint="done"
            className="nornia-field-control"
            placeholder="Örn. 50 temsilci, WhatsApp + AI sesli randevu asistanı ve Yealink IP telefon kurulumu planlıyoruz."
          />
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {serverError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Bilgileriniz KVKK kapsamında yalnızca demo ve teklif iletişimi için kullanılır.
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-950 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 transition shrink-0 min-h-[48px]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            {submitting ? "Gönderiliyor..." : "Demo Talebi Gönder"}
          </button>
        </div>
      </form>
    </div>
  );
}
