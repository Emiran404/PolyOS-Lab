import { useState, useEffect, useRef } from 'react';
import {
  Users,
  MonitorPlay,
  Monitor,
  FolderOpen,
  Settings,
  LogOut,
  Power,
  Lock,
  Unlock,
  RefreshCw,
  PowerOff,
  Activity,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Wifi,
  MonitorUp,
  HelpCircle,
  Image,
  ChevronLeft,  
  Zap,
  Globe,
  MessageSquare,
  Network,
  WifiOff,
  Moon,
  Terminal,
  Heart,
  Cpu,
  Thermometer,
  HardDrive
} from 'lucide-react';
import './App.css';
// @ts-ignore
import RFB from '@novnc/novnc';

interface Client {
  id: string;
  hostname: string;
  mac?: string;
  version?: string;
}

let lastRxBytes = 0;
let lastTxBytes = 0;
let lastTime = Date.now();
let pingHistory: Array<{ success: boolean; latency: number }> = [];

interface VncViewerProps {
  url: string;
  viewOnly?: boolean;
  style?: React.CSSProperties;
}

function VncViewer({ url, viewOnly = false, style }: VncViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    if (!containerRef.current) return;

    setStatus('connecting');
    console.log("[noVNC] Initializing connection to:", url);

    let rfb: any = null;
    try {
      rfb = new RFB(containerRef.current, url, {
        wsProtocols: ['binary'],
        focusOnClick: true
      });

      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.viewOnly = viewOnly;

      rfb.addEventListener('connect', () => {
        console.log("[noVNC] Connected to", url);
        setStatus('connected');
      });

      rfb.addEventListener('disconnect', (e: any) => {
        console.log("[noVNC] Disconnected:", e.detail.clean);
        setStatus('disconnected');
      });

      rfbRef.current = rfb;
    } catch (err) {
      console.error("[noVNC] Error initializing:", err);
      setStatus('disconnected');
    }

    return () => {
      if (rfbRef.current) {
        try {
          rfbRef.current.disconnect();
        } catch (e) {
          console.error("[noVNC] Error during disconnect:", e);
        }
        rfbRef.current = null;
      }
    };
  }, [url, viewOnly]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100px', ...style }}>
      {status === 'connecting' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          zIndex: 10,
          gap: '12px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(13, 148, 136, 0.2)',
            borderTop: '3px solid var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>VNC Akışı Bağlanıyor...</span>
        </div>
      )}
      {status === 'disconnected' && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          zIndex: 10,
          gap: '8px'
        }}>
          <Monitor size={32} style={{ opacity: 0.5 }} />
          <span style={{ fontSize: '13px' }}>VNC Bağlantısı Kesildi veya İstemci VNC Sunucusu Başlatamadı.</span>
        </div>
      )}
      <div 
        ref={containerRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'hidden'
        }} 
      />
    </div>
  );
}

