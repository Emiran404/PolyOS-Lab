package main

import (
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for the dashboard
	},
}

var authToken = "polyos-secure-token"

var wallpaperLocked = true
var currentWallpaper = "" // e.g. "/uploads/locked-wallpaper.jpg"
var wallpaperMutex sync.Mutex

var logClients = make(map[*websocket.Conn]bool)
var logMutex sync.Mutex

var logHistory []string
var logHistoryMutex sync.Mutex

type TelemetryData struct {
	CPUUsage  float64 `json:"cpuUsage"`
	CPUTemp   float64 `json:"cpuTemp"`
	RAMUsage  float64 `json:"ramUsage"`
	DiskUsage float64 `json:"diskUsage"`
	TotalRAM  float64 `json:"totalRam"`
	UsedRAM   float64 `json:"usedRam"`
	TotalDisk float64 `json:"totalDisk"`
	UsedDisk  float64 `json:"usedDisk"`
}

var clientTelemetry = make(map[string]TelemetryData)
var telemetryMutex sync.Mutex

var terminalClients = make(map[*websocket.Conn]bool)
var terminalMutex sync.Mutex

type Client struct {
	ID       string
	Hostname string
	MAC      string
	Version  string
	Conn     *websocket.Conn
}

type Device struct {
	Hostname string    `json:"hostname"`
	MAC      string    `json:"mac"`
	IP       string    `json:"ip"`
	LastSeen time.Time `json:"lastSeen"`
}

func getDevicesFilePath() string {
	home, err := os.UserHomeDir()
	if err == nil {
		dir := filepath.Join(home, ".config", "polyos-lab")
		if errMkdir := os.MkdirAll(dir, 0755); errMkdir == nil {
			return filepath.Join(dir, "devices.json")
		}
	}
	dir := filepath.Join(os.TempDir(), "polyos-lab")
	_ = os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "devices.json")
}

func loadDevices() map[string]*Device {
	devices := make(map[string]*Device)
	data, err := os.ReadFile(getDevicesFilePath())
	if err == nil {
		_ = json.Unmarshal(data, &devices)
	}
	return devices
}

func saveDevice(mac, hostname, ip string) {
	if mac == "" {
		return
	}
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	if ip == "[::1]" || ip == "" {
		ip = "127.0.0.1"
	}

	devices := loadDevices()
	devices[mac] = &Device{
		Hostname: hostname,
		MAC:      mac,
		IP:       ip,
		LastSeen: time.Now(),
	}
	data, _ := json.MarshalIndent(devices, "", "  ")
	_ = os.WriteFile(getDevicesFilePath(), data, 0644)
}

var (
	clients       = make(map[string]*Client)
	latestScreens = make(map[string]string) // key: clientID, value: base64 string
	mutex         sync.Mutex
	uploadDir     = "./uploads"
)

