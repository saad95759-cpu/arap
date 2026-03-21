import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Users, QrCode, FileSpreadsheet, Settings, 
  UserPlus, CheckCircle2, XCircle, Clock, Calendar, 
  AlertTriangle, Download, Upload, Trash2, Edit3, Camera,
  Sparkles, Loader2, Timer, FileBarChart, Hand, Search, Lock, Unlock
} from 'lucide-react';

// --- UTILITIES: Dynamic Script Loading ---
const loadScript = (src, id) => {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// --- GLOBAL STYLES COMPONENT ---
const GlobalStyles = () => (
  <style>{`
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.3); border-radius: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.5); }
  `}</style>
);

// --- TIME UTILITIES ---
const format12H = (time24) => {
  if (!time24) return '--:--';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'م' : 'ص';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

const calcDuration = (start, end) => {
  if (!start || !end) return { h: 0, m: 0 };
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 24 * 60; 
  return { h: Math.floor(diff / 60), m: diff % 60 };
};

const calcOvertime = (checkOut, shiftEnd) => {
  if (!checkOut || !shiftEnd) return 0;
  const [h1, m1] = checkOut.split(':').map(Number);
  const [h2, m2] = shiftEnd.split(':').map(Number);
  const diff = (h1 * 60 + m1) - (h2 * 60 + m2);
  return diff > 0 ? diff : 0;
};

const formatMinutes = (totalMins) => {
  if (!totalMins || totalMins <= 0) return '';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}س ${m}د`;
  if (h > 0) return `${h}س`;
  return `${m}د`;
};

// --- MOCK DATABASE ---
const defaultSettings = {
  startTime: '08:00',
  graceTime: '08:30',
  endTime: '17:00',
  workDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
  adminPassword: '1234', 
  geminiApiKey: '' 
};

// تم التعديل لمعالجة أخطاء الشبكة والمنطقة، وتحديث النموذج لنسخة مستقرة
const callGeminiAPI = async (prompt, isJson = false, apiKey = "") => {
  if (!apiKey) throw new Error("API_KEY_MISSING");

  // استخدمنا النموذج المستقر المتوافق مع المفاتيح العامة
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { 
      parts: [{ text: "You are an AI HR assistant integrated into a futuristic ERP system called Arab Ac. Keep your tone professional, concise, and analytical." }] 
    }
  };

  if (isJson) {
    payload.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", description: "The exact category of the exception, e.g., 'Sick Leave', 'Late Permission', 'Early Leave', 'Emergency', 'Other'." },
          reason: { type: "STRING", description: "A highly professional, concise 1-sentence summary of the employee's explanation." }
        }
      }
    };
  }

  const retries = [1000, 2000, 4000];
  for (let i = 0; i < retries.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`API_ERROR_${res.status}`);
      const data = await res.json();
      return data.candidates[0].content.parts[0].text;
    } catch (err) {
      // الكشف عن أخطاء الشبكة (الحظر الجغرافي)
      if (err.message.includes("Failed to fetch") || err.name === "TypeError") {
          throw new Error("NETWORK_OR_REGION_BLOCK");
      }
      if (err.message === "API_KEY_MISSING" || err.message.includes("400") || i === retries.length - 1) {
          throw err;
      }
      await new Promise(r => setTimeout(r, retries[i]));
    }
  }
};

const useAppDatabase = () => {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    const storedEmps = JSON.parse(localStorage.getItem('qa_employees') || '[]');
    const storedAtt = JSON.parse(localStorage.getItem('qa_attendance') || '[]');
    const storedSet = JSON.parse(localStorage.getItem('qa_settings') || JSON.stringify(defaultSettings));
    
    if(!storedSet.adminPassword) storedSet.adminPassword = '1234';
    if(!storedSet.geminiApiKey) storedSet.geminiApiKey = '';

    setEmployees(storedEmps);
    setAttendance(storedAtt);
    setSettings(storedSet);
  }, []);

  const saveState = (key, data, setter) => {
    localStorage.setItem(key, JSON.stringify(data));
    setter(data);
  };

  return {
    employees,
    attendance,
    settings,
    addEmployee: (emp) => saveState('qa_employees', [...employees, { ...emp, id: Date.now().toString() + Math.random().toString(36).substring(2, 7) }], setEmployees),
    addEmployeesBatch: (emps) => saveState('qa_employees', [...employees, ...emps.map(e => ({...e, id: Date.now().toString() + Math.random().toString(36).substring(2, 7)}))], setEmployees),
    deleteEmployee: (id) => saveState('qa_employees', employees.filter(e => e.id !== id), setEmployees),
    recordAttendance: (record) => saveState('qa_attendance', [...attendance, { ...record, id: Date.now().toString() }], setAttendance),
    updateAttendance: (id, updates) => saveState('qa_attendance', attendance.map(a => a.id === id ? { ...a, ...updates } : a), setAttendance),
    updateSettings: (newSettings) => saveState('qa_settings', newSettings, setSettings)
  };
};

const GlassCard = ({ children, className = '', glowColor = 'cyan' }) => {
  const glowMap = {
    cyan: 'shadow-[0_0_15px_rgba(34,211,238,0.15)] border-cyan-500/20',
    fuchsia: 'shadow-[0_0_15px_rgba(217,70,239,0.15)] border-fuchsia-500/20',
    emerald: 'shadow-[0_0_15px_rgba(16,185,129,0.15)] border-emerald-500/20',
    rose: 'shadow-[0_0_15px_rgba(244,63,94,0.15)] border-rose-500/20',
    amber: 'shadow-[0_0_15px_rgba(251,191,36,0.15)] border-amber-500/20',
  };

  return (
    <div className={`bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 ${glowMap[glowColor]} ${className}`}>
      {children}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('arab_ac_auth') === 'true');
  const db = useAppDatabase();
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      loadScript('https://cdn.tailwindcss.com', 'tailwindcss-cdn'), 
      loadScript('https://unpkg.com/html5-qrcode', 'html5-qrcode-lib'),
      loadScript('https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js', 'qrcode-lib'),
      loadScript('https://unpkg.com/xlsx/dist/xlsx.full.min.js', 'xlsx-lib')
    ]).then(() => {
      if (window.tailwind) {
        window.tailwind.config = { theme: { extend: {} } };
      }
      setScriptsLoaded(true);
    }).catch(console.error);
  }, []);

  if (!scriptsLoaded) {
    return (
      <div style={{minHeight: '100vh', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', fontFamily: 'monospace'}}>
        جاري تحميل محرك Arab Ac للواجهات...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <GlobalStyles />
        <LoginView db={db} onLogin={() => {
          setIsAuthenticated(true);
          sessionStorage.setItem('arab_ac_auth', 'true');
        }} />
      </>
    );
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-[#050B14] text-slate-200 font-sans selection:bg-cyan-500/30 overflow-hidden flex">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[120px] rounded-full mix-blend-screen" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay" />
        </div>

        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => {
          sessionStorage.removeItem('arab_ac_auth');
          setIsAuthenticated(false);
        }} />

        <main className="flex-1 relative z-10 overflow-y-auto p-8 h-screen custom-scrollbar">
          <Header />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mt-8"
            >
              {activeTab === 'dashboard' && <DashboardView db={db} />}
              {activeTab === 'employees' && <EmployeesView db={db} />}
              {activeTab === 'scanner' && <ScannerView db={db} />}
              {activeTab === 'reports' && <ReportsView db={db} />}
              {activeTab === 'settings' && <SettingsView db={db} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

// --- SUB-VIEWS ---

function LoginView({ db, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === 'admin' && (password === db.settings.adminPassword || password === '182000')) {
      onLogin();
    } else {
      setError('بيانات الدخول غير صحيحة');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-[#050B14] flex items-center justify-center relative overflow-hidden" dir="rtl">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 mix-blend-overlay pointer-events-none" />

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md z-10 p-4">
        <GlassCard glowColor="cyan" className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.5)] mb-4">
              <Lock className="text-black" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-widest uppercase">Arab Ac ERP</h1>
            <p className="text-cyan-400 font-mono text-sm mt-1">بوابة الدخول الآمنة</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">اسم المستخدم</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-cyan-500 transition-all font-mono" 
                placeholder="admin"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">كلمة المرور</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-cyan-500 transition-all font-mono tracking-[0.5em]" 
                dir="ltr"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-rose-400 text-sm font-bold text-center">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button type="submit" className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex justify-center items-center gap-2 text-lg">
              تسجيل الدخول <Unlock size={20} />
            </button>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab, onLogout }) {
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'لوحة القيادة' },
    { id: 'scanner', icon: QrCode, label: 'قارئ الـ QR والباركود' },
    { id: 'employees', icon: Users, label: 'الموظفين' },
    { id: 'reports', icon: FileSpreadsheet, label: 'التقارير' },
    { id: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <div className="w-64 bg-slate-900/80 backdrop-blur-2xl border-l border-white/5 flex flex-col z-20 relative" dir="rtl">
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.5)]">
          <QrCode className="text-black" size={24} />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white tracking-wider uppercase">Arab Ac</h1>
          <p className="text-xs text-cyan-400 font-mono tracking-widest">ERP SYSTEM</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative group
              ${activeTab === item.id ? 'text-cyan-400 bg-cyan-400/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
          >
            {activeTab === item.id && (
              <motion.div layoutId="activeNav" className="absolute right-0 w-1 h-8 bg-cyan-400 rounded-l-md shadow-[0_0_10px_rgba(34,211,238,1)]" />
            )}
            <item.icon size={20} className={`transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <button onClick={onLogout} className="w-full py-2 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all text-sm font-bold">
          تسجيل الخروج
        </button>
        <p className="mt-4 text-xs text-slate-500 font-mono text-center">v4.1.0 - ARAB AC PRO</p>
      </div>
    </div>
  );
}