function App() {
  const [isOnboarded, setIsOnboarded] = useState(() => {
    return localStorage.getItem('polyos_onboarded') === 'true';
  });
  const [teacherName, setTeacherName] = useState(() => {
    return localStorage.getItem('polyos_teacher_name') || 'Emirhan Gök';
  });
  const [teacherRole, setTeacherRole] = useState(() => {
    return localStorage.getItem('polyos_teacher_role') || 'Sistem Yöneticisi';
  });

  const [onboardName, setOnboardName] = useState('Emirhan Gök');
  const [onboardRole, setOnboardRole] = useState('Sistem Yöneticisi');
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
  const [isOnboardingFadingOut, setIsOnboardingFadingOut] = useState(false);

  const handleOnboardingSubmit = (name: string, role: string) => {
    localStorage.setItem('polyos_teacher_name', name);
    localStorage.setItem('polyos_teacher_role', role);
    localStorage.setItem('polyos_onboarded', 'true');
    setTeacherName(name);
    setTeacherRole(role);
    setIsOnboarded(true);
  };

  const handleResetSystem = () => {
    if (window.confirm('Sistemi sıfırlamak istediğinize emin misiniz? Tüm yapılandırma silinecektir.')) {
      localStorage.removeItem('polyos_onboarded');
      localStorage.removeItem('polyos_teacher_name');
      localStorage.removeItem('polyos_teacher_role');
      localStorage.removeItem('defaultStartTab');
      setTeacherName('Emirhan Gök');
      setTeacherRole('Sistem Yöneticisi');
      setOnboardName('Emirhan Gök');
      setOnboardRole('Sistem Yöneticisi');
      setIsOnboarded(false);
      setActiveTab('summary');
      setDefaultStartTab('summary');
    }
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('defaultStartTab') || 'summary';
  });
  const [defaultStartTab, setDefaultStartTab] = useState(() => {
    return localStorage.getItem('defaultStartTab') || 'summary';
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  const [wallpaperLocked, setWallpaperLocked] = useState<boolean>(true);
  const [wallpaperPath, setWallpaperPath] = useState<string>('');
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState<boolean>(false);

  const [clientCardSize, setClientCardSize] = useState<number>(() => {
    return Number(localStorage.getItem('polyos_client_card_size')) || 220;
  });

  const handleCardSizeChange = (size: number) => {
    setClientCardSize(size);
    localStorage.setItem('polyos_client_card_size', String(size));
  };

  const [toastTitle, setToastTitle] = useState<string>('Sistem Bildirimi');
  const toastTimeoutRef = useRef<any>(null);
  const showDashboardNotification = (msg: string, title: string = 'Sistem Bildirimi') => {
    setToastTitle(title);
    setActiveToast(msg);
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
      toastTimeoutRef.current = null;
    }, 4500);
  };

  const handleDefaultStartTabChange = (val: string) => {
    setDefaultStartTab(val);
    localStorage.setItem('defaultStartTab', val);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshTicker, setRefreshTicker] = useState(0);

  // Uzaktan Terminal State'leri
  const [activeTerminalClients, setActiveTerminalClients] = useState<Client[]>([]);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (activeTerminalClients.length > 0 && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines, activeTerminalClients]);
  
  // Telemetri (Sağlık Haritası) State'leri
  const [telemetryData, setTelemetryData] = useState<Record<string, { cpuUsage: number; cpuTemp: number; ramUsage: number; diskUsage: number; totalRam?: number; usedRam?: number; totalDisk?: number; usedDisk?: number }>>({});

  // Telemetri ve aşırı ısınma durumları
  const overheatingClients = clients.filter(client => {
    const tel = telemetryData[client.id];
    return tel && tel.cpuUsage >= 95.0 && tel.cpuTemp >= 75.0;
  });

  const avgCpu = clients.length > 0
    ? Math.round(clients.reduce((acc, c) => acc + (telemetryData[c.id]?.cpuUsage || 0), 0) / clients.length)
    : 0;

  const totalRamAll = clients.reduce((acc, c) => acc + (telemetryData[c.id]?.totalRam ?? 16.0), 0);
  const totalUsedRam = clients.reduce((acc, c) => acc + (telemetryData[c.id]?.usedRam ?? (16.0 * (telemetryData[c.id]?.ramUsage ?? 0) / 100)), 0);

  const totalDiskAll = clients.reduce((acc, c) => acc + (telemetryData[c.id]?.totalDisk ?? 250.0), 0);
  const totalUsedDisk = clients.reduce((acc, c) => acc + (telemetryData[c.id]?.usedDisk ?? (250.0 * (telemetryData[c.id]?.diskUsage ?? 0) / 100)), 0);

  // Telemetri Verilerini Çekme (Her 4 saniyede bir)
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/telemetry');
        if (response.ok) {
          const data = await response.json();
          setTelemetryData(data || {});
        }
      } catch (e) {
        console.error("Telemetry fetch error:", e);
      }
    };

    const interval = setInterval(fetchTelemetry, 4000);
    fetchTelemetry();

    return () => clearInterval(interval);
  }, []);

  // Uzaktan Terminal Canlı Çıktı Dinleme
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectTerminal = () => {
      ws = new WebSocket('ws://localhost:8080/ws/terminal?token=polyos-secure-token');
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // format: { clientId: "...", hostname: "...", command_id: "...", output: "..." }
          setTerminalLines(prev => [...prev, `[${data.hostname}] ${data.output}`]);
        } catch (e) {
          setTerminalLines(prev => [...prev, event.data]);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectTerminal, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connectTerminal();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Canlı Log Kayıtlarını Dinleme
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectLogs = () => {
      ws = new WebSocket('ws://localhost:8080/ws/logs?token=polyos-secure-token');
      
      ws.onmessage = (event) => {
        const rawLog = event.data;
        setLogs(prev => {
          const newLogs = [...prev, `${new Date().toLocaleTimeString('tr-TR')} - ${rawLog}`];
          if (newLogs.length > 200) {
            return newLogs.slice(newLogs.length - 200);
          }
          return newLogs;
        });

        // Parse broadcast logs to trigger dashboard notifications
        if (rawLog.includes("Yayın komutu gönderildi: show_message:")) {
          const parts = rawLog.split("show_message:");
          if (parts.length > 1) {
            const msg = parts[1].split(" (Başarılı")[0];
            if (msg) {
              showDashboardNotification(msg, "Sınav Bildirimi");
            }
          }
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectLogs, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connectLogs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Uzaktan Kontrol (Remote Control) State'leri
  const [controlClient, setControlClient] = useState<Client | null>(null);
  const [rcTicker, setRcTicker] = useState(0);
  const [clipboardText, setClipboardText] = useState('');

  // Entegre Sunucu State'leri
  const [serverState, setServerState] = useState<{ status: 'running' | 'stopped'; port: string }>({
    status: 'stopped',
    port: '8080'
  });
  const [inputPort, setInputPort] = useState('8080');

  // Dosya transferi state'leri
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetClient, setTargetClient] = useState('all');
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Pardus Ekran Akış Kalitesi State'i
  const [streamQuality, setStreamQuality] = useState('quality_medium');

  // Görüntü Sistem Teknoloji Seçeneği State'i
  const [shareTechnology, setShareTechnology] = useState(() => {
    return localStorage.getItem('shareTechnology') || 'set_tech_vnc';
  });

  // Hızlı İşlemler (Epoptes) State'leri
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [webUrlModalOpen, setWebUrlModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');

  const messageInputRef = useRef<HTMLInputElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messageModalOpen) {
      const timer = setTimeout(() => {
        messageInputRef.current?.focus();
        messageInputRef.current?.select();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messageModalOpen]);

  useEffect(() => {
    if (activeTerminalClients.length > 0) {
      const timer = setTimeout(() => {
        terminalInputRef.current?.focus();
        terminalInputRef.current?.select();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTerminalClients]);

  useEffect(() => {
    if (selectedClientIds.length > 0) {
      setTargetClient('selected');
    } else {
      setTargetClient('all');
    }
  }, [selectedClientIds]);

  // Ağ Yönetimi State'leri
  const [internetStatus, setInternetStatus] = useState<'enabled' | 'disabled'>('enabled');
  const [forbiddenWebsites, setForbiddenWebsites] = useState<string[]>(() => {
    const saved = localStorage.getItem('forbiddenWebsites');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved forbiddenWebsites:", e);
      }
    }
    return ['youtube.com', 'facebook.com', 'instagram.com'];
  });
  const [newForbiddenWebsite, setNewForbiddenWebsite] = useState('');
  const [telemetry, setTelemetry] = useState({
    download: 142.4,
    upload: 38.6,
    latency: 12,
    packetLoss: 0.1,
    jitter: 1.4
  });

  const [telemetryHistory, setTelemetryHistory] = useState<{ download: number; upload: number }[]>(() => {
    const initialHistory = [];
    for (let i = 0; i < 20; i++) {
      initialHistory.push({ download: 142.4, upload: 38.6 });
    }
    return initialHistory;
  });

  useEffect(() => {
    setTelemetryHistory(prev => {
      const next = [...prev, { download: telemetry.download, upload: telemetry.upload }];
      if (next.length > 25) {
        next.shift();
      }
      return next;
    });
  }, [telemetry]);

  const generatePath = (key: 'download' | 'upload', maxVal: number) => {
    if (telemetryHistory.length < 2) {
      return `M 0 80 L 400 80`;
    }
    const points = telemetryHistory.map((pt, index) => {
      const x = (index / (telemetryHistory.length - 1)) * 400;
      const ratio = Math.min(1, Math.max(0, pt[key] / maxVal));
      const y = 90 - ratio * 70;
      return { x, y };
    });

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  // Screen Share, USB block, PolyOS Wake States
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [usbBlocked, setUsbBlocked] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [screenShareInterval, setScreenShareInterval] = useState<any>(null);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [teacherWs, setTeacherWs] = useState<WebSocket | null>(null);

  // Kara listeyi localStorage'da saklama
  useEffect(() => {
    localStorage.setItem('forbiddenWebsites', JSON.stringify(forbiddenWebsites));
  }, [forbiddenWebsites]);

  // Gerçek Ağ Telemetrisi Canlı Veri Ölçümü
  useEffect(() => {
    if (activeTab !== 'network_management') return;

    const childProcess = (window as any).require ? (window as any).require('child_process') : null;
    const fs = (window as any).require ? (window as any).require('fs') : null;

    if (!childProcess || !fs) {
      console.warn("Node.js runtime not available in browser. Using simulated telemetry.");
      const interval = setInterval(() => {
        setTelemetry(prev => {
          if (internetStatus === 'disabled') {
            return { download: 0.0, upload: 0.0, latency: 999, packetLoss: 100.0, jitter: 0.0 };
          }
          const deltaDown = (Math.random() - 0.5) * 8;
          const deltaUp = (Math.random() - 0.5) * 3;
          const deltaLat = (Math.random() - 0.5) * 2;
          return {
            download: Math.max(10, Math.min(250, Number((prev.download + deltaDown).toFixed(1)))),
            upload: Math.max(5, Math.min(80, Number((prev.upload + deltaUp).toFixed(1)))),
            latency: Math.max(5, Math.min(45, Math.round(prev.latency + deltaLat))),
            packetLoss: Math.max(0.0, Math.min(1.5, Number((prev.packetLoss + (Math.random() - 0.5) * 0.05).toFixed(2)))),
            jitter: Math.max(0.5, Math.min(5.0, Number((prev.jitter + (Math.random() - 0.5) * 0.2).toFixed(1))))
          };
        });
      }, 1500);
      return () => clearInterval(interval);
    }

    const getLinuxNetworkBytes = () => {
      try {
        const data = fs.readFileSync('/proc/net/dev', 'utf8');
        const lines = data.split('\n');
        let rxBytes = 0;
        let txBytes = 0;
        for (const line of lines) {
          if (line.includes(':')) {
            const parts = line.split(':')[1].trim().split(/\s+/);
            rxBytes += parseInt(parts[0], 10) || 0;
            txBytes += parseInt(parts[8], 10) || 0;
          }
        }
        return { rxBytes, txBytes };
      } catch (e) {
        return { rxBytes: 0, txBytes: 0 };
      }
    };

    const getMacNetworkBytes = () => {
      try {
        const out = childProcess.execSync('netstat -ib').toString();
        const lines = out.split('\n');
        let rxBytes = 0;
        let txBytes = 0;
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 10 && (parts[0].startsWith('en') || parts[0].startsWith('wlan'))) {
            const ibytes = parseInt(parts[6], 10);
            const obytes = parseInt(parts[9], 10);
            if (!isNaN(ibytes)) rxBytes += ibytes;
            if (!isNaN(obytes)) txBytes += obytes;
          }
        }
        return { rxBytes, txBytes };
      } catch (e) {
        return { rxBytes: 0, txBytes: 0 };
      }
    };

    const updateStats = () => {
      if (internetStatus === 'disabled') {
        setTelemetry({ download: 0.0, upload: 0.0, latency: 999, packetLoss: 100.0, jitter: 0.0 });
        return;
      }

      const isLinux = (window as any).process && (window as any).process.platform === 'linux';
      const stats = isLinux ? getLinuxNetworkBytes() : getMacNetworkBytes();
      const now = Date.now();
      const timeDiffSec = (now - lastTime) / 1000;
      
      let rxSpeedMbps = 0.0;
      let txSpeedMbps = 0.0;

      if (timeDiffSec > 0) {
        if (lastRxBytes > 0 && stats.rxBytes >= lastRxBytes) {
          const rxDiffBytes = stats.rxBytes - lastRxBytes;
          rxSpeedMbps = (rxDiffBytes * 8) / 1000 / 1000 / timeDiffSec;
        }
        if (lastTxBytes > 0 && stats.txBytes >= lastTxBytes) {
          const txDiffBytes = stats.txBytes - lastTxBytes;
          txSpeedMbps = (txDiffBytes * 8) / 1000 / 1000 / timeDiffSec;
        }
      }

      lastRxBytes = stats.rxBytes;
      lastTxBytes = stats.txBytes;
      lastTime = now;

      const cmd = (window as any).process && (window as any).process.platform === 'win32'
        ? 'ping -n 1 -w 1000 8.8.8.8'
        : 'ping -c 1 -W 1 8.8.8.8';

      childProcess.exec(cmd, (err: any, stdout: string) => {
        let latency = 0;
        let success = false;

        if (!err) {
          const match = stdout.match(/time=([\d.]+)\s*ms/);
          if (match && match[1]) {
            latency = parseFloat(match[1]);
            success = true;
          }
        }

        pingHistory.push({ success, latency });
        if (pingHistory.length > 10) {
          pingHistory.shift();
        }

        const successfulPings = pingHistory.filter(p => p.success);
        const packetLoss = ((pingHistory.length - successfulPings.length) / pingHistory.length) * 100;

        let avgLatency = 12.0;
        let jitter = 1.0;

        if (successfulPings.length > 0) {
          const sum = successfulPings.reduce((acc, p) => acc + p.latency, 0);
          avgLatency = sum / successfulPings.length;

          if (successfulPings.length > 1) {
            let diffSum = 0;
            for (let i = 1; i < successfulPings.length; i++) {
              diffSum += Math.abs(successfulPings[i].latency - successfulPings[i - 1].latency);
            }
            jitter = diffSum / (successfulPings.length - 1);
          }
        }

        setTelemetry({
          download: Number(rxSpeedMbps.toFixed(1)),
          upload: Number(txSpeedMbps.toFixed(1)),
          latency: Math.round(avgLatency),
          packetLoss: Number(packetLoss.toFixed(1)),
          jitter: Number(jitter.toFixed(1))
        });
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, [activeTab, internetStatus]);

  // Uzaktan Kontrol Giriş Göndericisi
  const sendInputEvent = async (event: string, extraData: any = {}) => {
    if (!controlClient) return;
    try {
      await fetch('http://localhost:8080/api/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: controlClient.id,
          event,
          ...extraData
        }),
      });
    } catch (err) {
      console.error("Failed to send input event:", err);
    }
  };

  const startRemoteControl = (client: Client) => {
    setControlClient(client);
    fetch('http://localhost:8080/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, event: 'start_control' })
    }).catch(console.error);
  };

  const stopRemoteControl = () => {
    if (!controlClient) return;
    const cid = controlClient.id;
    setControlClient(null);
    setClipboardText('');
    fetch('http://localhost:8080/api/input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: cid, event: 'stop_control' })
    }).catch(console.error);
  };

  const handleMouseClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const button = e.button === 2 ? 'right' : 'left';
    sendInputEvent('click', { x, y, button });
  };

  const handleSyncClipboard = () => {
    sendInputEvent('clipboard', { text: clipboardText });
  };

  // Uzaktan kontrol sırasında klavye olaylarını yakala
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!controlClient) return;
      
      // Eğer kullanıcı arayüzdeki bir input alanına yazı yazıyorsa VNC klavye yakalamasını devre dışı bırak
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName.toUpperCase() === 'INPUT' || activeEl.tagName.toUpperCase() === 'TEXTAREA')) {
        return;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        stopRemoteControl();
        return;
      }
      
      // Standart kısayolları engelle ki karşı tarafa gitsin
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Space' || e.key === 'Tab') {
        e.preventDefault();
        sendInputEvent('key', { key: e.key });
      }
    };

    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!controlClient) return;

      // Eğer kullanıcı arayüzdeki bir input alanına yapıştırma yapıyorsa müdahale etme
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const pastedText = e.clipboardData?.getData('text');
      if (pastedText) {
        sendInputEvent('clipboard', { text: pastedText });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [controlClient]);

  // Uzaktan kontrol ekran yenileme döngüsü (150ms)
  useEffect(() => {
    if (!controlClient) return;
    const t = setInterval(() => {
      setRcTicker(prev => prev + 1);
    }, 150);
    return () => clearInterval(t);
  }, [controlClient]);

  // Electron IPC Dinleyicisi
  useEffect(() => {
    if (window && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('get-server-status');
        
        const handleStatus = (_event: any, arg: { status: 'running' | 'stopped'; port: string }) => {
          setServerState(arg);
          setInputPort(arg.port);
        };
        
        ipcRenderer.on('server-status', handleStatus);
        return () => {
          ipcRenderer.removeListener('server-status', handleStatus);
        };
      } catch (err) {
        console.error("Electron IPC load error:", err);
      }
    }
  }, []);

  const controlServer = (action: 'start' | 'stop' | 'restart') => {
    if (window && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.send('server-control', { action, port: inputPort });
      } catch (err) {
        console.error("Failed to send server-control IPC:", err);
      }
    }
  };

  // Ekran görüntüsü akışını yenilemek için 2 saniyede bir tetikleyiciyi arttır
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTicker(prev => prev + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadStatus('idle');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadStatus('idle');
    }
  };

  const uploadFileToTarget = async (file: File, target: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('target', target);

    try {
      const response = await fetch('http://localhost:8080/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        alert(`"${file.name}" dosyası hedeflenen istemcilere başarıyla gönderildi.`);
      } else {
        alert("Dosya gönderilemedi.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Dosya gönderilirken bir hata oluştu.");
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    let target = targetClient;
    if (targetClient === 'selected') {
      if (selectedClientIds.length === 0) {
        alert("Lütfen en az bir istemci seçin.");
        setUploadStatus('idle');
        return;
      }
      target = selectedClientIds.join(',');
    }
    formData.append('target', target);

    try {
      const response = await fetch('http://localhost:8080/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadStatus('success');
        setSelectedFile(null);
      } else {
        setUploadStatus('error');
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus('error');
    }
  };

  const fetchWallpaperState = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/wallpaper');
      const data = await response.json();
      setWallpaperLocked(data.locked);
      setWallpaperPath(data.wallpaper);
    } catch (error) {
      console.error("Failed to fetch wallpaper state:", error);
    }
  };

  const handleWallpaperToggle = async (locked: boolean) => {
    try {
      const response = await fetch('http://localhost:8080/api/wallpaper/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked }),
      });
      if (response.ok) {
        setWallpaperLocked(locked);
      } else {
        alert("Duvar kağıdı kilit durumu güncellenemedi.");
      }
    } catch (error) {
      console.error("Failed to toggle wallpaper lock:", error);
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);
    
    setIsUploadingWallpaper(true);
    try {
      const response = await fetch('http://localhost:8080/api/wallpaper/upload', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setWallpaperPath(data.wallpaper);
        alert("Yeni duvar kağıdı yüklendi ve tüm istemcilere uygulandı.");
      } else {
        alert("Resim yüklenemedi.");
      }
    } catch (error) {
      console.error("Failed to upload wallpaper:", error);
      alert("Resim yüklenirken bir hata oluştu.");
    } finally {
      setIsUploadingWallpaper(false);
    }
  };

  // İstemcileri her 2 saniyede bir çek
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/clients');
        const data = await response.json();
        setClients(data || []);
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      }
    };
    
    fetchClients();
    const interval = setInterval(fetchClients, 2000);
    return () => clearInterval(interval);
  }, []);

  // Sunucu ilk açıldığında duvar kağıdı kilit durumunu çek
  useEffect(() => {
    fetchWallpaperState();
  }, []);

  // Cihazları (PolyOS Wake) çek
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/devices');
        const data = await response.json();
        setDevices(data || []);
      } catch (error) {
        console.error("Failed to fetch devices:", error);
      }
    };
    
    fetchDevices();
    const interval = setInterval(fetchDevices, 3000);
    return () => clearInterval(interval);
  }, []);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 10 }
        }
      });
      
      setScreenShareStream(stream);
      
      const ws = new WebSocket('ws://localhost:8080/ws/teacher?token=polyos-secure-token');
      setTeacherWs(ws);
      
      ws.onopen = () => {
        console.log("Teacher screen share WebSocket opened.");
        sendToAll("screen_share_on");
        
        // Chromium'un video çözücüyü durdurmaması için elementi DOM'a ekliyoruz
        const oldVideo = document.getElementById('polyos-screen-share-video');
        if (oldVideo) oldVideo.remove();

        const video = document.createElement('video');
        video.id = 'polyos-screen-share-video';
        video.style.position = 'absolute';
        video.style.width = '0px';
        video.style.height = '0px';
        video.style.opacity = '0';
        video.style.pointerEvents = 'none';
        video.muted = true;
        video.playsInline = true;
        video.srcObject = stream;
        document.body.appendChild(video);
        video.play();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const interval = setInterval(() => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
            const base64Data = dataUrl.split(',')[1];
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(base64Data);
            }
          }
        }, 150);
        
        setScreenShareInterval(interval);
      };

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
      
      setIsSharingScreen(true);
    } catch (err) {
      console.error("Failed to start screen share:", err);
      alert("Ekran paylaşımı başlatılamadı: " + err);
    }
  };

  const stopScreenShare = () => {
    if (screenShareInterval) {
      clearInterval(screenShareInterval);
      setScreenShareInterval(null);
    }
    if (screenShareStream) {
      screenShareStream.getTracks().forEach(track => track.stop());
      setScreenShareStream(null);
    }
    if (teacherWs) {
      teacherWs.close();
      setTeacherWs(null);
    }
    
    // DOM'daki gizli video elementini temizle
    const video = document.getElementById('polyos-screen-share-video');
    if (video) {
      video.remove();
    }

    sendToAll("screen_share_off");
    setIsSharingScreen(false);
  };

  const toggleUsbBlock = () => {
    const newStatus = !usbBlocked;
    setUsbBlocked(newStatus);
    if (newStatus) {
      sendToAll("block_usb");
    } else {
      sendToAll("unblock_usb");
    }
  };

  const triggerWake = async (mac: string) => {
    try {
      await fetch('http://localhost:8080/api/wake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mac }),
      });
    } catch (error) {
      console.error("Failed to trigger wake:", error);
    }
  };

  const deleteDevice = async (mac: string) => {
    try {
      await fetch('http://localhost:8080/api/devices/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mac }),
      });
    } catch (error) {
      console.error("Failed to delete device:", error);
    }
  };

  const sendCommand = async (clientId: string, command: string) => {
    try {
      const response = await fetch('http://localhost:8080/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, command }),
      });
      if (response.ok) {
        showDashboardNotification("İşlem başarıyla gönderildi.");
      }
    } catch (error) {
      console.error("Failed to send command:", error);
    }
  };

  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim() || activeTerminalClients.length === 0) return;

    const command = terminalInput.trim();
    setTerminalInput('');
    setTerminalLines(prev => [...prev, `$ ${command}`]);

    const command_id = Math.random().toString(36).substring(7);

    for (const client of activeTerminalClients) {
      try {
        await fetch('http://localhost:8080/api/terminal/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            command,
            command_id,
          }),
        });
      } catch (err) {
        console.error("Failed to run terminal command for client:", client.hostname, err);
        setTerminalLines(prev => [...prev, `[${client.hostname}] Sunucuya erişilemedi.`]);
      }
    }
  };

  const sendToAll = (command: string) => {
    clients.forEach(c => sendCommand(c.id, command));
    showDashboardNotification("Komut tüm cihazlara gönderildi.");
  };

  const handleQualityChange = (newQuality: string) => {
    setStreamQuality(newQuality);
    sendToAll(newQuality);
  };

  const handleShareTechChange = (newTech: string) => {
    setShareTechnology(newTech);
    localStorage.setItem('shareTechnology', newTech);
    sendToAll(newTech);
  };

  const sendCommandToSelected = (command: string) => {
    if (selectedClientIds.length === 0) {
      alert("Lütfen en az bir istemci seçin.");
      return;
    }
    selectedClientIds.forEach(id => sendCommand(id, command));
    showDashboardNotification("İşlem seçili cihazlara başarıyla gönderildi.");
  };

  const handleOpenUrlSubmit = (url: string) => {
    if (!url) return;
    // URL prefix check
    let target = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      target = 'https://' + url;
    }
    sendCommandToSelected('open_url:' + target);
  };

  const handleSendMessageSubmit = (msg: string) => {
    if (!msg) return;
    sendCommandToSelected('show_message:' + msg);
  };

  const handleToggleInternet = () => {
    const newStatus = internetStatus === 'enabled' ? 'disabled' : 'enabled';
    setInternetStatus(newStatus);
    if (newStatus === 'disabled') {
      sendToAll('internet_off');
    } else {
      sendToAll('internet_on');
    }
  };

  const handleAddForbiddenWebsite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForbiddenWebsite) return;
    const domain = newForbiddenWebsite.trim().toLowerCase();
    let cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    // Yol (path), port veya takıları temizle
    cleanDomain = cleanDomain.split('/')[0].split(':')[0];
    if (cleanDomain && !forbiddenWebsites.includes(cleanDomain)) {
      setForbiddenWebsites(prev => [...prev, cleanDomain]);
      sendToAll('block_site:' + cleanDomain);
    }
    setNewForbiddenWebsite('');
  };

  const handleRemoveForbiddenWebsite = (domain: string) => {
    setForbiddenWebsites(prev => prev.filter(d => d !== domain));
    sendToAll('unblock_site:' + domain);
  };

  const menuItems = [
    { icon: Activity, label: 'Laboratuvar Özeti', id: 'summary' },
    { icon: Heart, label: 'Sağlık Haritası', id: 'health_map' },
    { icon: Zap, label: 'Hızlı İşlemler', id: 'quick_actions' },
    { icon: Network, label: 'Ağ Yönetimi', id: 'network_management' },
    { icon: Monitor, label: 'İstemci Listesi', id: 'clients' },
    { icon: MonitorPlay, label: 'Ekran İzleme', id: 'screen' },
    { icon: FolderOpen, label: 'Dosya Transferi', id: 'files' },
    { icon: Power, label: 'PolyOS Wake', id: 'polyos_wake' },
    { icon: Terminal, label: 'Sistem Logları', id: 'logs' },
    { icon: Image, label: 'Duvar Kağıdı Kilidi', id: 'wallpaper' },
    { icon: Settings, label: 'Ayarlar', id: 'settings' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'summary':
        return (
          <>
            <div className="top-banner" style={{ 
              background: serverState.status === 'running' 
                ? 'linear-gradient(135deg, #0d9488 0%, #3b82f6 100%)' 
                : 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
              boxShadow: serverState.status === 'running'
                ? '0 10px 25px -5px rgba(13, 148, 136, 0.4)'
                : '0 10px 25px -5px rgba(71, 85, 105, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="banner-icon-box">
                  <Wifi size={24} />
                </div>
                <div>
                  <h4 className="banner-title">
                    {serverState.status === 'running' ? 'PolyOS Lab Sunucu Sistemi Açıktır' : 'Sistem Durumu: Çevrimdışı'}
                  </h4>
                  <p className="banner-desc">
                    {serverState.status === 'running' 
                      ? `PolyOS Lab sunucusu aktif (Port: ${serverState.port}) ve bağlantılar dinleniyor.` 
                      : 'Sunucu sistemi kapalı. Sunucuyu başlatmak için sağdaki butona tıklayın.'}
                  </p>
                </div>
              </div>
              {serverState.status === 'stopped' && (
                <button 
                  onClick={() => controlServer('start')}
                  style={{
                    backgroundColor: '#fff',
                    color: '#0f172a',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  Sunucuyu Başlat
                </button>
              )}
            </div>

            <div className="page-header">
              <div>
                <h1 className="greeting">Hoş Geldiniz, {teacherName} 👋</h1>
                <p className="sub-greeting">PolyOS Lab Yönetim Paneli • {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="header-actions">
                <button className="btn-secondary">
                  <HelpCircle size={18} />
                  Yardım
                </button>
                {devices && devices.length > 0 && devices.every(device => device.isOnline) ? (
                  <button className="btn-primary" onClick={() => sendToAll('shutdown')} style={{ backgroundColor: '#dc2626' }}>
                    <Power size={18} />
                    Tümünü Kapat
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => triggerWake('all')}>
                    <Power size={18} />
                    Tümünü Uyandır
                  </button>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-blue">
                  <Users size={24} color="#3b82f6" />
                </div>
                <div className="stat-value">{clients.length}</div>
                <div className="stat-label">Toplam İstemci</div>
                <div className="stat-detail">Kayıtlı Cihazlar</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-green">
                  <CheckCircle size={24} color="#10b981" />
                </div>
                <div className="stat-value">{clients.length}</div>
                <div className="stat-label">Aktif Bağlantı</div>
                <div className="stat-detail">Şu an çevrimiçi</div>
              </div>
              <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('health_map')}>
                <div className="stat-icon-wrapper bg-yellow">
                  <AlertCircle size={24} color="#f59e0b" />
                </div>
                <div className="stat-value">{overheatingClients.length}</div>
                <div className="stat-label">Uyarı / Hata</div>
                <div className="stat-detail">Aşırı Isınan Cihazlar</div>
              </div>
              <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('health_map')}>
                <div className="stat-icon-wrapper bg-purple">
                  <MonitorUp size={24} color="#8b5cf6" />
                </div>
                <div className="stat-value">%{avgCpu}</div>
                <div className="stat-label">Sistem Yükü</div>
                <div className="stat-detail">Ortalama</div>
              </div>
            </div>

            {/* Main Grid */}
            <div className="main-grid">
              {/* Quick Actions */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Toplu İşlemler</h2>
                </div>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn" onClick={() => sendToAll('lock')}>
                    <div className="qa-icon-box" style={{ backgroundColor: '#0d948815', color: '#0d9488' }}>
                      <Lock size={20} />
                    </div>
                    <span className="qa-label">Tümünü Kilitle</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => sendToAll('unlock')}>
                    <div className="qa-icon-box" style={{ backgroundColor: '#f59e0b15', color: '#f59e0b' }}>
                      <Unlock size={20} />
                    </div>
                    <span className="qa-label">Kilitleri Aç</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => sendToAll('reboot')}>
                    <div className="qa-icon-box" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                      <RefreshCw size={20} />
                    </div>
                    <span className="qa-label">Yeniden Başlat</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => sendToAll('shutdown')}>
                    <div className="qa-icon-box" style={{ backgroundColor: '#dc262615', color: '#dc2626' }}>
                      <PowerOff size={20} />
                    </div>
                    <span className="qa-label">Tümünü Kapat</span>
                  </button>
                </div>
              </div>

              {/* Connected Clients */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">Bağlı İstemciler</h2>
                  <button className="view-all-btn" onClick={() => setActiveTab('clients')}>
                    Tümünü Gör <ChevronRight size={16} />
                  </button>
                </div>
                
                <div className="clients-list">
                  {clients.length === 0 ? (
                    <div className="empty-state">
                      <Monitor size={48} className="empty-icon" />
                      <p>Bağlı istemci bekleniyor...</p>
                    </div>
                  ) : (
                    clients.slice(0, 3).map(client => (
                      <div key={client.id} className="client-item">
                        <div className="client-info">
                          <div className="client-title">{client.hostname}</div>
                          <div className="client-meta">
                            <Wifi size={14} /> {client.id}
                          </div>
                        </div>
                        
                        <div className="client-badge">
                          Aktif {client.version ? `(${client.version})` : '(v1.1.0)'}
                        </div>

                        <div className="client-actions">
                          <button className="action-btn" onClick={() => {
                            setActiveTerminalClients([client]);
                            setTerminalLines([]);
                          }} title="Terminal Aç">
                            <Terminal size={16} color="#0d9488" />
                          </button>
                          <button className="action-btn" onClick={() => sendCommand(client.id, 'lock')} title="Kilitle">
                            <Lock size={16} color="#475569" />
                          </button>
                          <button className="action-btn" onClick={() => sendCommand(client.id, 'sleep')} title="Uyku Modu">
                            <Moon size={16} color="#475569" />
                          </button>
                          <button className="action-btn" onClick={() => sendCommand(client.id, 'reboot')} title="Yeniden Başlat">
                            <RefreshCw size={16} color="#475569" />
                          </button>
                          <button className="action-btn danger" onClick={() => sendCommand(client.id, 'shutdown')} title="Kapat">
                            <PowerOff size={16} color="#dc2626" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        );
      case 'quick_actions':
        return (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Epoptes Style Topbar Actions */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              backgroundColor: 'var(--color-background)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => {
                    if (selectedClientIds.length === clients.length) {
                      setSelectedClientIds([]);
                    } else {
                      setSelectedClientIds(clients.map(c => c.id));
                    }
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '8px 12px' }}
                >
                  {selectedClientIds.length === clients.length ? 'Seçimi Kaldır' : 'Tümünü Seç'}
                </button>
                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)', margin: '0 8px' }} />
                
                <button 
                  onClick={() => sendCommandToSelected('lock')}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#0f172a',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Girdileri Kapat / Ekranı Kilitle"
                >
                  <Lock size={16} /> Kilitle
                </button>
                <button 
                  onClick={() => sendCommandToSelected('unlock')}
                  disabled={selectedClientIds.length === 0}
                  className="btn-secondary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Ekran Kilidini Aç"
                >
                  <Unlock size={16} /> Kilidi Aç
                </button>
                <button 
                  onClick={() => sendCommandToSelected('reboot')}
                  disabled={selectedClientIds.length === 0}
                  className="btn-secondary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Yeniden Başlat / Aç"
                >
                  <RefreshCw size={16} /> Yeniden Başlat
                </button>
                <button 
                  onClick={() => sendCommandToSelected('shutdown')}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#dc2626',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Cihazları Kapat"
                >
                  <PowerOff size={16} /> Kapat
                </button>
                <button 
                  onClick={() => sendCommandToSelected('sleep')}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#475569',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Cihazları Uyku Moduna Al"
                >
                  <Moon size={16} /> Uyku Moduna Al
                </button>
                <button 
                  onClick={() => {
                    if (selectedClientIds.length === 0) {
                      alert("Lütfen en az bir istemci seçin.");
                      return;
                    }
                    setWebUrlModalOpen(true);
                  }}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#3b82f6',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Tarayıcıda Web Sitesi Aç"
                >
                  <Globe size={16} /> Web Sitesi Aç
                </button>
                <button 
                  onClick={() => {
                    if (selectedClientIds.length === 0) {
                      alert("Lütfen en az bir istemci seçin.");
                      return;
                    }
                    setMessageModalOpen(true);
                  }}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#8b5cf6',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Öğrencilere Mesaj Gönder"
                >
                  <MessageSquare size={16} /> Mesaj Gönder
                </button>
                <button 
                  onClick={() => {
                    if (selectedClientIds.length === 0) {
                      alert("Lütfen en az bir istemci seçin.");
                      return;
                    }
                    setActiveTab('files');
                  }}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#eab308',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Seçili Cihazlara Dosya Gönder"
                >
                  <FolderOpen size={16} /> Dosya Gönder
                </button>
                <button 
                  onClick={() => {
                    if (selectedClientIds.length === 0) {
                      alert("Lütfen en az bir istemci seçin.");
                      return;
                    }
                    const selectedClients = clients.filter(c => selectedClientIds.includes(c.id));
                    setActiveTerminalClients(selectedClients);
                    setTerminalLines([]);
                  }}
                  disabled={selectedClientIds.length === 0}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: '#1e293b',
                    opacity: selectedClientIds.length === 0 ? 0.5 : 1,
                    cursor: selectedClientIds.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Seçili Cihazlarda Uzaktan Terminal Aç"
                >
                  <Terminal size={16} /> Terminal Aç
                </button>
                
                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--color-border)', margin: '0 8px' }} />

                <button 
                  onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: isSharingScreen ? '#dc2626' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Öğretmen Ekranını Öğrencilere Yansıt"
                >
                  <MonitorUp size={16} /> {isSharingScreen ? 'Yansıtmayı Durdur' : 'Ekranını Yansıt'}
                </button>
                <button 
                  onClick={toggleUsbBlock}
                  className="btn-primary"
                  style={{ 
                    fontSize: '13px', 
                    padding: '8px 12px', 
                    backgroundColor: usbBlocked ? '#10b981' : '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="USB Engelle / Aç"
                >
                  <FolderOpen size={16} /> {usbBlocked ? 'USB Kilidini Aç' : 'USB Engelle'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--color-background)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Ekran Boyutu:</span>
                  <button 
                    onClick={() => handleCardSizeChange(160)}
                    style={{ 
                      padding: '3px 8px', 
                      fontSize: '11px', 
                      borderRadius: '4px', 
                      border: 'none', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      backgroundColor: clientCardSize === 160 ? 'var(--primary)' : 'transparent',
                      color: clientCardSize === 160 ? '#fff' : 'var(--color-text)'
                    }}
                  >
                    Küçük
                  </button>
                  <button 
                    onClick={() => handleCardSizeChange(220)}
                    style={{ 
                      padding: '3px 8px', 
                      fontSize: '11px', 
                      borderRadius: '4px', 
                      border: 'none', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      backgroundColor: clientCardSize === 220 ? 'var(--primary)' : 'transparent',
                      color: clientCardSize === 220 ? '#fff' : 'var(--color-text)'
                    }}
                  >
                    Orta
                  </button>
                  <button 
                    onClick={() => handleCardSizeChange(300)}
                    style={{ 
                      padding: '3px 8px', 
                      fontSize: '11px', 
                      borderRadius: '4px', 
                      border: 'none', 
                      cursor: 'pointer',
                      fontWeight: 600,
                      backgroundColor: clientCardSize === 300 ? 'var(--primary)' : 'transparent',
                      color: clientCardSize === 300 ? '#fff' : 'var(--color-text)'
                    }}
                  >
                    Büyük
                  </button>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Seçili: {selectedClientIds.length} / {clients.length} İstemci
                </div>
              </div>
            </div>

            {/* Clients grid with live screen preview and selection checkbox */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${clientCardSize}px, 1fr))`,
              gap: '16px',
              padding: '8px 0'
            }}>
              {clients.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '40px 0' }}>
                  <Monitor size={48} className="empty-icon" />
                  <p>Bağlı istemci bekleniyor...</p>
                </div>
              ) : (
                clients.map(client => {
                  const isSelected = selectedClientIds.includes(client.id);
                  return (
                    <div 
                      key={client.id}
                      onClick={() => {
                        // Single click toggles selection
                        if (isSelected) {
                          setSelectedClientIds(prev => prev.filter(id => id !== client.id));
                        } else {
                          setSelectedClientIds(prev => [...prev, client.id]);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRemoteControl(client);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(13, 148, 136, 0.3)';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = isSelected ? 'var(--primary)' : 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = isSelected ? 'var(--primary)' : 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const file = e.dataTransfer.files[0];
                          uploadFileToTarget(file, client.id);
                        }
                      }}
                      style={{
                        position: 'relative',
                        borderRadius: '10px',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--color-border)',
                        boxShadow: isSelected ? '0 0 10px rgba(13, 148, 136, 0.2)' : 'none',
                        backgroundColor: isSelected ? 'var(--color-background)' : '#fff',
                        padding: '10px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {/* Live Screen Preview */}
                      <div 
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRemoteControl(client);
                        }}
                        style={{
                          position: 'relative',
                          height: '120px',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          backgroundColor: '#0f172a',
                          border: '1px solid var(--color-border)'
                        }}
                      >
                        <img 
                          src={`http://localhost:8080/api/screen?clientId=${encodeURIComponent(client.id)}&tick=${refreshTicker}`}
                          alt={client.hostname}
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                          onLoad={(e) => {
                            e.currentTarget.style.display = 'block';
                            const fallback = e.currentTarget.nextSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'none';
                          }}
                        />
                        <div style={{
                          display: 'flex',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#64748b',
                          fontSize: '11px',
                          flexDirection: 'column',
                          gap: '4px'
                        }}>
                          <MonitorPlay size={18} style={{ opacity: 0.5 }} />
                          <span>Bağlantı Kuruluyor...</span>
                        </div>
                      </div>

                      {/* Header/Info */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '8px',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {client.hostname}
                          </span>
                        </div>
                        <span style={{
                          backgroundColor: '#ecfdf5',
                          color: '#059669',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '10px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap'
                        }}>
                          Canlı
                        </span>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {client.id}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      case 'network_management':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div className="page-header" style={{ marginBottom: 0 }}>
              <div>
                <h1 className="greeting">Ağ Yönetimi ve Telemetri</h1>
                <p className="sub-greeting">Laboratuvar ağ durumunu izleyin ve erişim sınırlarını belirleyin</p>
              </div>
            </div>

            {/* Grid layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Left Column: Telemetry data */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>Canlı Telemetrik Veriler</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>İndirme Hızı (Download)</span>
                    <strong style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>{telemetry.download} Mbps</strong>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Yükleme Hızı (Upload)</span>
                    <strong style={{ fontSize: '24px', fontWeight: 800, color: '#0ea5e9' }}>{telemetry.upload} Mbps</strong>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Gecikme Süresi (Latency)</span>
                    <strong style={{ fontSize: '24px', fontWeight: 800, color: '#8b5cf6' }}>{telemetry.latency} ms</strong>
                  </div>

                  <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Paket Kaybı (Packet Loss)</span>
                    <strong style={{ fontSize: '24px', fontWeight: 800, color: '#dc2626' }}>{telemetry.packetLoss}%</strong>
                  </div>
                </div>

                <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Jitter Değeri</span>
                    <strong style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: '#eab308' }}>{telemetry.jitter} ms</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Aktif Ağ Cihazı</span>
                    <strong style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: '#0d9488' }}>{clients.length} Cihaz</strong>
                  </div>
                </div>

                {/* Simulated Network Graph */}
                <div style={{
                  height: '140px',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                  background: 'linear-gradient(180deg, #0d94880a 0%, #3b82f605 100%)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                   <div style={{ position: 'absolute', top: '10px', left: '15px', fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>Ağ Trafik Akışı</div>
                  <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0 }}>
                    <path 
                      d={internetStatus === 'disabled' ? "M 0 95 L 400 95" : generatePath('download', 250)} 
                      fill="none" 
                      stroke="var(--primary)" 
                      strokeWidth="2.5"
                    />
                    <path 
                      d={internetStatus === 'disabled' ? "M 0 95 L 400 95" : generatePath('upload', 80)} 
                      fill="none" 
                      stroke="#0ea5e9" 
                      strokeWidth="1.5" 
                      strokeDasharray="4 2"
                    />
                  </svg>
                  {internetStatus === 'disabled' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 1, color: '#dc2626', fontWeight: 700, fontSize: '13px' }}>
                      <WifiOff size={24} />
                      <span>İnternet Bağlantısı Kesildi</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Access Control & Forbidden Sites */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Internet Toggle Card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>İnternet Erişimi</h3>
                  
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: internetStatus === 'enabled' ? '#ecfdf5' : '#fee2e2',
                    border: internetStatus === 'enabled' ? '1px solid #10b98130' : '1px solid #dc262630',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: internetStatus === 'enabled' ? '#10b98120' : '#dc262620',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: internetStatus === 'enabled' ? '#059669' : '#dc2626'
                      }}>
                        {internetStatus === 'enabled' ? <Wifi size={20} /> : <WifiOff size={20} />}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '14px', color: internetStatus === 'enabled' ? '#059669' : '#dc2626' }}>
                          {internetStatus === 'enabled' ? 'İnternet Erişimi AÇIK' : 'İnternet Erişimi KAPALI'}
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {internetStatus === 'enabled' ? 'Öğrenciler dış dünyaya erişebilir' : 'Ağ trafiği dış dünyaya engellendi'}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={handleToggleInternet}
                      className="btn-primary"
                      style={{
                        padding: '10px 16px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: internetStatus === 'enabled' ? '#dc2626' : '#10b981',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      {internetStatus === 'enabled' ? 'İnterneti Kapat' : 'İnterneti Aç'}
                    </button>
                  </div>
                </div>

                {/* Forbidden Websites Card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-text)' }}>Yasaklı Siteler (Kara Liste)</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Aşağıdaki alan adları öğrencilerin bilgisayarlarında sistem seviyesinde engellenecektir (Trafik yerel makineye yönlendirilir):
                  </p>

                  {/* Add Domain Form */}
                  <form onSubmit={handleAddForbiddenWebsite} style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      placeholder="Örn: facebook.com"
                      value={newForbiddenWebsite}
                      onChange={(e) => setNewForbiddenWebsite(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                    <button 
                      type="submit" 
                      className="btn-primary"
                      style={{ padding: '10px 16px', fontSize: '12px', fontWeight: 700 }}
                    >
                      Engelle
                    </button>
                  </form>

                  {/* Blocked Domains List */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {forbiddenWebsites.length === 0 ? (
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px' }}>Engellenmiş web sitesi yok.</span>
                    ) : (
                      forbiddenWebsites.map(domain => (
                        <div 
                          key={domain}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            backgroundColor: 'var(--color-background)',
                            fontSize: '13px'
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>{domain}</span>
                          <button 
                            onClick={() => handleRemoveForbiddenWebsite(domain)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: '#dc2626',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '2px 6px'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            Kaldır
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        );
      case 'clients':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">İstemci Listesi</h2>
              <div className="header-actions">
                <button className="btn-primary" onClick={() => sendToAll('lock')}>
                  <Lock size={18} /> Tümünü Kilitle
                </button>
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              {clients.length === 0 ? (
                <div className="empty-state">
                  <Monitor size={48} className="empty-icon" />
                  <p>Bağlı istemci bulunmuyor.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', paddingBottom: '10px' }}>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Hostname</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Bağlantı ID / IP</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Sürüm</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Durum</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(client => (
                      <tr key={client.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{client.hostname}</td>
                        <td style={{ padding: '16px 12px', color: 'var(--color-text-muted)' }}>{client.id}</td>
                        <td style={{ padding: '16px 12px', color: 'var(--color-text-muted)' }}>{client.version || 'v1.1.0'}</td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>Aktif</span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button className="action-btn" onClick={() => {
                              setActiveTerminalClients([client]);
                              setTerminalLines([]);
                            }} title="Terminal Aç">
                              <Terminal size={16} color="#0d9488" />
                            </button>
                            <button className="action-btn" onClick={() => sendCommand(client.id, 'lock')} title="Kilitle">
                              <Lock size={16} color="#475569" />
                            </button>
                            <button className="action-btn" onClick={() => sendCommand(client.id, 'sleep')} title="Uyku Modu">
                              <Moon size={16} color="#475569" />
                            </button>
                            <button className="action-btn" onClick={() => sendCommand(client.id, 'reboot')} title="Yeniden Başlat">
                              <RefreshCw size={16} color="#475569" />
                            </button>
                            <button className="action-btn danger" onClick={() => sendCommand(client.id, 'shutdown')} title="Kapat">
                              <PowerOff size={16} color="#dc2626" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      case 'screen':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Ekran İzleme</h2>
              <div className="header-actions">
                <span style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>Aktif Ekran Sayısı: {clients.length}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
              {clients.length === 0 ? (
                <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                  <MonitorPlay size={48} className="empty-icon" />
                  <p>Ekranı izlenecek bağlı istemci bulunmuyor.</p>
                </div>
              ) : (
                clients.map(client => {
                  const isSelected = selectedClientIds.includes(client.id);
                  return (
                    <div 
                      key={client.id} 
                      className={`client-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedClientIds(prev => prev.filter(id => id !== client.id));
                        } else {
                          setSelectedClientIds(prev => [...prev, client.id]);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRemoteControl(client);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(13, 148, 136, 0.3)';
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = isSelected ? 'var(--primary)' : 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.currentTarget.style.borderColor = isSelected ? 'var(--primary)' : 'var(--color-border)';
                        e.currentTarget.style.boxShadow = 'none';
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          const file = e.dataTransfer.files[0];
                          uploadFileToTarget(file, client.id);
                        }
                      }}
                      style={{ 
                        flexDirection: 'column', 
                        alignItems: 'stretch', 
                        gap: '12px', 
                        padding: '12px',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--color-border)',
                        borderRadius: '12px',
                        transition: 'all 0.2s',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '14px' }}>{client.hostname}</span>
                        <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 500 }}>Canlı</span>
                      </div>
                      {/* Real screen streaming with fallback */}
                      <div 
                        style={{ 
                          position: 'relative', 
                          height: '160px', 
                          borderRadius: '8px', 
                        overflow: 'hidden', 
                        border: '1px solid var(--color-border)', 
                        backgroundColor: '#0f172a',
                        cursor: 'pointer'
                      }}
                      title="Uzaktan Kontrolü Başlat"
                    >
                      {shareTechnology === 'set_tech_vnc' ? (
                        <VncViewer 
                          url={`ws://localhost:8080/ws/vnc-proxy?clientId=${encodeURIComponent(client.id)}&token=polyos-secure-token`}
                          viewOnly={true}
                          style={{ width: '100%', height: '100%' }}
                        />
                      ) : (
                        <>
                          <img 
                            src={`http://localhost:8080/api/screen?clientId=${encodeURIComponent(client.id)}&tick=${refreshTicker}`}
                            alt={`${client.hostname} ekranı`}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                            onLoad={(e) => {
                              e.currentTarget.style.display = 'block';
                              const fallback = e.currentTarget.nextSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'none';
                            }}
                          />
                          <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                            <MonitorPlay size={24} style={{ opacity: 0.5 }} />
                            <span>Ekran Akışı Bekleniyor...</span>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button className="action-btn" onClick={() => {
                        setActiveTerminalClients([client]);
                        setTerminalLines([]);
                      }} title="Terminal Aç">
                        <Terminal size={16} color="#0d9488" />
                      </button>
                      <button className="action-btn" onClick={() => sendCommand(client.id, 'lock')} title="Kilitle">
                        <Lock size={16} color="#475569" />
                      </button>
                      <button className="action-btn" onClick={() => sendCommand(client.id, 'sleep')} title="Uyku Modu">
                        <Moon size={16} color="#475569" />
                      </button>
                      <button className="action-btn" onClick={() => sendCommand(client.id, 'reboot')} title="Yeniden Başlat">
                        <RefreshCw size={16} color="#475569" />
                      </button>
                      <button className="action-btn danger" onClick={() => sendCommand(client.id, 'shutdown')} title="Kapat">
                        <PowerOff size={16} color="#dc2626" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        );
      case 'files':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Dosya Transferi</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('fileInput')?.click()}
                style={{ 
                  padding: '40px', 
                  border: '2px dashed var(--color-border)', 
                  borderRadius: '12px', 
                  textAlign: 'center', 
                  cursor: 'pointer', 
                  backgroundColor: 'var(--color-background)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                <input 
                  type="file" 
                  id="fileInput" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                />
                <FolderOpen size={48} style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                {selectedFile ? (
                  <div>
                    <p style={{ fontWeight: 600, margin: '0 0 4px 0', color: 'var(--primary)' }}>{selectedFile.name}</p>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Dosyayı değiştirmek için tıklayın veya sürükleyin
                    </span>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>Göndermek istediğiniz dosyaları sürükleyin</p>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>veya tıklayıp dosya seçin</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Hedef Seçin</label>
                <select 
                  value={targetClient}
                  onChange={(e) => setTargetClient(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', backgroundColor: '#fff', outline: 'none' }}
                >
                  {selectedClientIds.length > 0 && (
                    <option value="selected">Seçili İstemciler ({selectedClientIds.length} cihaz)</option>
                  )}
                  <option value="all">Tüm İstemciler ({clients.length} cihaz)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.hostname} ({c.id})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button 
                  className="btn-primary" 
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploadStatus === 'uploading'}
                  style={{ 
                    alignSelf: 'flex-start',
                    opacity: (!selectedFile || uploadStatus === 'uploading') ? 0.6 : 1,
                    cursor: (!selectedFile || uploadStatus === 'uploading') ? 'not-allowed' : 'pointer'
                  }}
                >
                  {uploadStatus === 'uploading' ? 'Gönderiliyor...' : 'Dosyaları Gönder'}
                </button>

                {uploadStatus === 'success' && (
                  <span style={{ color: '#059669', fontSize: '14px', fontWeight: 500 }}>✓ Dosya başarıyla gönderildi!</span>
                )}
                {uploadStatus === 'error' && (
                  <span style={{ color: '#dc2626', fontSize: '14px', fontWeight: 500 }}>✗ Dosya gönderilirken hata oluştu.</span>
                )}
              </div>
            </div>
          </div>
        );
      case 'wallpaper':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Masaüstü Duvar Kağıdı Kilidi</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '20px', maxWidth: '600px' }}>
              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 600, display: 'block', fontSize: '16px' }}>Duvar Kağıdını Kilitle</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Öğrencilerin duvar kağıdını değiştirmesini engeller (Varsayılan olarak aktiftir)</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                    <input 
                      type="checkbox" 
                      checked={wallpaperLocked}
                      onChange={(e) => handleWallpaperToggle(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: wallpaperLocked ? '#10b981' : '#64748b',
                      transition: '.3s',
                      borderRadius: '24px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '20px', width: '20px',
                        left: wallpaperLocked ? '26px' : '4px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '.3s',
                        borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontWeight: 600, fontSize: '15px' }}>Tüm Bilgisayarlar İçin Masaüstü Görseli Yükle</label>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>
                    Seçeceğiniz resim dosyası sunucuya yüklenecek, tüm öğrenci bilgisayarlarına gönderilecek ve masaüstü resmi olarak ayarlanıp kilitlenecektir.
                  </p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <input 
                      type="file" 
                      accept="image/*"
                      id="wallpaper-upload-input"
                      onChange={handleWallpaperUpload}
                      disabled={isUploadingWallpaper}
                      style={{ display: 'none' }}
                    />
                    <button 
                      className="btn-primary" 
                      onClick={() => document.getElementById('wallpaper-upload-input')?.click()}
                      disabled={isUploadingWallpaper}
                      style={{ backgroundColor: '#3b82f6' }}
                    >
                      {isUploadingWallpaper ? 'Görsel Yükleniyor...' : 'Görsel Seç ve Yükle'}
                    </button>
                    {isUploadingWallpaper && <span style={{ fontSize: '13px', color: '#3b82f6' }}>Yükleniyor...</span>}
                  </div>

                  {wallpaperPath && (
                    <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>Aktif Kilitli Duvar Kağıdı Önizlemesi:</span>
                      <img 
                        src={`http://localhost:8080${wallpaperPath}`} 
                        alt="Kilitli Duvar Kağıdı" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: '#000' }}
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">PolyOS Lab Sunucu Ayarları</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '20px', maxWidth: '600px' }}>
              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: 600, display: 'block' }}>Sunucu Durumu</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Öğretmen bilgisayarındaki PolyOS Lab sunucusu</span>
                </div>
                <span style={{ 
                  backgroundColor: serverState.status === 'running' ? '#ecfdf5' : '#fee2e2', 
                  color: serverState.status === 'running' ? '#059669' : '#dc2626', 
                  padding: '6px 12px', 
                  borderRadius: '20px', 
                  fontSize: '13px', 
                  fontWeight: 600 
                }}>
                  {serverState.status === 'running' ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Sunucu Portu</label>
                <input 
                  type="text" 
                  value={inputPort} 
                  onChange={(e) => setInputPort(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {serverState.status === 'stopped' ? (
                  <button className="btn-primary" onClick={() => controlServer('start')}>
                    Sunucuyu Başlat
                  </button>
                ) : (
                  <>
                    <button className="btn-primary" onClick={() => controlServer('restart')} style={{ backgroundColor: '#3b82f6' }}>
                      Yeniden Başlat
                    </button>
                    <button className="btn-primary" onClick={() => controlServer('stop')} style={{ backgroundColor: '#dc2626' }}>
                      Sunucuyu Durdur
                    </button>
                  </>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Pardus Ekran Akış Kalitesi</label>
                <select 
                  value={streamQuality}
                  onChange={(e) => handleQualityChange(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', backgroundColor: '#fff', outline: 'none' }}
                >
                  <option value="quality_low">Düşük (%15)</option>
                  <option value="quality_medium">Orta (%30)</option>
                  <option value="quality_high">Yüksek (%60)</option>
                </select>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Ekran Yansıtma Teknolojisi</label>
                <select 
                  value={shareTechnology}
                  onChange={(e) => handleShareTechChange(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', backgroundColor: '#fff', outline: 'none' }}
                >
                  <option value="set_tech_vnc">TigerVNC (Önerilen)</option>
                  <option value="set_tech_python">Yerel Python Tkinter (Tam Ekran Garantili)</option>
                  <option value="set_tech_browser">Kiosk Tarayıcı (Firefox / Chrome)</option>
                </select>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Varsayılan Açılış Sekmesi</label>
                <select 
                  value={defaultStartTab}
                  onChange={(e) => handleDefaultStartTabChange(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', backgroundColor: '#fff', outline: 'none' }}
                >
                  <option value="summary">Laboratuvar Özeti</option>
                  <option value="health_map">Sağlık Haritası</option>
                  <option value="quick_actions">Hızlı İşlemler</option>
                  <option value="network_management">Ağ Yönetimi</option>
                  <option value="clients">İstemci Listesi</option>
                  <option value="screen">Ekran İzleme</option>
                  <option value="files">Dosya Transferi</option>
                  <option value="polyos_wake">PolyOS Wake</option>
                  <option value="logs">Sistem Logları</option>
                  <option value="wallpaper">Duvar Kağıdı Kilidi</option>
                  <option value="settings">Ayarlar</option>
                </select>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />

              <div style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: 600, display: 'block' }}>Masaüstü Duvar Kağıdı Kilidi</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Öğrencilerin duvar kağıdını değiştirmesini engeller</span>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '46px', height: '24px' }}>
                    <input 
                      type="checkbox" 
                      checked={wallpaperLocked}
                      onChange={(e) => handleWallpaperToggle(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: wallpaperLocked ? '#3b82f6' : '#ccc',
                      transition: '.3s',
                      borderRadius: '24px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '18px', width: '18px',
                        left: wallpaperLocked ? '24px' : '4px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        transition: '.3s',
                        borderRadius: '50%'
                      }} />
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: 600, fontSize: '14px' }}>Duvar Kağıdı Resmi Yükle</label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleWallpaperUpload}
                    disabled={isUploadingWallpaper}
                    style={{ fontSize: '13px' }}
                  />
                  {isUploadingWallpaper && <span style={{ fontSize: '12px', color: '#3b82f6' }}>Resim yükleniyor ve kilitleniyor...</span>}
                  
                  {wallpaperPath && (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>Aktif Kilitli Resim Önizlemesi:</span>
                      <img 
                        src={`http://localhost:8080${wallpaperPath}`} 
                        alt="Kilitli Duvar Kağıdı" 
                        style={{ width: '120px', height: '75px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '10px 0' }} />

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Öğretmen Adı</label>
                <input 
                  type="text" 
                  value={teacherName} 
                  onChange={(e) => {
                    setTeacherName(e.target.value);
                    localStorage.setItem('polyos_teacher_name', e.target.value);
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Görevi / Ünvanı</label>
                <input 
                  type="text" 
                  value={teacherRole} 
                  onChange={(e) => {
                    setTeacherRole(e.target.value);
                    localStorage.setItem('polyos_teacher_role', e.target.value);
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' }} 
                />
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '15px 0' }} />

              <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background-soft, #f8fafc)' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform ve Sistem Bilgileri</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Ürün Adı:</span>
                    <span style={{ fontWeight: 600 }}>PolyOS Lab</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Sürüm (Version):</span>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>v1.5.1</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Geliştirici (Developer):</span>
                    <span style={{ fontWeight: 600 }}>Emirhan Gök (PolyOS Dev)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.03)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Proje Reposu (Repository):</span>
                    <a href="https://github.com/Emiran404/PolyOS-Lab" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}>GitHub / PolyOS-Lab</a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Teknoloji Altyapısı:</span>
                    <span style={{ fontWeight: 500, color: 'var(--color-text-muted)' }}>React / Vite / Electron / Go (Golang)</span>
                  </div>
                </div>
              </div>

              <div className="danger-zone">
                <h3 className="danger-zone-title">⚠️ Tehlikeli Bölge</h3>
                <p className="danger-zone-desc">Uygulama ayarlarını ve öğretmen profil verilerini sıfırlayabilirsiniz. Bu işlem sizi Hoş Geldiniz ekranına geri döndürecektir.</p>
                <button className="btn-danger" onClick={handleResetSystem}>Sistemi Sıfırla</button>
              </div>
            </div>
          </div>
        );
      case 'polyos_wake':
        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title">PolyOS Wake</h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Önceden bağlanmış olan bilgisayarları uyandırın, kapatın veya yönetin.
                </p>
              </div>
              {devices && devices.length > 0 && devices.every(device => device.isOnline) ? (
                <button className="btn-primary" onClick={() => sendToAll('shutdown')} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#dc2626' }}>
                  <Power size={18} /> Topluca Kapat
                </button>
              ) : (
                <button className="btn-primary" onClick={() => triggerWake('all')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Power size={18} /> Topluca Uyandır
                </button>
              )}
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              backgroundColor: '#fffbeb', 
              border: '1px solid #fef3c7', 
              borderRadius: '8px', 
              padding: '12px 16px', 
              marginTop: '16px', 
              color: '#b45309' 
            }}>
              <AlertCircle size={20} color="#d97706" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong>Önemli Bilgi:</strong> Bilgisayarları uzaktan açabilmek (WOL) için hedef cihazların anakart (BIOS) ayarlarında <strong>Wake-on-LAN (WOL)</strong> özelliğinin aktif olması ve bilgisayarların kablolu (Ethernet) ağ bağlantısı üzerinden bağlı olması gerekmektedir.
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              {!devices || devices.length === 0 ? (
                <div className="empty-state">
                  <Monitor size={48} className="empty-icon" />
                  <p>Kayıtlı cihaz bulunmuyor. İstemciler bağlandıkça buraya kaydedilecektir.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)', paddingBottom: '10px' }}>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Hostname</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>MAC Adresi</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Son IP</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Son Görülme</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Durum</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map(device => (
                      <tr key={device.mac} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{device.hostname}</td>
                        <td style={{ padding: '16px 12px', fontFamily: 'monospace' }}>{device.mac}</td>
                        <td style={{ padding: '16px 12px', color: 'var(--color-text-muted)' }}>{device.ip}</td>
                        <td style={{ padding: '16px 12px', fontSize: '13px' }}>
                          {new Date(device.lastSeen).toLocaleString('tr-TR')}
                        </td>
                        <td style={{ padding: '16px 12px' }}>
                          {device.isOnline ? (
                            <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>Çevrimiçi</span>
                          ) : (
                            <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>Çevrimdışı</span>
                          )}
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {!device.isOnline && (
                              <button className="action-btn" onClick={() => triggerWake(device.mac)} title="Sihirli Paket (WOL) Gönder">
                                <Power size={16} color="#059669" />
                              </button>
                            )}
                            <button className="action-btn danger" onClick={() => deleteDevice(device.mac)} title="Kayıttan Sil">
                              <PowerOff size={16} color="#dc2626" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      case 'health_map':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="page-header" style={{ marginBottom: 0 }}>
              <div>
                <h1 className="greeting">Donanım ve Ağ Sağlığı Haritası</h1>
                <p className="sub-greeting">Laboratuvardaki cihazların donanım yüklerini ve sıcaklık durumlarını anlık takip edin</p>
              </div>
            </div>

            {/* Health Summary Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-blue">
                  <Cpu size={24} color="#3b82f6" />
                </div>
                <div className="stat-value">%
                  {clients.length > 0
                    ? Math.round(clients.reduce((acc, c) => acc + (telemetryData[c.id]?.cpuUsage || 0), 0) / clients.length)
                    : 0}
                </div>
                <div className="stat-label">Ortalama CPU Yükü</div>
                <div className="stat-detail">Bağlı tüm istemciler</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-yellow">
                  <Thermometer size={24} color="#f59e0b" />
                </div>
                <div className="stat-value">
                  {clients.length > 0
                    ? (clients.reduce((acc, c) => acc + (telemetryData[c.id]?.cpuTemp || 0), 0) / clients.length).toFixed(1)
                    : "0.0"}°C
                </div>
                <div className="stat-label">Ortalama Sıcaklık</div>
                <div className="stat-detail">İşlemci sıcaklığı</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-green">
                  <CheckCircle size={24} color="#10b981" />
                </div>
                <div className="stat-value">
                  {totalUsedRam.toFixed(2)} GB
                </div>
                <div className="stat-label">Toplam Bellek Kullanımı</div>
                <div className="stat-detail">Kullanılan / Toplam: {totalUsedRam.toFixed(1)} / {totalRamAll.toFixed(1)} GB</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-purple">
                  <HardDrive size={24} color="#8b5cf6" />
                </div>
                <div className="stat-value">
                  {totalUsedDisk.toFixed(1)} / {totalDiskAll.toFixed(0)} GB
                </div>
                <div className="stat-label">Laboratuvar Toplam Disk</div>
                <div className="stat-detail">Kullanılan / Toplam Kapasite</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h2 className="card-title">Cihaz Donanım Durumları</h2>
              </div>
              <div style={{ marginTop: '20px' }}>
                {clients.length === 0 ? (
                  <div className="empty-state">
                    <Monitor size={48} className="empty-icon" />
                    <p>Bağlı istemci bulunmuyor.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {clients.map(client => {
                      const rawTel = telemetryData[client.id];
                      const tel = {
                        cpuUsage: typeof rawTel?.cpuUsage === 'number' ? rawTel.cpuUsage : 0,
                        cpuTemp: typeof rawTel?.cpuTemp === 'number' ? rawTel.cpuTemp : 45,
                        ramUsage: typeof rawTel?.ramUsage === 'number' ? rawTel.ramUsage : 0,
                        diskUsage: typeof rawTel?.diskUsage === 'number' ? rawTel.diskUsage : 0,
                        totalRam: typeof rawTel?.totalRam === 'number' ? rawTel.totalRam : 16.0,
                        usedRam: typeof rawTel?.usedRam === 'number' ? rawTel.usedRam : (16.0 * (rawTel?.ramUsage ?? 0) / 100),
                        totalDisk: typeof rawTel?.totalDisk === 'number' ? rawTel.totalDisk : 250.0,
                        usedDisk: typeof rawTel?.usedDisk === 'number' ? rawTel.usedDisk : (250.0 * (rawTel?.diskUsage ?? 0) / 100),
                      };
                      const isOverheating = tel.cpuUsage >= 95.0 && tel.cpuTemp >= 75.0;
                      
                      const getProgressColor = (val: number) => {
                        if (val >= 90) return '#dc2626'; // Red
                        if (val >= 70) return '#f59e0b'; // Orange/Yellow
                        return '#10b981'; // Green
                      };

                      return (
                        <div 
                          key={client.id} 
                          style={{ 
                            padding: '20px', 
                            borderRadius: '12px', 
                            border: isOverheating ? '2px solid #dc2626' : '1px solid var(--color-border)', 
                            backgroundColor: isOverheating ? '#fef2f2' : '#fff',
                            boxShadow: isOverheating ? '0 4px 15px rgba(220, 38, 38, 0.1)' : 'none',
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '16px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {/* Card Top: Client Info and Quick Actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{client.hostname}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: '10px' }}>({client.id})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {isOverheating && (
                                <span style={{
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  animation: 'pulse 1.5s infinite',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <AlertCircle size={14} /> Aşırı Isınıyor!
                                </span>
                              )}
                              <button 
                                className="btn-primary" 
                                onClick={() => {
                                  setActiveTerminalClients([client]);
                                  setTerminalLines([]);
                                }}
                                style={{ 
                                  padding: '6px 12px', 
                                  fontSize: '12px', 
                                  backgroundColor: isOverheating ? '#dc2626' : '#1e293b',
                                  boxShadow: 'none'
                                }}
                              >
                                <Terminal size={14} /> Terminal Aç
                              </button>
                            </div>
                          </div>

                          {/* Card Grid: Hardware gauges */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                            {/* CPU */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                                  <Cpu size={14} /> İşlemci (CPU)
                                </span>
                                <span style={{ color: getProgressColor(tel.cpuUsage) }}>%{tel.cpuUsage.toFixed(1)}</span>
                              </div>
                              <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${tel.cpuUsage}%`, backgroundColor: getProgressColor(tel.cpuUsage), borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
                              </div>
                            </div>

                            {/* CPUTemp */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                                  <Thermometer size={14} /> Sıcaklık
                                </span>
                                <span style={{ color: tel.cpuTemp >= 75 ? '#dc2626' : tel.cpuTemp >= 60 ? '#f59e0b' : '#10b981' }}>
                                  {tel.cpuTemp.toFixed(1)}°C
                                </span>
                              </div>
                              <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, (tel.cpuTemp / 100) * 100)}%`, backgroundColor: tel.cpuTemp >= 75 ? '#dc2626' : tel.cpuTemp >= 60 ? '#f59e0b' : '#10b981', borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
                              </div>
                            </div>

                            {/* RAM */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                                  <CheckCircle size={14} /> RAM
                                </span>
                                <span style={{ color: getProgressColor(tel.ramUsage) }}>
                                  {tel.usedRam.toFixed(2)} / {tel.totalRam.toFixed(1)} GB (%{tel.ramUsage.toFixed(0)})
                                </span>
                              </div>
                              <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${tel.ramUsage}%`, backgroundColor: getProgressColor(tel.ramUsage), borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
                              </div>
                            </div>

                            {/* Disk */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                                  <HardDrive size={14} /> Disk
                                </span>
                                <span style={{ color: getProgressColor(tel.diskUsage) }}>
                                  {tel.usedDisk.toFixed(1)} / {tel.totalDisk.toFixed(0)} GB (%{tel.diskUsage.toFixed(0)})
                                </span>
                              </div>
                              <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${tel.diskUsage}%`, backgroundColor: getProgressColor(tel.diskUsage), borderRadius: '4px', transition: 'width 0.5s ease-in-out' }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'logs':
        return (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="card-title">Sistem Log Kayıtları</h2>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  PolyOS Lab sunucusu ve bağlı istemcilerin canlı olay günlükleri.
                </p>
              </div>
              <button 
                className="btn-primary" 
                onClick={() => setLogs([])}
                style={{ backgroundColor: '#dc2626' }}
              >
                Temizle
              </button>
            </div>
            <div style={{ marginTop: '20px' }}>
              <div style={{
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                fontFamily: 'monospace',
                padding: '16px',
                borderRadius: '12px',
                height: '450px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column-reverse',
              }}>
                <div>
                  {logs.length === 0 ? (
                    <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '150px' }}>
                      Log kaydı bulunmuyor. Canlı hareketler bekleniyor...
                    </div>
                  ) : (
                    logs.map((logLine, index) => (
                      <div key={index} style={{ borderBottom: '1px solid #1e293b', padding: '4px 0' }}>
                        {logLine}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="layout">
      {(!isOnboarded || isOnboardingFadingOut) && (
        <div className={`onboarding-wrapper ${isOnboardingFadingOut ? 'fade-out' : ''}`}>
          <div className="onboarding-card">
            <div className="onboarding-logo">🏫</div>
            <h1 className="onboarding-title">PolyOS Lab'a Hoş Geldiniz</h1>
            <p className="onboarding-subtitle">
              Eğitim kurumları ve bilgisayar laboratuvarları için modern yönetim ekosistemi. Başlamak için lütfen bilgilerinizi girin.
            </p>
            
            <form className="onboarding-form" onSubmit={(e) => {
              e.preventDefault();
              setIsOnboardingLoading(true);
              setTimeout(() => {
                setIsOnboardingLoading(false);
                setIsOnboardingFadingOut(true);
                setTimeout(() => {
                  handleOnboardingSubmit(onboardName, onboardRole);
                  setIsOnboardingFadingOut(false);
                }, 500);
              }, 1500);
            }}>
              <div className="onboarding-group">
                <label className="onboarding-label" htmlFor="teacher-name">Öğretmen Adı / Soyadı</label>
                <input
                  id="teacher-name"
                  className="onboarding-input"
                  type="text"
                  value={onboardName}
                  onChange={(e) => setOnboardName(e.target.value)}
                  placeholder="Örn. Emirhan Gök"
                  required
                  disabled={isOnboardingLoading}
                />
              </div>
              
              <div className="onboarding-group">
                <label className="onboarding-label" htmlFor="teacher-role">Görevi / Ünvanı</label>
                <input
                  id="teacher-role"
                  className="onboarding-input"
                  type="text"
                  value={onboardRole}
                  onChange={(e) => setOnboardRole(e.target.value)}
                  placeholder="Örn. Sistem Yöneticisi veya Bilgisayar Öğretmeni"
                  required
                  disabled={isOnboardingLoading}
                />
              </div>
              
              <button className="onboarding-btn" type="submit" disabled={isOnboardingLoading}>
                {isOnboardingLoading ? (
                  <>
                    <RefreshCw size={18} className="spinner" />
                    Sistem Yapılandırılıyor...
                  </>
                ) : (
                  <>
                    Kurulumu Tamamla
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-logo">
          <div className="logo-text">
            <span className="logo-icon">🏫</span>
            {sidebarOpen && <span className="brand-text">PolyOS Lab</span>}
          </div>
          <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <div className="user-section">
          <div className="avatar">{teacherName ? teacherName.charAt(0).toUpperCase() : 'E'}</div>
          {sidebarOpen && (
            <div className="user-info">
              <div className="user-name">{teacherName}</div>
              <div className="user-role">{teacherRole}</div>
            </div>
          )}
        </div>

        <nav className="nav-menu">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="logout-section">
          <button className="logout-btn">
            <LogOut size={20} />
            {sidebarOpen && <span>Çıkış Yap</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="dashboard-container">
          {/* Overheating Critical Alerts */}
          {overheatingClients.map(client => (
            <div key={client.id} className="overheat-alert-banner" style={{
              background: 'linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)',
              border: '1px solid #fca5a5',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(220, 38, 38, 0.1)',
              animation: 'pulse 2s infinite'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626'
                }}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <strong style={{ color: '#991b1b', fontSize: '14px', display: 'block' }}>
                    ⚠️ Kritik Durum: {client.hostname} Aşırı Isınıyor!
                  </strong>
                  <span style={{ color: '#7f1d1d', fontSize: '12px' }}>
                    Cihaz işlemcisi tam yük altında (%{(telemetryData[client.id]?.cpuUsage ?? 0).toFixed(1)}) ve sıcaklığı tehlikeli seviyede ({(telemetryData[client.id]?.cpuTemp ?? 0).toFixed(1)}°C).
                  </span>
                </div>
              </div>
              <button 
                className="btn-primary" 
                onClick={() => {
                  setActiveTerminalClients([client]);
                  setTerminalLines([]);
                }}
                style={{
                  backgroundColor: '#dc2626',
                  fontSize: '12px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  boxShadow: 'none'
                }}
              >
                Terminal Aç (Sorunu Çöz)
              </button>
            </div>
          ))}

          {renderContent()}
        </div>
      </main>

      {controlClient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Modal Header */}
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#1e293b',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#fff'
          }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '16px' }}>Uzaktan Kontrol: {controlClient.hostname}</span>
              <span style={{ fontSize: '13px', color: '#94a3b8', marginLeft: '12px' }}>({controlClient.id})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <input 
                type="text" 
                placeholder="Pano içeriği (kopyalanacak)..." 
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSyncClipboard();
                  }
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  width: '200px'
                }}
              />
              <button 
                onClick={handleSyncClipboard}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Pano Gönder
              </button>
              <button 
                onClick={stopRemoteControl}
                style={{
                  backgroundColor: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Bağlantıyı Kes
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflow: 'hidden'
          }}>
            {shareTechnology === 'set_tech_vnc' ? (
              <VncViewer 
                url={`ws://localhost:8080/ws/vnc-proxy?clientId=${encodeURIComponent(controlClient.id)}&token=polyos-secure-token`}
                viewOnly={false}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '8px',
                  border: '2px solid #334155',
                  backgroundColor: '#000'
                }}
              />
            ) : (
              <img 
                src={`http://localhost:8080/api/screen?clientId=${encodeURIComponent(controlClient.id)}&tick=${rcTicker}`}
                alt="Remote Screen"
                onMouseDown={handleMouseClick}
                onContextMenu={(e) => { e.preventDefault(); handleMouseClick(e); }}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  border: '2px solid #334155',
                  cursor: 'crosshair',
                  backgroundColor: '#000'
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Web Sitesi Aç Modal */}
      {webUrlModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '450px',
            padding: '24px',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Web Sitesi Aç</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Seçili öğrencilerin bilgisayarlarında açılacak olan web sitesi adresini girin:</p>
            <input 
              type="text" 
              placeholder="https://example.com" 
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleOpenUrlSubmit(targetUrl);
                  setWebUrlModalOpen(false);
                  setTargetUrl('');
                } else if (e.key === 'Escape') {
                  setWebUrlModalOpen(false);
                  setTargetUrl('');
                }
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button 
                onClick={() => {
                  setWebUrlModalOpen(false);
                  setTargetUrl('');
                }}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                İptal
              </button>
              <button 
                onClick={() => {
                  handleOpenUrlSubmit(targetUrl);
                  setWebUrlModalOpen(false);
                  setTargetUrl('');
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#3b82f6' }}
              >
                Aç
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mesaj Gönder Modal */}
      {messageModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '450px',
            padding: '24px',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Öğrencilere Mesaj Gönder</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Seçili öğrencilerin ekranlarında gösterilecek olan mesajı yazın:</p>
            <input 
              ref={messageInputRef}
              type="text"
              placeholder="Ders başladı, lütfen tarayıcılarınızı kapatın..." 
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessageSubmit(messageText);
                  setMessageModalOpen(false);
                  setMessageText('');
                } else if (e.key === 'Escape') {
                  setMessageModalOpen(false);
                  setMessageText('');
                }
              }}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button 
                onClick={() => {
                  setMessageModalOpen(false);
                  setMessageText('');
                }}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                İptal
              </button>
              <button 
                onClick={() => {
                  handleSendMessageSubmit(messageText);
                  setMessageModalOpen(false);
                  setMessageText('');
                }}
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#8b5cf6' }}
              >
                Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uzaktan Root Terminali Modal */}
      {activeTerminalClients.length > 0 && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '900px',
            height: '80vh',
            backgroundColor: '#0b0f19',
            borderRadius: '16px',
            border: '1px solid #1e293b',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(13, 148, 136, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#0f172a',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 8px #10b981'
                }} />
                <div>
                  <span style={{ fontWeight: 700, fontSize: '15px', fontFamily: 'monospace' }}>Uzaktan Root Terminali</span>
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '12px', fontFamily: 'monospace' }}>
                    ({activeTerminalClients.length} Cihaz Seçili: {activeTerminalClients.map(c => c.hostname).join(', ')})
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  onClick={() => setTerminalLines([])}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#94a3b8',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                >
                  Ekranı Temizle
                </button>
                <button 
                  onClick={() => setActiveTerminalClients([])}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                >
                  Kapat
                </button>
              </div>
            </div>

            {/* Terminal Lines Container */}
            <div style={{
              flex: 1,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
              fontSize: '14px',
              color: '#38bdf8',
              lineHeight: '1.5'
            }}>
              <div style={{ color: '#64748b', fontSize: '12px', borderBottom: '1px dashed #1e293b', paddingBottom: '8px', marginBottom: '8px' }}>
                * Bilişim Teknolojileri Öğretmen Paneli Uzaktan Yönetim Terminali.<br/>
                * Girilen komutlar hedef bilgisayarlarda root yetkisiyle doğrudan çalıştırılır. Lütfen dikkatli olun.
              </div>
              {terminalLines.length === 0 ? (
                <div style={{ color: '#475569', fontStyle: 'italic' }}>Komut çıktısı bekleniyor...</div>
              ) : (
                terminalLines.map((line, index) => {
                  let color = '#38bdf8'; // Default cyan
                  if (line.startsWith('$ ')) {
                    color = '#f1f5f9'; // User input command: white
                  } else if (line.includes('error') || line.includes('Hata') || line.includes('failed') || line.includes('Erişilemedi')) {
                    color = '#f87171'; // Error: red
                  } else if (line.includes('[') && line.includes(']')) {
                    color = '#4ade80'; // Success output: green
                  }
                  return (
                    <div key={index} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {line}
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>

            {/* Terminal Input Form */}
            <form onSubmit={handleTerminalSubmit} style={{
              padding: '16px 24px',
              backgroundColor: '#0f172a',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{
                fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
                color: '#10b981',
                fontWeight: 700,
                fontSize: '14px',
                whiteSpace: 'nowrap'
              }}>
                root@polyos-lab:~#
              </span>
              <input 
                ref={terminalInputRef}
                type="text"
                placeholder="Komut girin (örn: systemctl restart lightdm, reboot, apt update)..."
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f8fafc',
                  fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
                  fontSize: '14px',
                  caretColor: '#10b981'
                }}
                autoFocus
              />
            </form>
          </div>
        </div>
      )}
      {activeToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: '#10b981',
          color: '#fff',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '320px',
          boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: '20px' }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em' }}>{toastTitle}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>{activeToast}</div>
          </div>
          <button 
            onClick={() => setActiveToast(null)} 
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              opacity: 0.7,
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