func handleWS(w http.ResponseWriter, r *http.Request) {
	// Token doğrulaması
	token := r.URL.Query().Get("token")
	if token != authToken {
		log.Printf("[GÜVENLİK UYARISI] Geçersiz veya eksik token ile istemci bağlantı denemesi reddedildi: IP=%s\n", r.RemoteAddr)
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	// İlk mesaj client'ın sistem bilgilerini içeren handshake olmalı
	var handshake struct {
		Hostname string `json:"hostname"`
		MAC      string `json:"mac"`
		Version  string `json:"version"`
	}
	
	_, msgBytes, err := conn.ReadMessage()
	if err != nil {
		log.Println("Handshake read error:", err)
		return
	}
	log.Printf("Handshake raw data: %s\n", string(msgBytes))
	err = json.Unmarshal(msgBytes, &handshake)
	if err != nil {
		log.Println("Handshake JSON unmarshal error:", err)
		return
	}

	clientID := handshake.MAC
	if clientID == "" {
		clientID = r.RemoteAddr
	}
	host := handshake.Hostname
	if host == "" {
		host = "İstemci-" + clientID
	}
	client := &Client{
		ID:       clientID,
		Hostname: host,
		MAC:      handshake.MAC,
		Version:  handshake.Version,
		Conn:     conn,
	}

	mutex.Lock()
	// Aynı hostname'e sahip eski tüm bağlantıları kapat ve temizle
	for oldID, oldClient := range clients {
		if oldClient.Hostname == handshake.Hostname {
			log.Printf("Aynı hostname'e sahip eski bağlantı temizleniyor: %s (%s)\n", oldClient.Hostname, oldID)
			oldClient.Conn.Close()
			delete(clients, oldID)
			delete(latestScreens, oldID)
			telemetryMutex.Lock()
			delete(clientTelemetry, oldID)
			telemetryMutex.Unlock()
		}
	}
	clients[clientID] = client
	mutex.Unlock()

	saveDevice(handshake.MAC, handshake.Hostname, r.RemoteAddr)

	log.Printf("Client bağlandı: %s (%s)\n", client.Hostname, client.ID)

	// Send initial wallpaper lock configuration
	wallpaperMutex.Lock()
	initialMsg := map[string]interface{}{
		"action": "wallpaper_lock",
		"locked": wallpaperLocked,
		"url":    currentWallpaper,
	}
	wallpaperMutex.Unlock()
	_ = client.Conn.WriteJSON(initialMsg)

	// Bağlantıyı açık tut ve mesajları dinle
	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Client bağlantısı koptu: %s (%s)\n", client.Hostname, client.ID)
			mutex.Lock()
			delete(clients, clientID)
			delete(latestScreens, clientID)
			mutex.Unlock()
			
			telemetryMutex.Lock()
			delete(clientTelemetry, clientID)
			telemetryMutex.Unlock()
			return
		}
		_ = messageType

		var msg struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		}
		if err := json.Unmarshal(p, &msg); err == nil {
			if msg.Type == "screen" {
				var screenData string
				if err := json.Unmarshal(msg.Data, &screenData); err == nil {
					mutex.Lock()
					latestScreens[clientID] = screenData
					mutex.Unlock()
				}
			} else if msg.Type == "log" {
				var logData string
				if err := json.Unmarshal(msg.Data, &logData); err == nil {
					log.Printf("[%s] %s\n", client.Hostname, logData)
				}
			} else if msg.Type == "telemetry" {
				var tel TelemetryData
				if err := json.Unmarshal(msg.Data, &tel); err == nil {
					telemetryMutex.Lock()
					clientTelemetry[clientID] = tel
					telemetryMutex.Unlock()
				}
			} else if msg.Type == "terminal_output" {
				var termData struct {
					CommandID string `json:"command_id"`
					Output    string `json:"output"`
				}
				if err := json.Unmarshal(msg.Data, &termData); err == nil {
					payload, _ := json.Marshal(map[string]string{
						"clientId":   clientID,
						"hostname":   client.Hostname,
						"command_id": termData.CommandID,
						"output":     termData.Output,
					})
					terminalMutex.Lock()
					for tc := range terminalClients {
						_ = tc.WriteMessage(websocket.TextMessage, payload)
					}
					terminalMutex.Unlock()
				}
			}
		}
	}
}

var teacherConn *websocket.Conn
var teacherMutex sync.Mutex

func handleTeacherWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token != authToken {
		log.Printf("[GÜVENLİK UYARISI] Geçersiz veya eksik token ile öğretmen ekran paylaşımı bağlantı denemesi reddedildi: IP=%s\n", r.RemoteAddr)
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Teacher Upgrade error:", err)
		return
	}
	defer conn.Close()

	teacherMutex.Lock()
	if teacherConn != nil {
		teacherConn.Close()
	}
	teacherConn = conn
	teacherMutex.Unlock()

	log.Println("Öğretmen ekran paylaşımı bağlantısı kuruldu.")

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println("Öğretmen ekran paylaşımı bağlantısı koptu.")
			teacherMutex.Lock()
			if teacherConn == conn {
				teacherConn = nil
			}
			teacherMutex.Unlock()
			return
		}

		// Kareyi hem bağlı student client'lara (natively) hem de tarayıcı izleyicilerine ilet
		mutex.Lock()
		for _, client := range clients {
			_ = client.Conn.WriteMessage(messageType, p)
		}
		mutex.Unlock()

		viewersMutex.Lock()
		for viewer := range studentViewers {
			_ = viewer.WriteMessage(messageType, p)
		}
		viewersMutex.Unlock()
	}
}

var studentViewers = make(map[*websocket.Conn]bool)
var viewersMutex sync.Mutex

func handleStudentViewerWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token != authToken {
		log.Printf("[GÜVENLİK UYARISI] Geçersiz veya eksik token ile öğrenci ekran izleme bağlantı denemesi reddedildi: IP=%s\n", r.RemoteAddr)
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Student viewer upgrade error:", err)
		return
	}
	defer conn.Close()

	viewersMutex.Lock()
	studentViewers[conn] = true
	viewersMutex.Unlock()

	log.Println("Öğrenci ekran izleme arayüzü bağlandı.")

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			viewersMutex.Lock()
			delete(studentViewers, conn)
			viewersMutex.Unlock()
			log.Println("Öğrenci ekran izleme arayüzü ayrıldı.")
			return
		}
	}
}

