import React, { useState } from "react";
import { Search, ChevronRight, ChevronLeft, ArrowUp, ArrowDown } from "lucide-react";

export default function TransferList({ items = [], selectedIds = [], onChange }) {
  // items: [{ id, extension, name, surname }, ...]

  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");

  const [checkedAvailable, setCheckedAvailable] = useState([]);
  const [checkedSelected, setCheckedSelected] = useState([]);

  // Separate items
  const availableItems = items.filter(item => !selectedIds.includes(item.id));
  const selectedItems = selectedIds
    .map(id => items.find(item => item.id === id))
    .filter(Boolean);

  // Filter by search
  const filteredAvailable = availableItems.filter(item => {
    const term = availableSearch.toLowerCase();
    const ext = item.extension || "";
    const name = `${item.name || ""} ${item.surname || ""}`.toLowerCase();
    return ext.includes(term) || name.includes(term);
  });

  const filteredSelected = selectedItems.filter(item => {
    const term = selectedSearch.toLowerCase();
    const ext = item.extension || "";
    const name = `${item.name || ""} ${item.surname || ""}`.toLowerCase();
    return ext.includes(term) || name.includes(term);
  });

  // Toggle checks
  const handleToggle = (id, isAvailable) => {
    if (isAvailable) {
      setCheckedAvailable(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      setCheckedSelected(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
  };

  const handleToggleAll = (isAvailable) => {
    if (isAvailable) {
      if (checkedAvailable.length === filteredAvailable.length && filteredAvailable.length > 0) {
        setCheckedAvailable([]);
      } else {
        setCheckedAvailable(filteredAvailable.map(i => i.id));
      }
    } else {
      if (checkedSelected.length === filteredSelected.length && filteredSelected.length > 0) {
        setCheckedSelected([]);
      } else {
        setCheckedSelected(filteredSelected.map(i => i.id));
      }
    }
  };

  // Move items
  const moveRight = () => {
    if (checkedAvailable.length === 0) return;
    onChange([...selectedIds, ...checkedAvailable]);
    setCheckedAvailable([]);
  };

  const moveLeft = () => {
    if (checkedSelected.length === 0) return;
    onChange(selectedIds.filter(id => !checkedSelected.includes(id)));
    setCheckedSelected([]);
  };

  // Reorder
  const moveUp = () => {
    if (checkedSelected.length === 0) return;
    const newSelected = [...selectedIds];
    let changed = false;
    for (let i = 1; i < newSelected.length; i++) {
      if (checkedSelected.includes(newSelected[i]) && !checkedSelected.includes(newSelected[i - 1])) {
        // Swap
        const temp = newSelected[i - 1];
        newSelected[i - 1] = newSelected[i];
        newSelected[i] = temp;
        changed = true;
      }
    }
    if (changed) onChange(newSelected);
  };

  const moveDown = () => {
    if (checkedSelected.length === 0) return;
    const newSelected = [...selectedIds];
    let changed = false;
    for (let i = newSelected.length - 2; i >= 0; i--) {
      if (checkedSelected.includes(newSelected[i]) && !checkedSelected.includes(newSelected[i + 1])) {
        // Swap
        const temp = newSelected[i + 1];
        newSelected[i + 1] = newSelected[i];
        newSelected[i] = temp;
        changed = true;
      }
    }
    if (changed) onChange(newSelected);
  };

  return (
    <div className="flex items-center gap-4 w-full h-[350px]">
      
      {/* LEFT PANEL */}
      <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col h-full shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={checkedAvailable.length > 0 && checkedAvailable.length === filteredAvailable.length}
              onChange={() => handleToggleAll(true)}
              className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 w-4 h-4"
            />
            {filteredAvailable.length} Öğe
          </label>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">MÜSAİT</span>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <input
              type="text"
              placeholder="Arama..."
              value={availableSearch}
              onChange={(e) => setAvailableSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500/25 transition-all text-slate-700 dark:text-slate-200"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* List Header */}
        <div className="grid grid-cols-[30px_1fr_2fr] gap-2 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div></div>
          <div>İç Hat No</div>
          <div>Görünen İsim</div>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          {filteredAvailable.map(item => (
            <label key={item.id} className="grid grid-cols-[30px_1fr_2fr] gap-2 px-3 py-2.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-50 dark:border-slate-800/30 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={checkedAvailable.includes(item.id)}
                onChange={() => handleToggle(item.id, true)}
                className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 w-4 h-4 justify-self-center cursor-pointer"
              />
              <div className="font-bold">{item.extension || "-"}</div>
              <div className="truncate">{item.name} {item.surname}</div>
            </label>
          ))}
          {filteredAvailable.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">Öğe bulunamadı.</div>
          )}
        </div>
      </div>

      {/* MIDDLE BUTTONS */}
      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={moveRight}
          disabled={checkedAvailable.length === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={moveLeft}
          disabled={checkedSelected.length === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 flex flex-col h-full shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={checkedSelected.length > 0 && checkedSelected.length === filteredSelected.length}
              onChange={() => handleToggleAll(false)}
              className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 w-4 h-4"
            />
            {filteredSelected.length} Öğe
          </label>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SEÇİLİ</span>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <input
              type="text"
              placeholder="Arama..."
              value={selectedSearch}
              onChange={(e) => setSelectedSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500/25 transition-all text-slate-700 dark:text-slate-200"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* List Header */}
        <div className="grid grid-cols-[30px_1fr_2fr] gap-2 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div></div>
          <div>İç Hat No</div>
          <div>Görünen İsim</div>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          {filteredSelected.map(item => (
            <label key={item.id} className="grid grid-cols-[30px_1fr_2fr] gap-2 px-3 py-2.5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer border-b border-slate-50 dark:border-slate-800/30 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={checkedSelected.includes(item.id)}
                onChange={() => handleToggle(item.id, false)}
                className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 w-4 h-4 justify-self-center cursor-pointer"
              />
              <div className="font-bold">{item.extension || "-"}</div>
              <div className="truncate">{item.name} {item.surname}</div>
            </label>
          ))}
          {filteredSelected.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-400">Öğe bulunamadı.</div>
          )}
        </div>
      </div>

      {/* REORDER BUTTONS */}
      <div className="flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={moveUp}
          disabled={checkedSelected.length === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          onClick={moveDown}
          disabled={checkedSelected.length === 0}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <ArrowDown size={16} />
        </button>
      </div>

    </div>
  );
}
