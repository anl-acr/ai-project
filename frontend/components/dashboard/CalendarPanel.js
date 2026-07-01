import React, { useState, useEffect } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Phone, 
  Mail, 
  Clock, 
  StickyNote, 
  PhoneCall,
  CheckCircle2
} from "lucide-react";

export default function CalendarPanel({ backendHost = "localhost:8000" }) {
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date()); // Represents currently viewed month
  const [selectedDate, setSelectedDate] = useState(new Date()); // Represents currently selected day
  const [isLoading, setIsLoading] = useState(true);

  // Fetch appointments on mount
  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = () => {
    setIsLoading(true);
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    fetch(`${protocol}//${backendHost}/api/appointments`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAppointments(data);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("[Calendar] Randevular alınamadı:", err);
        setIsLoading(false);
      });
  };

  // Helper logic to build monthly calendar grid
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // Day of week (0-6) of 1st day
    const totalDays = new Date(year, month + 1, 0).getDate(); // Total days in this month
    return { firstDay: firstDay === 0 ? 6 : firstDay - 1, totalDays }; // Shift so Monday is index 0
  };

  const { firstDay, totalDays } = getDaysInMonth(currentDate);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Helper to check if two dates are on the same day
  const isSameDay = (d1, d2) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Filter appointments for the selected day
  const selectedDayAppointments = appointments.filter((app) =>
    isSameDay(new Date(app.appointment_time), selectedDate)
  );

  // Get appointments count for a specific date cell
  const getAppointmentsForDay = (day) => {
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return appointments.filter((app) => isSameDay(new Date(app.appointment_time), checkDate));
  };

  // Render calendar header (Month Year)
  const monthNames = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
  ];

  const daysOfWeek = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

  // Generate date cells array
  const cells = [];
  // Empty slots for padding
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className="h-14 bg-slate-950/20 border border-slate-900/30"></div>);
  }
  // Days of month
  for (let day = 1; day <= totalDays; day++) {
    const dayDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const isSelected = isSameDay(dayDate, selectedDate);
    const dayApps = getAppointmentsForDay(day);
    const isToday = isSameDay(dayDate, new Date());

    cells.push(
      <button
        key={`day-${day}`}
        onClick={() => setSelectedDate(dayDate)}
        className={`h-14 border border-slate-850 p-1.5 flex flex-col justify-between items-start transition relative group ${
          isSelected 
            ? "bg-purple-600/10 border-purple-500/60 z-10" 
            : isToday
            ? "bg-slate-850/80 border-slate-700"
            : "hover:bg-slate-850/40 bg-slate-900/50"
        }`}
      >
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
          isToday ? "bg-purple-600 text-white" : isSelected ? "text-purple-400" : "text-slate-400"
        }`}>
          {day}
        </span>
        
        {/* Indicators for appointments */}
        {dayApps.length > 0 && (
          <div className="flex gap-1 w-full justify-end items-center mt-1">
            <span className="text-[9px] font-bold text-purple-400 px-1 py-0.2 bg-purple-500/10 rounded-md border border-purple-900/20">
              {dayApps.length} Rnd
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse shrink-0"></span>
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="w-full max-w-6xl h-[calc(100vh-12rem)] flex gap-6">
      {/* Left Side: Calendar Grid */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col overflow-hidden shadow-lg">
        {/* Month Selector Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
              <CalendarIcon className="text-purple-400" size={18} />
              Randevu Takvimi
            </h3>
            <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchAppointments}
              className="text-xs bg-slate-950 border border-slate-800 hover:bg-slate-850 text-slate-400 px-3 py-1.5 rounded-xl transition"
            >
              Yenile
            </button>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
              <button 
                onClick={prevMonth}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-850 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={nextMonth}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-850 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 text-center gap-1 mb-1.5">
          {daysOfWeek.map((day) => (
            <div key={day} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider py-1.5 bg-slate-950/40 rounded-lg">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days cells grid */}
        <div className="grid grid-cols-7 gap-1 flex-1 overflow-y-auto min-h-0 bg-slate-950/20 p-1 rounded-xl border border-slate-850">
          {cells}
        </div>
      </div>

      {/* Right Side: Appointment Details */}
      <div className="w-80 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-lg">
        {/* Selected Day Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col gap-1">
          <h4 className="font-bold text-xs tracking-wider text-slate-400 uppercase">
            Randevu Listesi
          </h4>
          <p className="text-xs font-semibold text-purple-400">
            {selectedDate.toLocaleDateString("tr-TR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              weekday: "long"
            })}
          </p>
        </div>

        {/* Appointment cards list scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-10 text-xs text-slate-500 animate-pulse">
              Randevular yükleniyor...
            </div>
          ) : selectedDayAppointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
              <CheckCircle2 size={32} className="text-slate-700 mb-2" />
              <p className="text-xs font-medium">Randevu Bulunmuyor</p>
              <p className="text-[10px] text-slate-600 mt-1">Bu tarih için planlanmış bir randevu bulunmamaktadır.</p>
            </div>
          ) : (
            selectedDayAppointments.map((app) => (
              <div 
                key={app.id} 
                className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-3 hover:border-purple-800/40 transition shadow-inner"
              >
                {/* Time & Status header */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold">
                    <Clock size={12} />
                    <span>{new Date(app.appointment_time).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}</span>
                  </div>
                  <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Onaylandı
                  </span>
                </div>

                {/* Customer info fields */}
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-500" />
                    <span className="font-semibold text-slate-200">{app.customer_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-slate-500" />
                    <span>{app.customer_phone}</span>
                  </div>
                  {app.customer_email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={12} className="text-slate-500" />
                      <span className="truncate">{app.customer_email}</span>
                    </div>
                  )}
                  {app.notes && (
                    <div className="flex items-start gap-2 p-2 bg-slate-900/50 rounded-xl border border-slate-850 text-[11px] text-slate-400">
                      <StickyNote size={12} className="text-slate-500 mt-0.5 shrink-0" />
                      <p className="leading-normal">{app.notes}</p>
                    </div>
                  )}
                </div>

                {/* Related Call link */}
                {app.call_id && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px]">
                    <span className="text-slate-500 font-mono">Görüşme: {app.call_id.slice(0, 8)}...</span>
                    <div className="flex items-center gap-1 text-purple-400 font-semibold hover:text-purple-300 transition">
                      <PhoneCall size={10} />
                      <span>Çağrı Raporu</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