func addLogToHistory(msg string) {
	logHistoryMutex.Lock()
	defer logHistoryMutex.Unlock()
	logHistory = append(logHistory, msg)
	if len(logHistory) > 100 {
		logHistory = logHistory[1:]
	}
}

func broadcastLog(message string) {
	addLogToHistory(message)
	logMutex.Lock()
	defer logMutex.Unlock()
	for client := range logClients {
		_ = client.WriteMessage(websocket.TextMessage, []byte(message))
	}
}

type wsLogWriter struct{}

func (w *wsLogWriter) Write(p []byte) (n int, err error) {
	n, err = os.Stdout.Write(p)
	broadcastLog(strings.TrimSpace(string(p)))
	return n, err
}

func handleLogsWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token != authToken {
		log.Printf("[GÜVENLİK UYARISI] Geçersiz veya eksik token ile log izleyici bağlantı denemesi reddedildi: IP=%s\n", r.RemoteAddr)
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Logs WS Upgrade error:", err)
		return
	}
	defer conn.Close()

	logMutex.Lock()
	logClients[conn] = true
	logMutex.Unlock()

	// Geçmiş logları gönder
	logHistoryMutex.Lock()
	for _, logLine := range logHistory {
		_ = conn.WriteMessage(websocket.TextMessage, []byte(logLine))
	}
	logHistoryMutex.Unlock()

	log.Println("Öğretmen paneli log izleyici bağlandı.")

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			logMutex.Lock()
			delete(logClients, conn)
			logMutex.Unlock()
			log.Println("Öğretmen paneli log izleyici ayrıldı.")
			return
		}
	}
}

func handleTerminalWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token != authToken {
		log.Printf("[GÜVENLİK UYARISI] Geçersiz veya eksik token ile uzaktan terminal bağlantı denemesi reddedildi: IP=%s\n", r.RemoteAddr)
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Terminal WS Upgrade error:", err)
		return
	}
	defer conn.Close()

	terminalMutex.Lock()
	terminalClients[conn] = true
	terminalMutex.Unlock()

	log.Println("Öğretmen paneli uzaktan terminal izleyici bağlandı.")

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			terminalMutex.Lock()
			delete(terminalClients, conn)
			terminalMutex.Unlock()
			log.Println("Öğretmen paneli uzaktan terminal izleyici ayrıldı.")
			return
		}
	}
}
func handleVNCProxyWS(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token != authToken {
		log.Printf("[GÜVENLİK UYARISI] Geçersiz veya eksik token ile VNC proxy bağlantı denemesi reddedildi: IP=%s\n", r.RemoteAddr)
		http.Error(w, "Unauthorized: Invalid token", http.StatusUnauthorized)
		return
	}

	// Upgrade VNC client request to WebSocket
	var vncUpgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
		Subprotocols: []string{"binary"},
	}
	conn, err := vncUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("[VNC Proxy] Upgrade error:", err)
		return
	}
	defer conn.Close()

	// Get target client ID (MAC Address) from query parameters
	clientID := r.URL.Query().Get("clientId")
	if clientID == "" {
		log.Println("[VNC Proxy] Missing clientId parameter")
		return
	}

	// Resolve the target client structure to get its IP address
	mutex.Lock()
	client, exists := clients[clientID]
	mutex.Unlock()

	if !exists {
		log.Printf("[VNC Proxy] Client not online or not found: %s\n", clientID)
		return
	}

	// Resolve actual remote IP address of student client
	remoteAddr := client.Conn.RemoteAddr().String()
	ip, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		ip = remoteAddr
	}
	if ip == "[::1]" || ip == "" {
		ip = "127.0.0.1"
	}

	// Connect VNC socket proxy to client's VNC Port (5900)
	vncTarget := fmt.Sprintf("%s:5900", ip)
	log.Printf("[VNC Proxy] Proxying WebSocket to VNC TCP target: %s\n", vncTarget)

	vncConn, err := net.DialTimeout("tcp", vncTarget, 5*time.Second)
	if err != nil {
		log.Printf("[VNC Proxy Error] Connection failed to %s: %v\n", vncTarget, err)
		return
	}
	defer vncConn.Close()

	// Proxy data Bidirectionally
	errChan := make(chan error, 2)

	// Go-Routine 1: WebSocket to VNC TCP Socket
	go func() {
		for {
			mt, message, err := conn.ReadMessage()
			if err != nil {
				errChan <- err
				return
			}
			// VNC clients send binary frames (or occasionally text depending on protocol wrappers)
			_ = mt
			_, err = vncConn.Write(message)
			if err != nil {
				errChan <- err
				return
			}
		}
	}()

	// Go-Routine 2: VNC TCP Socket to WebSocket
	go func() {
		buf := make([]byte, 65535)
		for {
			n, err := vncConn.Read(buf)
			if err != nil {
				errChan <- err
				return
			}
			err = conn.WriteMessage(websocket.BinaryMessage, buf[:n])
			if err != nil {
				errChan <- err
				return
			}
		}
	}()

	// Wait until any of the proxy routines fail
	readErr := <-errChan
	log.Printf("[VNC Proxy] Session closed for %s: %v\n", vncTarget, readErr)
}

