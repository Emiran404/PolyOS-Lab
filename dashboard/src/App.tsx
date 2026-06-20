import { useState, useEffect } from 'react';
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
  ChevronLeft,
  Zap,
  Globe,
  MessageSquare,
  Network,
  WifiOff,
  Moon,
  Terminal
} from 'lucide-react';
import './App.css';

interface Client {
  id: string;
  hostname: string;
}

function App() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeTab, setActiveTab] = useState('summary');
  const [logs, setLogs] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshTicker, setRefreshTicker] = useState(0);

  // Canlı Log Kayıtlarını Dinleme
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectLogs = () => {
      ws = new WebSocket('ws://localhost:8080/ws/logs');
      
      ws.onmessage = (event) => {
        setLogs(prev => {
          const newLogs = [...prev, `${new Date().toLocaleTimeString('tr-TR')} - ${event.data}`];
          if (newLogs.length > 200) {
            return newLogs.slice(newLogs.length - 200);
          }
          return newLogs;
        });
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

  // Hızlı İşlemler (Epoptes) State'leri
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [webUrlModalOpen, setWebUrlModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');

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

  // Telemetri Canlı Veri Simülasyonu
  useEffect(() => {
    if (activeTab !== 'network_management') return;
    const interval = setInterval(() => {
      setTelemetry(prev => {
        if (internetStatus === 'disabled') {
          return {
            download: 0.0,
            upload: 0.0,
            latency: 999,
            packetLoss: 100.0,
            jitter: 0.0
          };
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    
    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('target', targetClient);

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

  // İstemcileri her 2 saniyede bir çek
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/clients');
        const data = await response.json();
        setClients(data);
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      }
    };
    
    fetchClients();
    const interval = setInterval(fetchClients, 2000);
    return () => clearInterval(interval);
  }, []);

  // Cihazları (PolyOS Wake) çek
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/devices');
        const data = await response.json();
        setDevices(data);
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
      
      const ws = new WebSocket('ws://localhost:8080/ws/teacher');
      setTeacherWs(ws);
      
      ws.onopen = () => {
        console.log("Teacher screen share WebSocket opened.");
        sendToAll("screen_share_on");
        
        const video = document.createElement('video');
        video.srcObject = stream;
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
      await fetch('http://localhost:8080/api/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, command }),
      });
    } catch (error) {
      console.error("Failed to send command:", error);
    }
  };

  const sendToAll = (command: string) => {
    clients.forEach(c => sendCommand(c.id, command));
  };

  const handleQualityChange = (newQuality: string) => {
    setStreamQuality(newQuality);
    sendToAll(newQuality);
  };

  const sendCommandToSelected = (command: string) => {
    if (selectedClientIds.length === 0) {
      alert("Lütfen en az bir istemci seçin.");
      return;
    }
    selectedClientIds.forEach(id => sendCommand(id, command));
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
    { icon: Zap, label: 'Hızlı İşlemler', id: 'quick_actions' },
    { icon: Network, label: 'Ağ Yönetimi', id: 'network_management' },
    { icon: Monitor, label: 'İstemci Listesi', id: 'clients' },
    { icon: MonitorPlay, label: 'Ekran İzleme', id: 'screen' },
    { icon: FolderOpen, label: 'Dosya Transferi', id: 'files' },
    { icon: Power, label: 'PolyOS Wake', id: 'polyos_wake' },
    { icon: Terminal, label: 'Sistem Logları', id: 'logs' },
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
                <h1 className="greeting">Hoş Geldiniz, Emirhan Gök 👋</h1>
                <p className="sub-greeting">PolyOS Lab Yönetim Paneli • {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="header-actions">
                <button className="btn-secondary">
                  <HelpCircle size={18} />
                  Yardım
                </button>
                <button className="btn-primary" onClick={() => triggerWake('all')}>
                  <Power size={18} />
                  Tümünü Uyandır
                </button>
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
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-yellow">
                  <AlertCircle size={24} color="#f59e0b" />
                </div>
                <div className="stat-value">0</div>
                <div className="stat-label">Uyarı / Hata</div>
                <div className="stat-detail">Son 24 saat</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper bg-purple">
                  <MonitorUp size={24} color="#8b5cf6" />
                </div>
                <div className="stat-value">%100</div>
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
                          Aktif
                        </div>

                        <div className="client-actions">
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

              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Seçili: {selectedClientIds.length} / {clients.length} İstemci
              </div>
            </div>

            {/* Clients grid with live screen preview and selection checkbox */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
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
                      d={`M 0 80 Q 50 ${60 + (Math.random() - 0.5) * 15} 100 ${70 + (Math.random() - 0.5) * 15} T 200 ${50 + (Math.random() - 0.5) * 20} T 300 ${80 + (Math.random() - 0.5) * 10} T 400 ${internetStatus === 'disabled' ? 100 : 40}`} 
                      fill="none" 
                      stroke="var(--primary)" 
                      strokeWidth="2.5"
                    />
                    <path 
                      d={`M 0 85 Q 50 ${75 + (Math.random() - 0.5) * 10} 100 ${80 + (Math.random() - 0.5) * 10} T 200 ${65 + (Math.random() - 0.5) * 15} T 300 ${85 + (Math.random() - 0.5) * 5} T 400 ${internetStatus === 'disabled' ? 100 : 55}`} 
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
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Durum</th>
                      <th style={{ padding: '12px', color: 'var(--color-text-secondary)', textAlign: 'right' }}>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map(client => (
                      <tr key={client.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{client.hostname}</td>
                        <td style={{ padding: '16px 12px', color: 'var(--color-text-muted)' }}>{client.id}</td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>Aktif</span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                clients.map(client => (
                  <div key={client.id} className="client-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{client.hostname}</span>
                      <span style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 500 }}>Canlı</span>
                    </div>
                    {/* Real screen streaming with fallback */}
                    <div 
                      onClick={() => startRemoteControl(client)}
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
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                  <option value="quality_low">Düşük (Hızlı)</option>
                  <option value="quality_medium">Orta (Önerilen)</option>
                  <option value="quality_high">Yüksek (Ayrıntılı)</option>
                </select>
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
              <button className="btn-primary" onClick={() => triggerWake('all')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Power size={18} /> Topluca Uyandır
              </button>
            </div>
            <div style={{ marginTop: '20px' }}>
              {devices.length === 0 ? (
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
          <div className="avatar">E</div>
          {sidebarOpen && (
            <div className="user-info">
              <div className="user-name">Emirhan Gök</div>
              <div className="user-role">Sistem Yöneticisi</div>
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
            <textarea 
              placeholder="Ders başladı, lütfen tarayıcılarınızı kapatın..." 
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{
                width: '100%',
                height: '100px',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                fontSize: '14px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
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
    </div>
  );
}

export default App;