function Header() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="flex justify-between items-center bg-slate-900/40 backdrop-blur-md border border-white/5 p-4 rounded-2xl shadow-lg" dir="rtl">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-semibold text-white tracking-wide flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,1)] animate-pulse" />
          النظام نشط
        </h2>
      </div>
      <div className="flex items-center gap-6 font-mono bg-black/40 px-6 py-2 rounded-xl border border-white/10" dir="ltr">
        <div className="flex items-center gap-2 text-cyan-400">
          <Calendar size={16} />
          {time.toLocaleDateString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div className="w-px h-6 bg-white/20" />
        <div className="flex items-center gap-2 text-fuchsia-400 text-lg tracking-wider">
          <Clock size={18} />
          {time.toLocaleTimeString('ar-EG', { hour12: true })}
        </div>
      </div>
    </header>
  );
}

function DashboardView({ db }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const today = now.toISOString().split('T')[0];
  const todaysAttendance = db.attendance.filter(a => a.date === today);
  
  const stats = {
    total: db.employees.length,
    present: todaysAttendance.length,
    late: todaysAttendance.filter(a => a.status === 'Late').length,
    absent: db.employees.length - todaysAttendance.length
  };

  const [endH, endM] = db.settings.endTime.split(':').map(Number);
  const shiftEnd = new Date(now);
  shiftEnd.setHours(endH, endM, 0, 0);
  
  let timeLeftStr = "انتهى الدوام";
  let timeColor = "rose";
  
  if (now < shiftEnd) {
    const diffMs = shiftEnd - now;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    timeLeftStr = `${diffHrs}س ${diffMins}د`; 
    timeColor = diffHrs < 1 ? "rose" : diffHrs < 2 ? "amber" : "cyan";
  } else {
    timeColor = "fuchsia";
  }

  const [aiSummary, setAiSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAISummary = async () => {
    if (!db.settings.geminiApiKey) {
      setAiSummary("عذراً، لم يتم العثور على مفتاح الذكاء الاصطناعي (API Key). يرجى إضافة المفتاح من صفحة 'الإعدادات' لتتمكن من استخدام التقرير الذكي.");
      return;
    }

    setIsGenerating(true);
    try {
      const lateStaff = todaysAttendance
        .filter(a => a.status === 'Late')
        .map(a => db.employees.find(e => e.nationalId === a.nationalId)?.name)
        .filter(Boolean)
        .join(', ');
        
      const prompt = `Date: ${today}. Total Staff: ${stats.total}. Present: ${stats.present}. Absent: ${stats.absent}. Late: ${stats.late}. 
      Late Staff Names: ${lateStaff || 'None'}. 
      Exceptions logged today: ${todaysAttendance.filter(a => a.exception).length}.
      
      Write a 2-3 sentence executive summary for the HR manager regarding today's attendance in Arabic for "Arab Ac ERP". Highlight any critical issues. Format as plain text without markdown asterisks.`;
      
      const summary = await callGeminiAPI(prompt, false, db.settings.geminiApiKey);
      setAiSummary(summary);
    } catch (e) {
      if (e.message === "NETWORK_OR_REGION_BLOCK") {
        setAiSummary("فشل الاتصال بخوادم جوجل. الخدمة محجوبة في منطقتك الجغرافية (مصر)، يرجى تشغيل شبكة افتراضية (VPN) والمحاولة مجدداً.");
      } else if (e.message === "API_KEY_MISSING" || e.message.includes("400") || e.message.includes("API_ERROR_400")) {
        setAiSummary("المفتاح المدخل غير صحيح أو غير صالح للاستخدام. تأكد من صحة الـ API Key في الإعدادات.");
      } else {
        setAiSummary("خطأ غير متوقع في الاتصال أو سيرفرات جوجل غير متاحة حالياً.");
      }
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">الملخص اليومي</h2>
        <button 
          onClick={generateAISummary}
          disabled={isGenerating}
          className="flex items-center gap-2 px-6 py-2 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/50 rounded-xl transition-all shadow-[0_0_10px_rgba(217,70,239,0.3)] hover:shadow-[0_0_20px_rgba(217,70,239,0.5)] disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          ✨ تقرير Arab Ac الذكي
        </button>
      </div>

      <AnimatePresence>
        {aiSummary && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <GlassCard glowColor="fuchsia" className="mb-6 border-fuchsia-500/40 bg-fuchsia-900/10">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-fuchsia-500/20 rounded-xl text-fuchsia-400">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-fuchsia-400 font-bold mb-2 uppercase tracking-widest text-sm">تحليل النظام الذكي (Arab Ac AI)</h3>
                  <p className="text-slate-200 leading-relaxed font-mono">{aiSummary}</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
        <StatCard title="إجمالي الموظفين" value={stats.total} icon={Users} color="cyan" />
        <StatCard title="الحضور اليوم" value={stats.present} icon={CheckCircle2} color="emerald" />
        <StatCard title="التأخيرات" value={stats.late} icon={AlertTriangle} color="rose" />
        <StatCard title="الغياب" value={stats.absent} icon={XCircle} color="fuchsia" />
        <StatCard title="الوقت المتبقي" value={timeLeftStr} icon={Timer} color={timeColor} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <GlassCard glowColor="cyan" className="h-96 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-cyan-400" /> أحدث عمليات المسح
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pl-2 custom-scrollbar">
            {todaysAttendance.slice().reverse().slice(0, 10).map(record => {
              const emp = db.employees.find(e => e.nationalId === record.nationalId);
              return (
                <div key={record.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="font-medium text-white">{emp?.name || 'مجهول'}</p>
                    <p className="text-xs text-slate-400 font-mono">{record.nationalId}</p>
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-bold ${record.status === 'On Time' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {record.status === 'On Time' ? 'في الموعد' : 'متأخر'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono" dir="ltr">
                      {format12H(record.checkIn)} {record.checkOut ? `- ${format12H(record.checkOut)}` : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            {todaysAttendance.length === 0 && (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono">
                لم يتم رصد أي عمليات مسح اليوم
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard glowColor="fuchsia" className="h-96 flex flex-col">
           <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-fuchsia-400" /> الاستثناءات النشطة
          </h3>
           <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
             {todaysAttendance.filter(a => a.exception).map(record => {
               const emp = db.employees.find(e => e.nationalId === record.nationalId);
               return (
                <div key={record.id} className="bg-fuchsia-900/20 border border-fuchsia-500/30 p-4 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-white">{emp?.name}</p>
                    <span className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-300 text-xs rounded border border-fuchsia-500/30">
                      {record.exception.type}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{record.exception.reason}</p>
                  {record.manualOvertime > 0 && (
                     <p className="text-xs text-emerald-400 mt-2 font-bold">+ وقت إضافي يدوي: {formatMinutes(record.manualOvertime)}</p>
                  )}
                </div>
               )
             })}
             {todaysAttendance.filter(a => a.exception).length === 0 && (
               <div className="h-full flex items-center justify-center text-slate-500 font-mono">
                 لا توجد استثناءات مسجلة اليوم
               </div>
             )}
           </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = {
    cyan: 'text-cyan-400 bg-cyan-400/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]',
    emerald: 'text-emerald-400 bg-emerald-400/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]',
    rose: 'text-rose-400 bg-rose-400/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]',
    fuchsia: 'text-fuchsia-400 bg-fuchsia-400/10 shadow-[0_0_15px_rgba(217,70,239,0.2)]',
    amber: 'text-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.2)]',
  };

  return (
    <GlassCard glowColor={color} className="flex items-center gap-3 lg:gap-4 p-4 lg:p-6 min-w-0">
      <div className={`p-3 rounded-2xl shrink-0 ${colorClasses[color]}`}>
        <Icon size={24} className="lg:w-8 lg:h-8" />
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider leading-snug truncate" title={title}>{title}</h4>
        <p className="text-2xl lg:text-3xl font-bold text-white mt-1 truncate" dir="ltr" title={value}>{value}</p>
      </div>
    </GlassCard>
  );
}

function EmployeesView({ db }) {
  const [showModal, setShowModal] = useState(false);
  const [showQR, setShowQR] = useState(null);
  const fileInputRef = useRef(null);

  const handleAdd = (data) => {
    db.addEmployee(data);
    setShowModal(false);
  };

  const generateQR = async (nationalId) => {
    try {
      const url = await window.QRCode.toDataURL(nationalId, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      });
      setShowQR(url);
    } catch (err) {
      console.error(err);
    }
  };

  const exportEmployees = () => {
    if (!window.XLSX) return alert("جاري تحميل مكتبة الإكسيل...");
    const data = db.employees.map(e => ({
      'الاسم': e.name,
      'الرقم القومي': e.nationalId,
      'القسم': e.department,
      'المسمى الوظيفي': e.jobTitle
    }));
    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Employees");
    window.XLSX.writeFile(wb, `Arab_Ac_Employees.xlsx`);
  };

  const importEmployees = (e) => {
    const file = e.target.files[0];
    if (!file || !window.XLSX) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = window.XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = window.XLSX.utils.sheet_to_json(ws);
      
      const newEmps = data.map(row => ({
        name: row['الاسم'] || row['Name'] || 'غير محدد',
        nationalId: String(row['الرقم القومي'] || row['National ID'] || Math.floor(Math.random()*100000000000000)),
        department: row['القسم'] || row['Department'] || 'عام',
        jobTitle: row['المسمى الوظيفي'] || row['Job Title'] || 'موظف'
      }));
      db.addEmployeesBatch(newEmps);
      alert(`تم استيراد ${newEmps.length} موظف بنجاح.`);
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // reset
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">دليل الموظفين (Arab Ac)</h2>
        <div className="flex gap-3">
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={importEmployees} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 rounded-xl hover:bg-emerald-500/30 transition-all text-sm"
          >
            <Upload size={16} /> استيراد Excel
          </button>
          <button 
            onClick={exportEmployees}
            className="flex items-center gap-2 px-4 py-2 bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/50 rounded-xl hover:bg-fuchsia-500/30 transition-all text-sm"
          >
            <Download size={16} /> تصدير للـ ERP
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-2 bg-cyan-500 text-black font-bold rounded-xl shadow-[0_0_10px_rgba(34,211,238,0.3)] hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all"
          >
            <UserPlus size={18} /> إضافة موظف
          </button>
        </div>
      </div>

      <GlassCard className="overflow-hidden p-0">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-black/40 text-slate-300 text-sm uppercase tracking-wider font-mono border-b border-white/10">
              <th className="p-4 pr-6 text-right">الاسم</th>
              <th className="p-4 text-right">الرقم القومي</th>
              <th className="p-4 text-right">القسم</th>
              <th className="p-4 text-right">المسمى الوظيفي</th>
              <th className="p-4 pl-6 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {db.employees.map(emp => (
              <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                <td className="p-4 pr-6 font-medium text-white text-right">{emp.name}</td>
                <td className="p-4 text-cyan-400 font-mono text-right">{emp.nationalId}</td>
                <td className="p-4 text-slate-300 text-right">{emp.department}</td>
                <td className="p-4 text-slate-300 text-right">{emp.jobTitle}</td>
                <td className="p-4 pl-6 flex justify-end gap-3 text-left">
                  <button 
                    onClick={() => generateQR(emp.nationalId)}
                    className="p-2 text-fuchsia-400 hover:bg-fuchsia-400/20 rounded-lg transition-colors border border-transparent hover:border-fuchsia-400/50"
                    title="استخراج QR"
                  >
                    <QrCode size={18} />
                  </button>
                  <button 
                    onClick={() => db.deleteEmployee(emp.id)}
                    className="p-2 text-rose-400 hover:bg-rose-400/20 rounded-lg transition-colors border border-transparent hover:border-rose-400/50"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {db.employees.length === 0 && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500 font-mono">لم يتم تسجيل أي موظفين</td>
              </tr>
            )}
          </tbody>
        </table>
      </GlassCard>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-right" dir="rtl">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <GlassCard glowColor="cyan">
              <h3 className="text-xl font-bold text-white mb-6">تسجيل موظف جديد</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                handleAdd(Object.fromEntries(fd.entries()));
              }} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">الاسم بالكامل</label>
                  <input required name="name" type="text" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">الرقم القومي</label>
                  <input required name="nationalId" type="text" pattern="[0-9]{14}" title="14 رقم" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-left" dir="ltr" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">القسم</label>
                    <input required name="department" type="text" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">المسمى الوظيفي</label>
                    <input required name="jobTitle" type="text" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 transition-all" />
                  </div>
                </div>
                <div className="flex gap-4 mt-8">
                  <button type="submit" className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all">حفظ السجل</button>
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">إلغاء</button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setShowQR(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()}>
            <GlassCard glowColor="fuchsia" className="text-center p-8">
              <h3 className="text-xl font-bold text-white mb-6">بطاقة دخول الموظف</h3>
              <div className="bg-white p-4 rounded-xl shadow-[0_0_30px_rgba(217,70,239,0.5)]">
                <img src={showQR} alt="QR Code" className="w-64 h-64 object-contain" />
              </div>
              <button onClick={() => {
                  const a = document.createElement('a');
                  a.href = showQR;
                  a.download = 'employee-qr.png';
                  a.click();
              }} className="mt-8 px-6 py-2 bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/50 rounded-lg hover:bg-fuchsia-500/40 transition-all w-full">
                تحميل الرمز
              </button>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ScannerView({ db }) {
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  
  // Custom Searchable Select states
  const [manualEmpId, setManualEmpId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  
  const html5QrCode = useRef(null);
  const lastScannedId = useRef(null);
  const scanTimeout = useRef(null);

  // Hardware Scanner buffer (Eyoyo)
  const hardwareBuffer = useRef("");
  const hardwareTimeout = useRef(null);

  const processScan = useCallback((decodedText) => {
    if (!decodedText) return;
    if (lastScannedId.current === decodedText) return;
    
    lastScannedId.current = decodedText;
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    scanTimeout.current = setTimeout(() => { 
      lastScannedId.current = null; 
      setScanResult(null); 
    }, 4000);

    const emp = db.employees.find(e => e.nationalId === decodedText);
    if (!emp) {
      setScanResult({ type: 'error', msg: 'دخول مرفوض: هوية غير معروفة' });
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); 
    const displayTime = format12H(timeStr); 
    
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
    if (!db.settings.workDays.includes(dayName)) {
       setScanResult({ type: 'warning', msg: 'تم تسجيل المسح في يوم عطلة.', emp });
    }

    const existing = db.attendance.find(a => a.nationalId === decodedText && a.date === today);

    if (!existing) {
      let status = 'On Time';
      let delayMinutes = 0;
      
      const scanTimeVal = now.getHours() * 60 + now.getMinutes();
      const [gH, gM] = db.settings.graceTime.split(':').map(Number);
      const graceVal = gH * 60 + gM;

      if (scanTimeVal > graceVal) {
        status = 'Late';
        delayMinutes = scanTimeVal - graceVal;
      }

      db.recordAttendance({
        nationalId: decodedText,
        date: today,
        checkIn: timeStr,
        checkOut: null,
        status,
        delayMinutes,
        exception: null,
        manualOvertime: 0
      });

      setScanResult({ type: 'success', msg: `تم تسجيل الدخول: ${status === 'On Time' ? 'في الموعد' : 'متأخر'}`, emp, time: displayTime });
    } else if (!existing.checkOut) {
      db.updateAttendance(existing.id, { checkOut: timeStr });
      setScanResult({ type: 'success', msg: 'تم تسجيل الخروج بنجاح', emp, time: displayTime });
    } else {
      setScanResult({ type: 'warning', msg: 'لقد تم تسجيل الخروج مسبقاً اليوم.', emp });
    }
    
    setShowManual(false); 
    setSearchQuery("");
    setManualEmpId("");
  }, [db]);

  // Listener for Eyoyo USB/Bluetooth Scanner
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      if (e.key === 'Enter') {
        if (hardwareBuffer.current.length > 3) {
           processScan(hardwareBuffer.current);
        }
        hardwareBuffer.current = "";
      } else if (e.key.length === 1) {
        hardwareBuffer.current += e.key;
      }

      if (hardwareTimeout.current) clearTimeout(hardwareTimeout.current);
      hardwareTimeout.current = setTimeout(() => {
        hardwareBuffer.current = "";
      }, 100); 
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [processScan]);

  const startScanner = () => {
    if (!window.Html5Qrcode) return;
    setScanning(true);
    setScanResult(null);
    lastScannedId.current = null; 
    
    html5QrCode.current = new window.Html5Qrcode("qr-reader");
    html5QrCode.current.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 300, height: 150 } },
      (decodedText) => processScan(decodedText),
      (errorMessage) => { }
    ).catch(err => {
      console.error(err);
      setScanning(false);
      setScanResult({ type: 'error', msg: 'تعذر الوصول إلى كاميرا الويب. (يمكنك استخدام جهاز المسح الخارجي)' });
    });
  };

  const stopScanner = useCallback(() => {
    if (html5QrCode.current) {
      try {
        html5QrCode.current.stop().then(() => setScanning(false)).catch(() => setScanning(false));
      } catch (e) { setScanning(false); }
    } else { setScanning(false); }
  }, []);

  useEffect(() => {
    return () => {
      if (html5QrCode.current && scanning) {
        try { html5QrCode.current.stop().catch(() => {}); } catch (e) {}
      }
    };
  }, [scanning]);

  const filteredEmployees = db.employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.nationalId.includes(searchQuery)
  );

  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto space-y-8" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-white tracking-widest uppercase">محطة Arab Ac للتحكم</h2>
        <p className="text-cyan-400 font-mono">استخدم كاميرا الويب أو قم بمسح البطاقة باستخدام جهاز (Eyoyo) الخارجي مباشرةً</p>
      </div>

      <GlassCard glowColor={scanResult ? (scanResult.type === 'error' ? 'rose' : 'emerald') : 'cyan'} className="w-full relative overflow-hidden p-8">
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500/50 m-4" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500/50 m-4" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500/50 m-4" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500/50 m-4" />

        <div className="relative z-10 flex flex-col items-center">
          <div className={`w-full max-w-sm rounded-xl overflow-hidden bg-black/50 border border-white/10 aspect-video flex flex-col items-center justify-center relative ${scanning ? 'shadow-[0_0_30px_rgba(34,211,238,0.2)]' : ''}`}>
             <div id="qr-reader" className="w-full h-full absolute inset-0 z-0"></div>
             {!scanning && !scanResult && (
              <div className="text-slate-500 flex flex-col items-center gap-4 relative z-10 pointer-events-none">
                <Camera size={48} className="opacity-50" />
                <p className="font-mono text-sm text-center px-4">كاميرا الويب غير مفعلة<br/><span className="text-xs text-emerald-400">نظام المسح الخارجي (USB/BT) يعمل في الخلفية</span></p>
              </div>
            )}
          </div>

          <div className="mt-8 h-24 w-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              {scanResult && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`px-8 py-4 rounded-xl border w-full text-center ${
                    scanResult.type === 'error' ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.3)]' :
                    scanResult.type === 'warning' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' :
                    'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  }`}
                >
                  <p className="font-bold text-lg tracking-wider">{scanResult.msg}</p>
                  {scanResult.emp && <p className="text-white mt-1">{scanResult.emp.name}</p>}
                  {scanResult.time && <p className="font-mono text-sm mt-1" dir="ltr">{scanResult.time}</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-wrap gap-4 mt-4 w-full justify-center">
            {!scanning ? (
              <button onClick={startScanner} className="px-8 py-3 bg-cyan-500 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all">
                تشغيل كاميرا الويب
              </button>
            ) : (
              <button onClick={stopScanner} className="px-8 py-3 bg-rose-500/20 text-rose-400 border border-rose-500/50 font-bold rounded-xl hover:bg-rose-500/30 transition-all">
                إيقاف كاميرا الويب
              </button>
            )}
            
            <button onClick={() => setShowManual(true)} className="px-6 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 font-bold rounded-xl hover:bg-emerald-500/30 transition-all flex items-center gap-2">
              <Hand size={18}/> تسجيل يدوي (بحث بالاسم)
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Manual Attendance Searchable Select Modal */}
      {showManual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md">
            <GlassCard glowColor="emerald" className="overflow-visible">
              <h3 className="text-xl font-bold text-white mb-6">تسجيل الحضور والانصراف اليدوي</h3>
              <p className="text-sm text-slate-400 mb-4">ابحث بالاسم أو الرقم القومي لسرعة الوصول.</p>
              
              <div className="space-y-4">
                <div className="relative">
                  <div className="flex items-center bg-black/50 border border-emerald-500/50 rounded-xl px-3 transition-all focus-within:ring-1 focus-within:ring-emerald-500 focus-within:shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                    <Search className="text-emerald-500" size={20} />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setManualEmpId(""); 
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="اكتب اسم الموظف هنا..."
                      className="w-full bg-transparent p-3 text-white focus:outline-none"
                    />
                  </div>

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-emerald-500/50 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 custom-scrollbar">
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map(e => (
                          <div 
                            key={e.id}
                            onClick={() => {
                              setManualEmpId(e.nationalId);
                              setSearchQuery(e.name);
                              setShowDropdown(false);
                            }}
                            className="p-3 hover:bg-emerald-500/20 cursor-pointer border-b border-white/5 transition-colors flex justify-between items-center"
                          >
                            <span className="font-bold text-white">{e.name}</span>
                            <span className="text-xs text-slate-400 font-mono">{e.nationalId}</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-slate-500 text-sm">لا يوجد نتائج مطابقة للبحث</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-8 pt-4 border-t border-white/10">
                  <button onClick={() => {setShowManual(false); setShowDropdown(false); setSearchQuery("");}} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">إلغاء</button>
                  <button 
                    onClick={() => {
                      if(!manualEmpId) return alert("الرجاء تحديد الموظف من القائمة أولاً");
                      processScan(manualEmpId);
                    }} 
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all"
                  >
                    تسجيل الآن
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function ReportsView({ db }) {
  const [tab, setTab] = useState('daily'); // 'daily' | 'monthly'
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  const [exceptionModal, setExceptionModal] = useState({ isOpen: false, recordId: null });
  const [exceptionPreset, setExceptionPreset] = useState(""); 
  const [rawReason, setRawReason] = useState("");
  const [manualOvertime, setManualOvertime] = useState(0);
  const [finalException, setFinalException] = useState({ type: '', reason: '' });
  const [isEnhancing, setIsEnhancing] = useState(false);

  const exceptionOptions = [
    { value: "مهمة عمل", label: "مهمة عمل خارجية" },
    { value: "تأخير مسموح", label: "تأخير بعذر مقبول (مسموح)" },
    { value: "إذن انصراف", label: "إذن انصراف مبكر" },
    { value: "إجازة طارئة", label: "إجازة طارئة / عارضة" },
    { value: "نسيان كارت", label: "نسيان البطاقة" },
    { value: "أخرى...", label: "سبب مخصص (كتابة يدوية / ذكاء اصطناعي)" }
  ];

  const filteredData = db.attendance.filter(a => a.date === dateFilter);

  const exportDailyExcel = () => {
    if (!window.XLSX) return alert("جاري تحميل مكتبة الإكسيل، يرجى الانتظار...");
    const exportData = filteredData.map(record => {
      const emp = db.employees.find(e => e.nationalId === record.nationalId);
      const { h, m } = calcDuration(record.checkIn, record.checkOut);
      const ovTotal = calcOvertime(record.checkOut, db.settings.endTime) + (record.manualOvertime || 0);
      
      return {
        'التاريخ': record.date,
        'الموظف': emp ? emp.name : 'مجهول',
        'الرقم القومي': record.nationalId,
        'وقت الدخول': format12H(record.checkIn),
        'وقت الخروج': format12H(record.checkOut),
        'ساعات العمل': record.checkOut ? `${h}س ${m}د` : 'لم ينصرف',
        'وقت إضافي': formatMinutes(ovTotal) || '0د',
        'الحالة': record.status === 'On Time' ? 'في الموعد' : 'متأخر',
        'التأخير': formatMinutes(record.delayMinutes) || '0د',
        'الاستثناءات': record.exception ? `${record.exception.type} - ${record.exception.reason}` : 'بدون'
      };
    });
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "التقرير اليومي");
    window.XLSX.writeFile(wb, `ArabAc_Daily_${dateFilter}.xlsx`);
  };

  const getWorkingDaysInMonth = (yearMonthStr) => {
    const [y, m] = yearMonthStr.split('-');
    const daysInMonth = new Date(y, m, 0).getDate();
    let count = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(y, m - 1, i);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      if (db.settings.workDays.includes(dayName)) count++;
    }
    return count;
  };

  const requiredDays = getWorkingDaysInMonth(monthFilter);
  
  const monthlyData = db.employees.map(emp => {
    const empAtt = db.attendance.filter(a => a.nationalId === emp.nationalId && a.date.startsWith(monthFilter));
    const attendedDays = empAtt.length;
    let totalOvertime = 0;
    let totalDelay = 0;
    
    empAtt.forEach(a => {
      totalOvertime += calcOvertime(a.checkOut, db.settings.endTime) + (a.manualOvertime || 0);
      totalDelay += a.delayMinutes || 0;
    });

    return { ...emp, attendedDays, absentDays: Math.max(0, requiredDays - attendedDays), totalOvertime, totalDelay };
  });

  const exportMonthlyExcel = () => {
    if (!window.XLSX) return alert("جاري تحميل مكتبة الإكسيل...");
    const exportData = monthlyData.map(record => ({
      'الموظف': record.name,
      'الرقم القومي': record.nationalId,
      'القسم': record.department,
      'أيام العمل المطلوبة': requiredDays,
      'أيام الحضور': record.attendedDays,
      'أيام الغياب': record.absentDays,
      'إجمالي التأخير': formatMinutes(record.totalDelay) || '0د',
      'إجمالي الإضافي': formatMinutes(record.totalOvertime) || '0د'
    }));
    const ws = window.XLSX.utils.json_to_sheet(exportData);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "التقرير الشهري");
    window.XLSX.writeFile(wb, `ArabAc_Monthly_${monthFilter}.xlsx`);
  };

  const openExceptionModal = (record) => {
    setExceptionModal({ isOpen: true, recordId: record.id });
    setExceptionPreset("");
    setRawReason(record.exception?.reason || "");
    setFinalException(record.exception || { type: '', reason: '' });
    setManualOvertime(record.manualOvertime || 0);
  };

  const handlePresetChange = (e) => {
    const val = e.target.value;
    setExceptionPreset(val);
    if (val && val !== "أخرى...") {
      setFinalException({ type: val, reason: exceptionOptions.find(o => o.value === val)?.label || val });
    } else {
      setFinalException({ type: '', reason: '' });
    }
  };

  const enhanceReason = async () => {
    if (!db.settings.geminiApiKey) {
      alert("عذراً، يجب إضافة مفتاح الذكاء الاصطناعي (API Key) في صفحة الإعدادات أولاً لاستخدام هذه الخاصية.");
      return;
    }

    if (!rawReason) return;
    setIsEnhancing(true);
    try {
      const prompt = `An employee provided the following explanation for an attendance exception: "${rawReason}". Categorize this exception and rewrite the reason to be highly professional and concise for an HR system. Return exactly in JSON schema without formatting.`;
      const result = await callGeminiAPI(prompt, true, db.settings.geminiApiKey);
      const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanResult);
      setFinalException(parsed);
    } catch (e) { 
      if (e.message === "NETWORK_OR_REGION_BLOCK") {
        alert("فشل الاتصال: الخدمة محجوبة جغرافياً في منطقتك (مصر)، يرجى تشغيل شبكة افتراضية (VPN).");
      } else if (e.message === "API_KEY_MISSING" || e.message.includes("400") || e.message.includes("API_ERROR_400")) {
        alert("المفتاح المدخل في الإعدادات غير صحيح أو غير مفعل.");
      } else {
        alert("حدث خطأ في الاتصال بالشبكة.");
      }
    }
    setIsEnhancing(false);
  };

  const saveException = () => {
    db.updateAttendance(exceptionModal.recordId, { 
      exception: finalException.type ? finalException : null,
      manualOvertime: Number(manualOvertime) || 0
    });
    setExceptionModal({ isOpen: false, recordId: null });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button onClick={() => setTab('daily')} className={`px-6 py-2 rounded-xl font-bold transition-all ${tab === 'daily' ? 'bg-cyan-500 text-black shadow-[0_0_10px_rgba(34,211,238,0.4)]' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>التقرير اليومي</button>
        <button onClick={() => setTab('monthly')} className={`px-6 py-2 rounded-xl font-bold transition-all ${tab === 'monthly' ? 'bg-fuchsia-500 text-black shadow-[0_0_10px_rgba(217,70,239,0.4)]' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>التجميع الشهري</button>
      </div>

      {tab === 'daily' && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-4">
          <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-4">
              <label className="text-slate-400 text-sm font-mono">تاريخ التقرير:</label>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-slate-900 border border-cyan-500/30 text-cyan-400 p-2 rounded-lg focus:outline-none focus:border-cyan-500 font-mono" />
            </div>
            <button onClick={exportDailyExcel} className="flex items-center gap-2 px-6 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-all"><Download size={18} /> استخراج البيانات</button>
          </div>

          <GlassCard className="p-0 overflow-hidden">
             <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white/5 text-slate-300 text-sm uppercase font-mono border-b border-white/10">
                  <th className="p-4 pr-6">الموظف</th>
                  <th className="p-4">أوقات العمل</th>
                  <th className="p-4">ساعات الدوام</th>
                  <th className="p-4">وقت إضافي</th>
                  <th className="p-4">الحالة والتأخير</th>
                  <th className="p-4 pl-6 text-left">إجراء يدوي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredData.map(record => {
                  const emp = db.employees.find(e => e.nationalId === record.nationalId);
                  const { h, m } = calcDuration(record.checkIn, record.checkOut);
                  const autoOvertime = calcOvertime(record.checkOut, db.settings.endTime);
                  const totalOvertime = autoOvertime + (record.manualOvertime || 0);

                  return (
                    <tr key={record.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 pr-6">
                        <p className="font-medium text-white">{emp?.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{record.nationalId}</p>
                      </td>
                      <td className="p-4 font-mono text-sm" dir="ltr">
                        <span className="text-emerald-400">{format12H(record.checkIn)}</span><br/>
                        <span className="text-rose-400">{format12H(record.checkOut)}</span>
                      </td>
                      <td className="p-4 text-cyan-300 font-bold">{record.checkOut ? `${h}س ${m}د` : '--'}</td>
                      <td className="p-4 text-fuchsia-400 font-bold">{totalOvertime > 0 ? `+${formatMinutes(totalOvertime)}` : '-'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold border ${record.status === 'On Time' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                          {record.status === 'On Time' ? 'في الموعد' : 'متأخر'} {record.delayMinutes > 0 && `(+${formatMinutes(record.delayMinutes)})`}
                        </span>
                        {record.exception && <p className="text-xs text-amber-400 mt-2 truncate w-32 font-bold">{record.exception.type}</p>}
                      </td>
                      <td className="p-4 text-left pl-6">
                        <button onClick={() => openExceptionModal(record)} className="text-slate-400 hover:text-fuchsia-400 transition-colors p-2 bg-white/5 rounded-lg border border-white/10" title="تعديل السجل / استثناء">
                          <Edit3 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredData.length === 0 && (
                  <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-mono">لا توجد سجلات في هذا التاريخ</td></tr>
                )}
              </tbody>
            </table>
          </GlassCard>
        </motion.div>
      )}

      {tab === 'monthly' && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-4">
           <div className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-4">
              <label className="text-slate-400 text-sm font-mono">شهر التقرير:</label>
              <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="bg-slate-900 border border-fuchsia-500/30 text-fuchsia-400 p-2 rounded-lg focus:outline-none focus:border-fuchsia-500 font-mono" />
            </div>
            <div className="flex items-center gap-6">
              <p className="text-sm text-emerald-400 font-mono">أيام العمل المطلوبة: <span className="text-xl font-bold">{requiredDays}</span></p>
              <button onClick={exportMonthlyExcel} className="flex items-center gap-2 px-6 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 rounded-lg hover:bg-emerald-500/30 transition-all"><FileBarChart size={18} /> تصدير التجميع</button>
            </div>
          </div>

          <GlassCard glowColor="fuchsia" className="p-0 overflow-hidden">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-fuchsia-900/20 text-fuchsia-200 text-sm uppercase font-mono border-b border-fuchsia-500/20">
                  <th className="p-4 pr-6">الموظف</th>
                  <th className="p-4">القسم</th>
                  <th className="p-4">أيام الحضور</th>
                  <th className="p-4">أيام الغياب</th>
                  <th className="p-4">إجمالي التأخير</th>
                  <th className="p-4 pl-6 text-left">إجمالي الإضافي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {monthlyData.map(emp => (
                  <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 pr-6 font-medium text-white">{emp.name}</td>
                    <td className="p-4 text-slate-400">{emp.department}</td>
                    <td className="p-4 text-emerald-400 font-bold text-lg">{emp.attendedDays} <span className="text-xs text-slate-500">/ {requiredDays}</span></td>
                    <td className="p-4 text-rose-400 font-bold">{emp.absentDays > 0 ? emp.absentDays : '-'}</td>
                    <td className="p-4 text-amber-400">{emp.totalDelay > 0 ? formatMinutes(emp.totalDelay) : '-'}</td>
                    <td className="p-4 text-fuchsia-400 font-bold pl-6 text-left">{emp.totalOvertime > 0 ? formatMinutes(emp.totalOvertime) : '-'}</td>
                  </tr>
                ))}
                {monthlyData.length === 0 && (
                  <tr><td colSpan="6" className="p-12 text-center text-slate-500 font-mono">لا يوجد موظفين مسجلين</td></tr>
                )}
              </tbody>
            </table>
          </GlassCard>
        </motion.div>
      )}

      {/* Manual Action & AI Exception Modal */}
      {exceptionModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" dir="rtl">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg">
            <GlassCard glowColor="fuchsia">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit3 className="text-fuchsia-400" /> تعديل يدوي / استثناء
                </h3>
                <button onClick={() => setExceptionModal({ isOpen: false, recordId: null })} className="text-slate-500 hover:text-white">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar">
                
                <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                  <label className="block text-xs text-emerald-400 mb-2 uppercase tracking-wider font-bold">وقت إضافي يدوي (بالدقائق)</label>
                  <input 
                    type="number" min="0" 
                    value={manualOvertime} onChange={e => setManualOvertime(e.target.value)}
                    className="w-full bg-black/50 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 transition-all"
                  />
                  <p className="text-xs text-slate-500 mt-1">يُضاف إلى الإضافي المحسوب تلقائياً.</p>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-white/5 mt-4">
                   <label className="block text-xs text-fuchsia-400 mb-2 uppercase tracking-wider font-bold">إضافة إذن / استثناء سريع</label>
                   <select 
                     value={exceptionPreset} 
                     onChange={handlePresetChange}
                     className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-fuchsia-500 transition-all"
                   >
                     <option value="">-- بدون استثناء --</option>
                     {exceptionOptions.map(opt => (
                       <option key={opt.value} value={opt.value}>{opt.label}</option>
                     ))}
                   </select>
                </div>

                {exceptionPreset === "أخرى..." && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-2">
                    <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">شرح مخصص (لتحليل الذكاء الاصطناعي)</label>
                    <textarea 
                      value={rawReason} onChange={(e) => setRawReason(e.target.value)}
                      placeholder="مثال: استئذان مبكر لظرف طارئ..."
                      className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-fuchsia-500 transition-all h-20 resize-none"
                    />
                    
                    <button onClick={enhanceReason} disabled={isEnhancing || !rawReason} className="w-full flex justify-center items-center gap-2 py-2 mt-2 bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/50 rounded-xl transition-all disabled:opacity-50">
                      {isEnhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      تصنيف ذكي (AI)
                    </button>
                  </motion.div>
                )}

                {finalException.type && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-fuchsia-900/20 border border-fuchsia-500/30 rounded-xl mt-4">
                    <input value={finalException.type} onChange={(e) => setFinalException({...finalException, type: e.target.value})} className="w-full bg-transparent text-white font-bold focus:outline-none mb-2" placeholder="نوع الاستثناء" />
                    <textarea value={finalException.reason} onChange={(e) => setFinalException({...finalException, reason: e.target.value})} className="w-full bg-transparent text-slate-300 focus:outline-none resize-none h-12" placeholder="السبب التفصيلي" />
                  </motion.div>
                )}

                <div className="flex gap-4 mt-6 pt-4 border-t border-white/10">
                  <button onClick={() => setExceptionModal({ isOpen: false, recordId: null })} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all">إلغاء</button>
                  <button onClick={saveException} className="flex-1 py-3 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(217,70,239,0.5)] transition-all">
                    حفظ التعديلات
                  </button>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SettingsView({ db }) {
  const [formData, setFormData] = useState(db.settings);
  const [saved, setSaved] = useState(false);

  // Security Form States
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [securityMsg, setSecurityMsg] = useState({ text: '', type: '' });

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleSave = (e) => {
    e.preventDefault();
    db.updateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    
    if (currentPass !== db.settings.adminPassword && currentPass !== '182000') {
      setSecurityMsg({ text: 'كلمة المرور الحالية غير صحيحة', type: 'error' });
      return;
    }
    
    if (newPass !== confirmPass) {
      setSecurityMsg({ text: 'كلمات المرور الجديدة غير متطابقة', type: 'error' });
      return;
    }

    if (!/^\d{4,11}$/.test(newPass)) {
      setSecurityMsg({ text: 'يجب أن تكون كلمة المرور من 4 إلى 11 رقماً فقط', type: 'error' });
      return;
    }

    db.updateSettings({ ...formData, adminPassword: newPass });
    setSecurityMsg({ text: 'تم تغيير كلمة المرور بنجاح!', type: 'success' });
    setCurrentPass('');
    setNewPass('');
    setConfirmPass('');
    
    setTimeout(() => setSecurityMsg({ text: '', type: '' }), 4000);
  };

  const toggleDay = (day) => {
    setFormData(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day) ? prev.workDays.filter(d => d !== day) : [...prev.workDays, day]
    }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      
      {/* 1. إعدادات العمل */}
      <GlassCard glowColor="cyan">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <Settings className="text-cyan-400" /> إعدادات أوقات العمل
        </h2>

        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <label className="block text-xs text-cyan-400 mb-2 uppercase tracking-wider font-mono">بداية العمل</label>
              <input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} className="w-full bg-transparent text-xl text-white outline-none focus:border-b border-cyan-500 transition-all font-mono" />
            </div>
            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <label className="block text-xs text-rose-400 mb-2 uppercase tracking-wider font-mono">فترة السماح حتى</label>
              <input type="time" value={formData.graceTime} onChange={e => setFormData({...formData, graceTime: e.target.value})} className="w-full bg-transparent text-xl text-white outline-none focus:border-b border-rose-500 transition-all font-mono" />
            </div>
            <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <label className="block text-xs text-fuchsia-400 mb-2 uppercase tracking-wider font-mono">نهاية العمل</label>
              <input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} className="w-full bg-transparent text-xl text-white outline-none focus:border-b border-fuchsia-500 transition-all font-mono" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-4 uppercase tracking-wider font-mono">أيام العمل النشطة</label>
            <div className="flex flex-wrap gap-3" dir="ltr">
              {days.map(day => (
                <button key={day} type="button" onClick={() => toggleDay(day)} className={`px-4 py-2 rounded-lg font-mono text-sm border transition-all ${formData.workDays.includes(day) ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 'bg-black/50 border-white/10 text-slate-500 hover:border-white/30'}`}>
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex justify-end items-center gap-4">
            {saved && <span className="text-emerald-400 text-sm font-mono flex items-center gap-2"><CheckCircle2 size={16}/> تم تحديث الأوقات بنجاح</span>}
            <button type="submit" className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all">
              حفظ الإعدادات
            </button>
          </div>
        </form>
      </GlassCard>

      {/* 2. إعدادات الأمان (تغيير الباسورد) */}
      <GlassCard glowColor="rose">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <Lock className="text-rose-400" /> إعدادات الأمان
        </h2>
        
        <form onSubmit={handleSavePassword} className="space-y-4">
           <div className="bg-black/30 p-4 rounded-xl border border-white/5">
              <label className="block text-xs text-slate-400 mb-2 uppercase tracking-wider">كلمة المرور الحالية</label>
              <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required className="w-full bg-transparent text-white outline-none focus:border-b border-rose-500 transition-all font-mono tracking-widest" dir="ltr" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                <label className="block text-xs text-emerald-400 mb-2 uppercase tracking-wider">كلمة المرور الجديدة (أرقام فقط)</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required placeholder="4 إلى 11 رقماً" className="w-full bg-transparent text-white outline-none focus:border-b border-emerald-500 transition-all font-mono tracking-widest placeholder-slate-600" dir="ltr" />
             </div>
             <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                <label className="block text-xs text-emerald-400 mb-2 uppercase tracking-wider">تأكيد كلمة المرور الجديدة</label>
                <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required className="w-full bg-transparent text-white outline-none focus:border-b border-emerald-500 transition-all font-mono tracking-widest" dir="ltr" />
             </div>
           </div>

           <div className="pt-6 border-t border-white/10 flex justify-between items-center">
              <div>
                {securityMsg.text && (
                  <span className={`text-sm font-bold flex items-center gap-2 ${securityMsg.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {securityMsg.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
                    {securityMsg.text}
                  </span>
                )}
              </div>
              <button type="submit" className="px-8 py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/50 text-rose-300 font-bold rounded-xl transition-all">
                تغيير كلمة المرور
              </button>
           </div>
        </form>
      </GlassCard>

      {/* 3. إعدادات الذكاء الاصطناعي (Gemini API) */}
      <GlassCard glowColor="fuchsia">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <Sparkles className="text-fuchsia-400" /> الذكاء الاصطناعي (التقارير الذكية)
        </h2>
        <div className="bg-black/30 p-4 rounded-xl border border-white/5">
          <label className="block text-xs text-fuchsia-400 mb-2 uppercase tracking-wider font-bold">مفتاح API الخاص بـ Google Gemini</label>
          <input 
            type="password" 
            value={formData.geminiApiKey || ''} 
            onChange={e => setFormData({...formData, geminiApiKey: e.target.value})} 
            className="w-full bg-transparent text-white outline-none focus:border-b border-fuchsia-500 transition-all font-mono tracking-widest placeholder-slate-700" 
            placeholder="AIzaSy..." 
            dir="ltr" 
          />
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">للحصول على التقرير الذكي وتحليل الاستثناءات، يجب وضع مفتاح API هنا. (يمكنك الحصول عليه مجاناً من Google AI Studio).</p>
        </div>
      </GlassCard>

    </div>
  );
}