func handleTerminalRun(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ClientID  string `json:"clientId"`
		Command   string `json:"command"`
		CommandID string `json:"command_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	log.Printf("[Terminal] İstek alındı - ClientID: %s, Command: %s\n", req.ClientID, req.Command)

	mutex.Lock()
	client, exists := clients[req.ClientID]
	mutex.Unlock()

	if !exists {
		log.Printf("[Terminal] İstemci bulunamadı: %s\n", req.ClientID)
		http.Error(w, "İstemci bulunamadı", http.StatusNotFound)
		return
	}

	log.Printf("[Terminal] İstemciye komut gönderiliyor: %s (%s)\n", client.Hostname, client.ID)

	cmdMsg := map[string]string{
		"action":     "run_terminal",
		"command":    req.Command,
		"command_id": req.CommandID,
	}
	err = client.Conn.WriteJSON(cmdMsg)
	if err != nil {
		log.Printf("[Terminal] Hata: Komut gönderilemedi: %v\n", err)
		http.Error(w, "Komut gönderilemedi", http.StatusInternalServerError)
		return
	}

	log.Println("[Terminal] Komut başarıyla gönderildi.")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"sent"}`))
}

func handleTelemetryAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	telemetryMutex.Lock()
	data, _ := json.Marshal(clientTelemetry)
	telemetryMutex.Unlock()

	w.Write(data)
}

const shareHTML = `<!DOCTYPE html>
<html>
<head>
	<title>Öğretmen Ekranı - PolyOS Lab</title>
	<style>
		body {
			margin: 0;
			padding: 0;
			background-color: #000;
			overflow: hidden;
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100vh;
			width: 100vw;
		}
		img {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
		}
		.status {
			position: absolute;
			top: 20px;
			left: 20px;
			background: rgba(0, 0, 0, 0.6);
			color: #10b981;
			padding: 8px 12px;
			border-radius: 8px;
			font-family: sans-serif;
			font-size: 14px;
			pointer-events: none;
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.dot {
			width: 8px;
			height: 8px;
			background-color: #10b981;
			border-radius: 50%;
			animation: pulse 1.5s infinite;
		}
		@keyframes pulse {
			0% { opacity: 0.5; }
			50% { opacity: 1; }
			100% { opacity: 0.5; }
		}
	</style>
</head>
<body>
	<div class="status">
		<div class="dot"></div>
		<span>Canlı Yayını İzliyorsunuz</span>
	</div>
	<img id="screen" src="" alt="Öğretmen ekranı bekleniyor..." />

	<script>
		const img = document.getElementById('screen');
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = protocol + '//' + window.location.host + '/ws/student-viewer';
		
		function connect() {
			const ws = new WebSocket(wsUrl);
			ws.onmessage = (event) => {
				img.src = 'data:image/jpeg;base64,' + event.data;
			};
			ws.onclose = () => {
				setTimeout(connect, 2000);
			};
		}
		connect();
	</script>
</body>
</html>`

func handleSharePage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(shareHTML))
}

// Persistent Devices REST API
func handleDevices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	mutex.Lock()
	defer mutex.Unlock()

	devices := loadDevices()
	
	type DeviceResponse struct {
		Hostname string    `json:"hostname"`
		MAC      string    `json:"mac"`
		IP       string    `json:"ip"`
		LastSeen time.Time `json:"lastSeen"`
		IsOnline bool      `json:"isOnline"`
	}

	respList := []DeviceResponse{}
	for _, dev := range devices {
		isOnline := false
		for _, c := range clients {
			if c.MAC == dev.MAC {
				isOnline = true
				break
			}
		}
		respList = append(respList, DeviceResponse{
			Hostname: dev.Hostname,
			MAC:      dev.MAC,
			IP:       dev.IP,
			LastSeen: dev.LastSeen,
			IsOnline: isOnline,
		})
	}

	data, _ := json.Marshal(respList)
	w.Write(data)
}

// Wake on LAN (WOL) REST API
func handleWake(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	var req struct {
		MAC string `json:"mac"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	if req.MAC == "all" {
		devices := loadDevices()
		for _, dev := range devices {
			_ = sendWOL(dev.MAC)
		}
		log.Println("Tüm çevrimdışı cihazlara WOL gönderildi.")
	} else {
		err = sendWOL(req.MAC)
		if err != nil {
			log.Printf("WOL gönderilemedi (%s): %v\n", req.MAC, err)
			http.Error(w, "WOL paketi gönderilemedi", http.StatusInternalServerError)
			return
		}
		log.Printf("Cihaza WOL gönderildi: %s\n", req.MAC)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// Delete device REST API
func handleDeleteDevice(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	var req struct {
		MAC string `json:"mac"`
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	devices := loadDevices()
	if _, exists := devices[req.MAC]; exists {
		delete(devices, req.MAC)
		data, _ := json.MarshalIndent(devices, "", "  ")
		_ = os.WriteFile(getDevicesFilePath(), data, 0644)
		log.Printf("Cihaz silindi: %s\n", req.MAC)
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func sendWOL(macAddr string) error {
	hw, err := net.ParseMAC(macAddr)
	if err != nil {
		return err
	}

	var packet [102]byte
	for i := 0; i < 6; i++ {
		packet[i] = 0xFF
	}
	for i := 1; i <= 16; i++ {
		copy(packet[i*6:i*6+6], hw)
	}

	conn, err := net.Dial("udp", "255.255.255.255:9")
	if err != nil {
		return err
	}
	defer conn.Close()

	_, err = conn.Write(packet[:])
	return err
}

// Dashboard için aktif client'ları listeleyen REST API
func getClients(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	mutex.Lock()
	defer mutex.Unlock()
	
	w.Write([]byte(`[`))
	first := true
	for id, c := range clients {
		if !first {
			w.Write([]byte(`,`))
		}
		w.Write([]byte(fmt.Sprintf(`{"id":"%s", "hostname":"%s", "mac":"%s", "version":"%s"}`, id, c.Hostname, c.MAC, c.Version)))
		first = false
	}
	w.Write([]byte(`]`))
}

// Dashboard'dan gelen komutları işleyen REST API
func handleCommand(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ClientID string `json:"clientId"`
		Command  string `json:"command"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	mutex.Lock()
	client, exists := clients[req.ClientID]
	mutex.Unlock()

	if !exists {
		http.Error(w, "İstemci bulunamadı", http.StatusNotFound)
		return
	}

	// İstemciye komutu WebSocket üzerinden gönder
	cmdMsg := map[string]string{
		"action": req.Command,
	}
	err = client.Conn.WriteJSON(cmdMsg)
	if err != nil {
		log.Println("Komut gönderme hatası:", err)
		http.Error(w, "Komut gönderilemedi", http.StatusInternalServerError)
		return
	}

	log.Printf("Komut gönderildi: [%s] -> %s\n", req.Command, client.Hostname)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// Tüm aktif istemcilere komut gönderen (yayın/broadcast) REST API
func handleBroadcast(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Command string `json:"command"`
	}

	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	mutex.Lock()
	defer mutex.Unlock()

	cmdMsg := map[string]string{
		"action": req.Command,
	}

	successCount := 0
	for _, client := range clients {
		err = client.Conn.WriteJSON(cmdMsg)
		if err == nil {
			successCount++
		} else {
			log.Printf("Yayın gönderme hatası [%s]: %v\n", client.Hostname, err)
		}
	}

	log.Printf("Yayın komutu gönderildi: %s (Başarılı: %d/%d)\n", req.Command, successCount, len(clients))
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(fmt.Sprintf(`{"status":"ok","sent":%d}`, successCount)))
}

// Belirli bir istemcinin son ekran görüntüsünü döndüren REST API
func getScreen(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	clientID := r.URL.Query().Get("clientId")

	mutex.Lock()
	base64Data, exists := latestScreens[clientID]
	mutex.Unlock()

	if !exists || base64Data == "" {
		http.Error(w, "Ekran bulunamadı", http.StatusNotFound)
		return
	}

	decoded, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		http.Error(w, "Dekodlama hatası", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/jpeg")
	w.Write(decoded)
}

// Dosya yükleme ve istemciye bildirme API'si
func handleUpload(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	// 1 GB'a kadar dosyaları kabul et
	err := r.ParseMultipartForm(1024 << 20)
	if err != nil {
		http.Error(w, "Dosya boyutu çok büyük veya geçersiz form", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Dosya alınamadı", http.StatusBadRequest)
		return
	}
	defer file.Close()

	target := r.FormValue("target") // clientID veya "all"

	// Uploads dizinini oluştur
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.Mkdir(uploadDir, 0755)
	}

	safeFilename := filepath.Base(handler.Filename)
	filePath := filepath.Join(uploadDir, safeFilename)
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Dosya kaydedilemedi", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "Dosya kopyalanamadı", http.StatusInternalServerError)
		return
	}

	// Get the real LAN IP address of the teacher's server
	serverIP := getLocalIP()
	if serverIP == "" {
		serverIP = "localhost"
	}
	
	port := "8080"
	if parts := strings.Split(r.Host, ":"); len(parts) > 1 {
		port = parts[1]
	}

	downloadURL := fmt.Sprintf("http://%s:%s/uploads/%s", serverIP, port, safeFilename)

	// İstemciye/İstemcilere indir komutu gönder
	transferMsg := map[string]string{
		"action":   "file_transfer",
		"url":      downloadURL,
		"filename": safeFilename,
	}

	mutex.Lock()
	defer mutex.Unlock()

	if target == "all" {
		for _, client := range clients {
			_ = client.Conn.WriteJSON(transferMsg)
		}
		log.Printf("Dosya transfer bildirimi tüm cihazlara gönderildi: %s\n", handler.Filename)
	} else {
		targets := strings.Split(target, ",")
		foundAny := false
		for _, t := range targets {
			t = strings.TrimSpace(t)
			if t == "" {
				continue
			}
			client, exists := clients[t]
			if exists {
				_ = client.Conn.WriteJSON(transferMsg)
				log.Printf("Dosya transfer bildirimi şuraya gönderildi: %s -> %s\n", client.Hostname, handler.Filename)
				foundAny = true
			}
		}
		if !foundAny {
			http.Error(w, "Hedef istemci bulunamadı", http.StatusNotFound)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// Fare, klavye ve uzaktan kontrol sinyallerini istemciye ileten API
func handleInput(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	var req map[string]interface{}
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	clientID, ok := req["clientId"].(string)
	if !ok {
		http.Error(w, "clientId alanı zorunludur", http.StatusBadRequest)
		return
	}

	mutex.Lock()
	client, exists := clients[clientID]
	mutex.Unlock()

	if !exists {
		http.Error(w, "İstemci bulunamadı", http.StatusNotFound)
		return
	}

	// Sinyali WebSocket ile doğrudan istemciye ilet
	payload, _ := json.Marshal(req)
	err = client.Conn.WriteMessage(websocket.TextMessage, payload)
	if err != nil {
		log.Println("İstemciye girdi iletim hatası:", err)
		http.Error(w, "Sinyal iletilemedi", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func handleBlocked(w http.ResponseWriter, r *http.Request) {
	site := r.URL.Query().Get("site")
	
	// Remote IP Clean-up
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	if ip == "[::1]" || ip == "" {
		ip = "127.0.0.1"
	}

	htmlTemplate := `<!DOCTYPE html><html lang="tr"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Erişim Sınırlandırıldı - Alanya MTAL Innovation Lab</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet">
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#ee2b2b",
                        "background-light": "#f8f6f6",
                        "background-dark": "#221010",
                    },
                    fontFamily: {
                        "display": ["Public Sans", "sans-serif"],
                        "mono": ["JetBrains Mono", "monospace"],
                    },
                    borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},
                },
            },
        }
    </script>
<style>
        body {
            font-family: 'Public Sans', sans-serif;
        }
    </style>
</head>
<body class="bg-background-light dark:bg-background-dark text-gray-800 dark:text-gray-100 min-h-screen flex flex-col items-center justify-between p-6">
<!-- Top Spacer for vertical centering balance -->
<div class="flex-grow-0 h-12"></div>
<!-- Main Content Container -->
<main class="w-full max-w-2xl flex flex-col items-center justify-center text-center space-y-8 flex-grow">
<!-- Icon Container with soft shadow -->
<div class="relative group">
<div class="absolute -inset-4 bg-primary/20 rounded-full blur-xl opacity-70 group-hover:opacity-100 transition duration-500"></div>
<div class="relative bg-white dark:bg-gray-800 p-8 rounded-full shadow-lg border border-primary/10">
<span class="material-icons text-primary text-6xl md:text-7xl">gpp_bad</span>
</div>
</div>
<!-- Text Content -->
<div class="space-y-4 max-w-lg">
<h1 class="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                Erişim <span class="text-primary">Sınırlandırıldı</span>
</h1>
<p class="text-lg md:text-xl text-gray-600 dark:text-gray-300 font-light leading-relaxed">
                Bu web sitesine erişim Innovation Lab politikaları gereği kısıtlanmıştır.
            </p>
</div>
<!-- Technical Details Box -->
<div class="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden mt-6">
<div class="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
<span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bağlantı Detayları</span>
<span class="flex h-2 w-2 relative">
<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
<span class="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
</span>
</div>
<div class="p-5 font-mono text-sm space-y-3 text-left">
<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
<span class="text-gray-400 text-xs">Hedef URL:</span>
<span class="text-primary font-medium truncate max-w-[250px]" title="www.restricted-site.com/game">www.restricted-site.com/game</span>
</div>
<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
<span class="text-gray-400 text-xs">İstemci IP:</span>
<span class="text-gray-700 dark:text-gray-200">192.168.1.104</span>
</div>
<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
<span class="text-gray-400 text-xs">Kategori:</span>
<span class="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">Oyun / Eğlence</span>
</div>
</div>
</div>
<!-- Action Button -->
<div class="pt-4">
<a class="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-white transition-all duration-200 bg-primary border border-transparent rounded-lg shadow-sm hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary" href="https://www.eba.gov.tr">
<span class="material-icons text-sm mr-2">arrow_back</span>
                Güvenli Alana Dön
            </a>
</div>
</main>
<!-- Footer -->
<footer class="w-full max-w-4xl flex flex-col items-center justify-center py-8 space-y-4 border-t border-gray-200 dark:border-gray-800 mt-12">
<div class="flex items-center space-x-2 opacity-80 hover:opacity-100 transition-opacity">
<!-- Logo Icon Representation -->
<div class="h-6 w-6 bg-gradient-to-br from-gray-800 to-gray-600 dark:from-gray-200 dark:to-gray-400 rounded flex items-center justify-center text-white dark:text-gray-900 text-[10px] font-bold">
                OS
            </div>
<span class="text-sm font-semibold tracking-wide text-gray-700 dark:text-gray-300">PolyOS Lab</span>
</div>
<p class="text-xs text-gray-400 font-light">
            Developed by <span class="font-medium text-gray-500 dark:text-gray-400">Emirhan Gök</span>
</p>
</footer>
</body></html>`

	html := strings.ReplaceAll(htmlTemplate, "www.restricted-site.com/game", site)
	html = strings.ReplaceAll(html, "192.168.1.104", ip)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(html))
}

func broadcastWallpaperState() {
	wallpaperMutex.Lock()
	msg := map[string]interface{}{
		"action": "wallpaper_lock",
		"locked": wallpaperLocked,
		"url":    currentWallpaper,
	}
	wallpaperMutex.Unlock()

	mutex.Lock()
	defer mutex.Unlock()
	for _, client := range clients {
		_ = client.Conn.WriteJSON(msg)
	}
}

func handleGetWallpaper(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	wallpaperMutex.Lock()
	defer wallpaperMutex.Unlock()
	json.NewEncoder(w).Encode(map[string]interface{}{
		"locked":    wallpaperLocked,
		"wallpaper": currentWallpaper,
	})
}

func handleToggleWallpaper(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Locked bool `json:"locked"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Geçersiz istek", http.StatusBadRequest)
		return
	}

	wallpaperMutex.Lock()
	wallpaperLocked = req.Locked
	wallpaperMutex.Unlock()

	broadcastWallpaperState()

	log.Printf("Masaüstü resim kilidi güncellendi: %t\n", req.Locked)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func handleUploadWallpaper(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")

	if r.Method == "OPTIONS" {
		return
	}
	if r.Method != "POST" {
		http.Error(w, "Sadece POST metodu kabul edilir", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(100 << 20)
	if err != nil {
		http.Error(w, "Dosya boyutu çok büyük", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Dosya alınamadı", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		errMkdir := os.MkdirAll(uploadDir, 0755)
		if errMkdir != nil {
			log.Printf("Masaüstü dizin oluşturma hatası: %v (Yol: %s)\n", errMkdir, uploadDir)
			http.Error(w, "Dizin oluşturulamadı: "+errMkdir.Error(), http.StatusInternalServerError)
			return
		}
	}

	ext := filepath.Ext(handler.Filename)
	safeFilename := "locked-wallpaper" + ext
	filePath := filepath.Join(uploadDir, safeFilename)

	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("Masaüstü duvar kağıdı oluşturma hatası: %v (Yol: %s)\n", err, filePath)
		http.Error(w, "Dosya oluşturulamadı: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "Dosya kaydedilemedi", http.StatusInternalServerError)
		return
	}

	wallpaperMutex.Lock()
	currentWallpaper = "/uploads/" + safeFilename
	wallpaperMutex.Unlock()

	broadcastWallpaperState()

	log.Printf("Yeni duvar kağıdı yüklendi: %s\n", safeFilename)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "ok",
		"wallpaper": currentWallpaper,
	})
}

func localOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		
		// Sadece loopback (localhost) bağlantılarına izin ver
		if ip == "127.0.0.1" || ip == "::1" || ip == "localhost" {
			next(w, r)
			return
		}
		
		log.Printf("[GÜVENLİK UYARISI] Dış ağdan yetkisiz erişim engellendi: IP=%s Yol=%s\n", ip, r.URL.Path)
		http.Error(w, "Erişim Engellendi: Bu işleme sadece sunucu üzerindeki yerel panel izin verebilir.", http.StatusForbidden)
	}
}

func startUDPBeacon(port string) {
	// Broadcast address
	bAddr, bErr := net.ResolveUDPAddr("udp", "255.255.255.255:9999")
	// Multicast address (mDNS group on port 9999)
	mAddr, mErr := net.ResolveUDPAddr("udp", "224.0.0.251:9999")
	
	var bConn, mConn *net.UDPConn
	if bErr == nil {
		bConn, _ = net.DialUDP("udp", nil, bAddr)
	}
	if mErr == nil {
		mConn, _ = net.DialUDP("udp", nil, mAddr)
	}
	
	defer func() {
		if bConn != nil {
			bConn.Close()
		}
		if mConn != nil {
			mConn.Close()
		}
	}()

	log.Println("UDP Sunucu Keşif Yayını (Beacon + Multicast) başlatıldı. Port: 9999")
	for {
		localIP := getLocalIP()
		if localIP != "" {
			message := fmt.Sprintf("POLYOS_SERVER:%s:%s", localIP, port)
			if bConn != nil {
				_, _ = bConn.Write([]byte(message))
			}
			if mConn != nil {
				_, _ = mConn.Write([]byte(message))
			}
		}
		time.Sleep(3 * time.Second)
	}
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return ""
}

func main() {
	home, err := os.UserHomeDir()
	if err == nil {
		uploadDir = filepath.Join(home, ".config", "polyos-lab", "uploads")
	} else {
		uploadDir = filepath.Join(os.TempDir(), "polyos-uploads")
	}
	if errMk := os.MkdirAll(uploadDir, 0755); errMk != nil {
		// Fallback to temp dir if .config is not writable
		uploadDir = filepath.Join(os.TempDir(), "polyos-uploads")
		_ = os.MkdirAll(uploadDir, 0755)
	}

	log.SetOutput(&wsLogWriter{})
	http.HandleFunc("/blocked", handleBlocked)
	http.HandleFunc("/ws", handleWS)
	http.HandleFunc("/ws/teacher", localOnly(handleTeacherWS))
	http.HandleFunc("/share", handleSharePage)
	http.HandleFunc("/ws/student-viewer", handleStudentViewerWS)
	http.HandleFunc("/ws/vnc-proxy", handleVNCProxyWS)
	http.HandleFunc("/ws/logs", localOnly(handleLogsWS))
	http.HandleFunc("/ws/terminal", localOnly(handleTerminalWS))
	http.HandleFunc("/api/terminal/run", localOnly(handleTerminalRun))
	http.HandleFunc("/api/telemetry", localOnly(handleTelemetryAPI))
	http.HandleFunc("/api/clients", localOnly(getClients))
	http.HandleFunc("/api/command", localOnly(handleCommand))
	http.HandleFunc("/api/broadcast", localOnly(handleBroadcast))
	http.HandleFunc("/api/screen", localOnly(getScreen))
	http.HandleFunc("/api/upload", localOnly(handleUpload))
	http.HandleFunc("/api/input", localOnly(handleInput))
	http.HandleFunc("/api/devices", localOnly(handleDevices))
	http.HandleFunc("/api/wake", localOnly(handleWake))
	http.HandleFunc("/api/devices/delete", localOnly(handleDeleteDevice))
	http.HandleFunc("/api/wallpaper", localOnly(handleGetWallpaper))
	http.HandleFunc("/api/wallpaper/toggle", localOnly(handleToggleWallpaper))
	http.HandleFunc("/api/wallpaper/upload", localOnly(handleUploadWallpaper))

	// Yüklenen dosyaları statik olarak servis et
	fs := http.FileServer(http.Dir(uploadDir))
	http.Handle("/uploads/", http.StripPrefix("/uploads/", fs))

	portFlag := flag.String("port", "8080", "Port to listen on")
	tokenFlag := flag.String("token", "polyos-secure-token", "Authentication token for clients")
	flag.Parse()
	
	authToken = *tokenFlag
	port := ":" + *portFlag

	// UDP Beacon yayını başlat
	go startUDPBeacon(*portFlag)

	log.Printf("PolyOS Lab Server (Go) %s portunda dinleniyor...\n", port)
	err = http.ListenAndServe(port, nil)
	if err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
