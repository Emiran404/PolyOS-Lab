package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"syscall"

	"github.com/gorilla/websocket"
)

const clientVersion = "1.3.5"

var (
	captureInterval = 2000 * time.Millisecond
	intervalMutex   sync.Mutex
	screenQuality   = 30 // Varsayılan kalite (Orta)
	qualityMutex    sync.Mutex
	serverURL       = "ws://localhost:8080/ws"
	secretToken     = "polyos-secure-token"
	logFile         *os.File
	wsConn          *websocket.Conn
	wsMutex         sync.Mutex
	isLoggingToWS   bool
	logLoopMutex    sync.Mutex
	wsWriteMutex    sync.Mutex
	lockOverlayCmd  *exec.Cmd
	lockMutex       sync.Mutex
)

func safeWriteJSON(data interface{}) error {
	wsMutex.Lock()
	conn := wsConn
	wsMutex.Unlock()

	if conn == nil {
		return fmt.Errorf("websocket connection is nil")
	}

	wsWriteMutex.Lock()
	defer wsWriteMutex.Unlock()
	return conn.WriteJSON(data)
}

type clientLogWriter struct{}

func sendClientLogToServer(msg string) {
	logLoopMutex.Lock()
	if isLoggingToWS {
		logLoopMutex.Unlock()
		return
	}
	isLoggingToWS = true
	logLoopMutex.Unlock()

	defer func() {
		logLoopMutex.Lock()
		isLoggingToWS = false
		logLoopMutex.Unlock()
	}()

	wsMutex.Lock()
	conn := wsConn
	wsMutex.Unlock()

	if conn != nil {
		logMsg := map[string]string{
			"type": "log",
			"data": msg,
		}
		_ = safeWriteJSON(logMsg)
	}
}

func (w *clientLogWriter) Write(p []byte) (n int, err error) {
	msg := strings.TrimSpace(string(p))
	
	if logFile != nil {
		n, err = logFile.Write(p)
	} else {
		n, err = os.Stdout.Write(p)
	}
	
	sendClientLogToServer(msg)
	return n, err
}

type ClientConfig struct {
	ServerURL   string `json:"server_url"`
	SecretToken string `json:"secret_token"`
}

func getConfigPath() string {
	if runtime.GOOS == "darwin" {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".config", "polyos", "client.json")
	}
	return "/etc/polyos/client.json"
}

func loadConfig() {
	configPath := getConfigPath()
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Println("Yapılandırma dosyası bulunamadı, otomatik keşif denenecek:", configPath)
		return
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		log.Println("Yapılandırma dosyası okunamadı:", err)
		return
	}

	var config ClientConfig
	err = json.Unmarshal(data, &config)
	if err != nil {
		log.Println("Yapılandırma dosyası ayrıştırılamadı:", err)
		return
	}

	if config.ServerURL != "" {
		serverURL = config.ServerURL
	}
	if config.SecretToken != "" {
		secretToken = config.SecretToken
	}
	log.Println("Yapılandırma başarıyla yüklendi. Sunucu:", serverURL)
}

func discoverServer() {
	log.Println("Multicast (mDNS) ve UDP üzerinden sunucu aranıyor (Port: 9999)...")
	
	// 1. Multicast deneme
	mAddr, err := net.ResolveUDPAddr("udp4", "224.0.0.251:9999")
	if err == nil {
		mConn, err := net.ListenMulticastUDP("udp4", nil, mAddr)
		if err == nil {
			defer mConn.Close()
			_ = mConn.SetReadDeadline(time.Now().Add(4 * time.Second))
			buf := make([]byte, 1024)
			n, _, err := mConn.ReadFromUDP(buf)
			if err == nil {
				message := string(buf[:n])
				if strings.HasPrefix(message, "POLYOS_SERVER:") {
					parts := strings.Split(message, ":")
					if len(parts) >= 3 {
						serverURL = fmt.Sprintf("ws://%s:%s/ws", parts[1], parts[2])
						log.Println("Sunucu Multicast (mDNS) ile otomatik keşfedildi:", serverURL)
						return
					}
				}
			}
		}
	}

	// 2. Broadcast (Geleneksel UDP) deneme (Fallback)
	addr, err := net.ResolveUDPAddr("udp", ":9999")
	if err != nil {
		log.Println("UDP çözümleme hatası:", err)
		return
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		log.Println("UDP Port 9999 dinlenemedi (Zaten kullanımda veya yetki yok):", err)
		return
	}
	defer conn.Close()

	_ = conn.SetReadDeadline(time.Now().Add(4 * time.Second))
	buf := make([]byte, 1024)
	n, _, err := conn.ReadFromUDP(buf)
	if err != nil {
		log.Println("Sunucu keşfi zaman aşımına uğradı, varsayılan/yapılandırılmış adres kullanılacak.")
		return
	}

	message := string(buf[:n])
	if strings.HasPrefix(message, "POLYOS_SERVER:") {
		parts := strings.Split(message, ":")
		if len(parts) >= 3 {
			serverURL = fmt.Sprintf("ws://%s:%s/ws", parts[1], parts[2])
			log.Println("Sunucu Broadcast ile otomatik keşfedildi:", serverURL)
		}
	}
}

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

// Global variables for CPU stat history
var lastCPUUser, lastCPUNice, lastCPUSystem, lastCPUIdle, lastCPUIowait, lastCPUIrq, lastCPUSoftirq uint64

func getCPUUsage() float64 {
	if runtime.GOOS == "darwin" {
		return 15.0 + float64(time.Now().Unix()%20)
	}

	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0.0
	}
	defer file.Close()

	var cpu string
	var user, nice, system, idle, iowait, irq, softirq uint64
	_, _ = fmt.Fscanf(file, "%s %d %d %d %d %d %d %d", &cpu, &user, &nice, &system, &idle, &iowait, &irq, &softirq)

	idleTime := idle + iowait
	nonIdle := user + nice + system + irq + softirq
	total := idleTime + nonIdle

	lastTotal := lastCPUUser + lastCPUNice + lastCPUSystem + lastCPUIdle + lastCPUIowait + lastCPUIrq + lastCPUSoftirq
	lastIdle := lastCPUIdle + lastCPUIowait

	totalDiff := total - lastTotal
	idleDiff := idleTime - lastIdle

	lastCPUUser, lastCPUNice, lastCPUSystem, lastCPUIdle, lastCPUIowait, lastCPUIrq, lastCPUSoftirq = user, nice, system, idle, iowait, irq, softirq

	if totalDiff == 0 {
		return 0.0
	}

	return float64(totalDiff-idleDiff) / float64(totalDiff) * 100.0
}

func getCPUTemp() float64 {
	if runtime.GOOS == "darwin" {
		return 42.0 + float64(time.Now().Unix()%10)
	}

	data, err := os.ReadFile("/sys/class/thermal/thermal_zone0/temp")
	if err == nil {
		tempStr := strings.TrimSpace(string(data))
		tempVal, _ := strconv.Atoi(tempStr)
		return float64(tempVal) / 1000.0
	}

	data, err = os.ReadFile("/sys/class/hwmon/hwmon0/temp1_input")
	if err == nil {
		tempStr := strings.TrimSpace(string(data))
		tempVal, _ := strconv.Atoi(tempStr)
		return float64(tempVal) / 1000.0
	}

	return 45.0
}

func getRAMDetails() (float64, float64, float64) {
	if runtime.GOOS == "darwin" {
		total := 16.0
		used := 8.0 + float64(time.Now().Unix()%4)
		pct := (used / total) * 100.0
		return pct, total, used
	}

	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0.0, 0.0, 0.0
	}

	var memTotal, memAvailable uint64
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				memTotal, _ = strconv.ParseUint(fields[1], 10, 64)
			}
		}
		if strings.HasPrefix(line, "MemAvailable:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				memAvailable, _ = strconv.ParseUint(fields[1], 10, 64)
			}
		}
	}

	if memTotal == 0 {
		return 0.0, 0.0, 0.0
	}

	used := memTotal - memAvailable
	totalGB := float64(memTotal) / 1024 / 1024
	usedGB := float64(used) / 1024 / 1024
	pct := (usedGB / totalGB) * 100.0
	return pct, totalGB, usedGB
}

func getDiskDetails() (float64, float64, float64) {
	path := "/"
	if runtime.GOOS == "windows" {
		path = "C:\\"
	}
	
	if runtime.GOOS == "darwin" {
		return 35.0, 250.0, 87.5
	}

	var stat syscall.Statfs_t
	err := syscall.Statfs(path, &stat)
	if err != nil {
		return 0.0, 0.0, 0.0
	}
	all := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bfree * uint64(stat.Bsize)
	used := all - free
	if all == 0 {
		return 0.0, 0.0, 0.0
	}
	totalGB := float64(all) / 1024 / 1024 / 1024
	usedGB := float64(used) / 1024 / 1024 / 1024
	pct := (usedGB / totalGB) * 100.0
	return pct, totalGB, usedGB
}

func setupLogging() {
	if runtime.GOOS == "darwin" {
		log.SetOutput(&clientLogWriter{})
		return // macOS'ta normal terminal logu
	}
	
	logDir := "/var/log"
	logFilePath := filepath.Join(logDir, "polyos-client.log")
	
	// Klasörün varlığını kontrol et
	_ = os.MkdirAll(logDir, 0755)
	
	var err error
	logFile, err = os.OpenFile(logFilePath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		// Log klasörüne yazılamazsa, temp klasörünü dene
		tempLogPath := filepath.Join(os.TempDir(), "polyos-client.log")
		logFile, err = os.OpenFile(tempLogPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err == nil {
			log.SetOutput(&clientLogWriter{})
			log.Println("Log dosyası geçici klasörde açıldı:", tempLogPath)
		}
	} else {
		log.SetOutput(&clientLogWriter{})
		log.Println("Sistem log dosyası açıldı:", logFilePath)
	}
}

func closeLogging() {
	if logFile != nil {
		logFile.Close()
	}
}

func setCaptureInterval(d time.Duration) {
	intervalMutex.Lock()
	captureInterval = d
	intervalMutex.Unlock()
}

func getCaptureInterval() time.Duration {
	intervalMutex.Lock()
	defer intervalMutex.Unlock()
	return captureInterval
}

func setScreenQuality(q int) {
	qualityMutex.Lock()
	screenQuality = q
	qualityMutex.Unlock()
}

func getScreenQuality() int {
	qualityMutex.Lock()
	defer qualityMutex.Unlock()
	return screenQuality
}

// Hataları yakalayıp loglayan komut çalıştırma fonksiyonu
func runCommandWithLog(name string, arg ...string) {
	cmd := exec.Command(name, arg...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("[KOMUT HATASI] (%s %v): %v, Çıktı: %s\n", name, arg, err, strings.TrimSpace(string(out)))
	}
}

// Ekran çözünürlüğünü dönen fonksiyon
func getScreenResolution() (int, int) {
	if runtime.GOOS == "darwin" {
		// macOS (Simüle test çözünürlüğü)
		return 1440, 900
	}
	// Linux / Pardus
	out, err := exec.Command("xdotool", "getdisplaygeometry").Output()
	if err == nil {
		fields := strings.Fields(string(out))
		if len(fields) >= 2 {
			w, _ := strconv.Atoi(fields[0])
			h, _ := strconv.Atoi(fields[1])
			if w > 0 && h > 0 {
				return w, h
			}
		}
	}
	return 1920, 1080 // Varsayılan fallback
}

func getMACAddress() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback == 0 && iface.Flags&net.FlagUp != 0 {
			mac := iface.HardwareAddr.String()
			if mac != "" {
				return mac
			}
		}
	}
	return ""
}

func drawMockScreen() []byte {
	img := image.NewRGBA(image.Rect(0, 0, 800, 600))
	bg := color.RGBA{15, 23, 42, 255} // Slate rengi
	for x := 0; x < 800; x++ {
		for y := 0; y < 600; y++ {
			img.Set(x, y, bg)
		}
	}
	
	// Ortaya basit bir turkuaz kutu çizelim (PolyOS Lab logosu simülasyonu)
	fg := color.RGBA{13, 148, 136, 255}
	for x := 350; x < 450; x++ {
		for y := 250; y < 350; y++ {
			img.Set(x, y, fg)
		}
	}

	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, nil)
	return buf.Bytes()
}

// Ekran görüntüsü alan fonksiyon
func captureScreen() []byte {
	if runtime.GOOS == "darwin" {
		// macOS'ta TCC ekran kaydetme izin pop-up'larını önlemek için mock resim dönüyoruz.
		// Pardus/Linux'ta scrot sorunsuz şekilde gerçek ekran görüntüsü alır.
		return drawMockScreen()
	}

	tmpFile := os.TempDir() + "/polyos_screen.jpg"
	defer os.Remove(tmpFile)

	qStr := strconv.Itoa(getScreenQuality())
	cmd := exec.Command("scrot", "-z", "-q", qStr, tmpFile) // -z: sessiz mod, -q: kalite

	err := cmd.Run()
	if err != nil {
		// scrot yüklü değilse gnome-screenshot dene
		cmd = exec.Command("gnome-screenshot", "-f", tmpFile)
		err = cmd.Run()
	}

	if err != nil {
		return nil
	}

	bytesData, err := os.ReadFile(tmpFile)
	if err != nil {
		return nil
	}
	return bytesData
}

func findExecutable(name string) string {
	if path, err := exec.LookPath(name); err == nil {
		return path
	}
	fallbacks := []string{
		"/usr/sbin/" + name,
		"/sbin/" + name,
		"/usr/bin/" + name,
		"/bin/" + name,
	}
	for _, f := range fallbacks {
		if _, err := os.Stat(f); err == nil {
			return f
		}
	}
	return name
}

func getServerHTTPURL() string {
	u := serverURL
	u = strings.Replace(u, "ws://", "http://", 1)
	u = strings.Replace(u, "wss://", "https://", 1)
	if idx := strings.LastIndex(u, "/ws"); idx != -1 {
		u = u[:idx]
	}
	return u
}

func getShareURL() string {
	u := serverURL
	u = strings.Replace(u, "ws://", "http://", 1)
	u = strings.Replace(u, "wss://", "https://", 1)
	u = strings.Replace(u, "/ws", "/share", 1)
	return u
}

func getServerIP() string {
	u := serverURL
	u = strings.Replace(u, "ws://", "", 1)
	u = strings.Replace(u, "wss://", "", 1)
	if idx := strings.Index(u, "/"); idx != -1 {
		u = u[:idx]
	}
	if idx := strings.Index(u, ":"); idx != -1 {
		u = u[:idx]
	}
	return u
}

func getLoggedInGUIUser() string {
	out, err := exec.Command("logname").Output()
	if err == nil && len(strings.TrimSpace(string(out))) > 0 {
		return strings.TrimSpace(string(out))
	}

	out, err = exec.Command("who").Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				for _, f := range fields {
					if strings.Contains(f, ":0") || strings.Contains(f, "(:0)") {
						return fields[0]
					}
				}
			}
		}
	}

	user := os.Getenv("USER")
	if user != "" && user != "root" {
		return user
	}

	files, err := os.ReadDir("/home")
	if err == nil {
		for _, file := range files {
			if file.IsDir() && file.Name() != "lost+found" {
				return file.Name()
			}
		}
	}

	return "root"
}

func getXAuthorityPath(user string) string {
	// 1. Try home directory
	if user != "" && user != "root" {
		homePath := filepath.Join("/home", user, ".Xauthority")
		if _, err := os.Stat(homePath); err == nil {
			return homePath
		}
	}

	// 2. Try current process's environment variable
	if envXauth := os.Getenv("XAUTHORITY"); envXauth != "" {
		if _, err := os.Stat(envXauth); err == nil {
			return envXauth
		}
	}

	// 3. Try LightDM fallback
	lightdmPath := "/var/run/lightdm/root/:0"
	if _, err := os.Stat(lightdmPath); err == nil {
		return lightdmPath
	}

	// 4. Try GDM/other display manager fallbacks under /run/user/<UID>/gdm/Xauthority
	if files, err := os.ReadDir("/run/user"); err == nil {
		for _, file := range files {
			if file.IsDir() {
				gdmPath := filepath.Join("/run/user", file.Name(), "gdm", "Xauthority")
				if _, err := os.Stat(gdmPath); err == nil {
					return gdmPath
				}
			}
		}
	}

	// Fallback to user's home .Xauthority path
	if user != "" && user != "root" {
		return filepath.Join("/home", user, ".Xauthority")
	}
	return ""
}

func runGUICommand(name string, arg ...string) *exec.Cmd {
	if runtime.GOOS == "darwin" {
		return exec.Command(name, arg...)
	}

	exePath := findExecutable(name)
	userStr := getLoggedInGUIUser()
	xauth := getXAuthorityPath(userStr)

	c := exec.Command(exePath, arg...)
	env := append(os.Environ(), "DISPLAY=:0")
	if xauth != "" {
		env = append(env, "XAUTHORITY="+xauth)
	}
	c.Env = env

	if userStr != "" && userStr != "root" {
		if u, err := user.Lookup(userStr); err == nil {
			uid, _ := strconv.ParseUint(u.Uid, 10, 32)
			gid, _ := strconv.ParseUint(u.Gid, 10, 32)
			c.SysProcAttr = &syscall.SysProcAttr{
				Credential: &syscall.Credential{
					Uid: uint32(uid),
					Gid: uint32(gid),
				},
			}
			log.Printf("[GUI] Çalıştırılıyor (Kullanıcı: %s, UID: %d, GID: %d): %s\n", userStr, uid, gid, exePath)
		} else {
			log.Printf("[GUI WARNING] Kullanıcı bulunamadı %s: %v\n", userStr, err)
		}
	} else {
		log.Printf("[GUI] Çalıştırılıyor (Kullanıcı: root): %s\n", exePath)
	}

	return c
}

func runAndMonitorGUICommand(name string, executable string, arg ...string) (*exec.Cmd, error) {
	c := runGUICommand(executable, arg...)
	
	var outputBuf bytes.Buffer
	c.Stdout = &outputBuf
	c.Stderr = &outputBuf

	err := c.Start()
	if err != nil {
		return nil, err
	}

	go func() {
		waitErr := c.Wait()
		if waitErr != nil {
			logMsg := fmt.Sprintf("[%s] Başlatılan süreç sonlandı: %v. Hata çıktısı: %s", name, waitErr, strings.TrimSpace(outputBuf.String()))
			log.Println(logMsg)
			sendSystemLogToServer(logMsg)
		} else {
			log.Printf("[%s] Süreç başarıyla sonlandı.\n", name)
		}
	}()

	return c, nil
}

func sendSystemLogToServer(msg string) {
	hostname, _ := os.Hostname()
	_ = safeWriteJSON(map[string]interface{}{
		"type": "log",
		"data": fmt.Sprintf("[%s] %s", hostname, msg),
	})
}

func killProcessByName(name string) {
	if runtime.GOOS == "darwin" {
		_ = exec.Command("killall", name).Run()
		return
	}
	// Kill by binary name on Linux
	_ = exec.Command("pkill", "-f", name).Run()
}

func startLockOverlay() {
	lockMutex.Lock()
	defer lockMutex.Unlock()

	if lockOverlayCmd != nil {
		return
	}

	// Clean up any lingering lock screen browser instances first
	killProcessByName("firefox")
	killProcessByName("chromium-browser")
	killProcessByName("chromium")
	killProcessByName("chrome")

	htmlContent := `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="utf-8"/>
    <meta content="width=device-width, initial-scale=1.0" name="viewport"/>
    <title>Erişim Kısıtlandı</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            background-color: #f9f9f9;
            color: #1a1c1c;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            align-items: center;
            justify-content: center;
        }
        header {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 2rem;
            background: transparent;
        }
        .header-logo {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #45474c;
            font-weight: 600;
            font-size: 14px;
        }
        .header-icons {
            display: flex;
            gap: 1rem;
            color: #45474c;
        }
        main {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            width: 100%;
            z-index: 10;
        }
        .card {
            width: 100%;
            max-width: 440px;
            background-color: #ffffff;
            border-radius: 0.75rem;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            border: 1px solid #e2e2e2;
            box-shadow: 0 20px 50px rgba(30, 41, 59, 0.08);
        }
        .icon-container {
            width: 6rem;
            height: 6rem;
            border-radius: 9999px;
            background-color: #ffdad6;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 2rem;
            border: 4px solid #ffffff;
            box-shadow: 0 0 40px rgba(186, 26, 26, 0.15);
        }
        .title {
            font-size: 2rem;
            font-weight: 700;
            color: #091426;
            margin-bottom: 0.5rem;
            text-align: center;
        }
        .subtitle {
            font-size: 16px;
            color: #595f66;
            text-align: center;
            line-height: 1.5;
            padding: 0 1rem;
        }
        .info-text {
            margin-top: 2rem;
            font-size: 12px;
            color: #595f66;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }
        footer {
            position: absolute;
            bottom: 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding-bottom: 2rem;
            gap: 0.5rem;
            background: transparent;
            z-index: 0;
        }
        .footer-links {
            display: flex;
            gap: 1rem;
            margin-bottom: 0.5rem;
        }
        .footer-links a {
            font-size: 12px;
            color: #595f66;
            text-decoration: none;
            transition: color 0.2s;
        }
        .footer-links a:hover {
            color: #091426;
        }
        .footer-copy {
            font-size: 12px;
            font-weight: 500;
            color: #595f66;
        }
        svg {
            fill: currentColor;
        }
    </style>
</head>
<body>
<header>
    <div class="header-logo">
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1 .9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        <span>PolyOS Lab</span>
    </div>
    <div class="header-icons">
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 21l-1.45-1.45C5.4 14.47 2 11.39 2 7.5 2 4.42 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.42 22 7.5c0 3.89-3.4 6.97-8.55 12.05L12 21z" style="display:none;"/><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c3.9 3.9 10.2 3.9 14.1 0l-1.62-1.62C18.06 16.24 18.8 14.29 18.8 12.2c0-4.97-4.03-9-9-9zm0 15c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8l7.52 7.52c-.67.43-1.45.68-2.22.68zm4.49-2.73l-7.85-7.85C9.31 6.84 10.6 6.2 12 6.2c3.31 0 6 2.69 6 6 0 1.2-.36 2.32-.97 3.27z"/></svg></svg>
        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M17 5H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-1 11H4V8h12v8zm5-7.5l-3 3v1l3 3V8.5z" style="display:none;"/><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
    </div>
</header>
<main>
    <div class="card">
        <div class="icon-container">
            <svg width="48" height="48" viewBox="0 0 24 24" style="color: #ba1a1a;"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1 .9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        </div>
        <h1 class="title">Erişim Kısıtlandı</h1>
        <p class="subtitle">Bu bilgisayar PolyOS Lab politikaları gereği veya öğretmeniniz tarafından kilitlenmiştir.</p>
        <div class="info-text">
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            <span>Kilit açma yetkisi yalnızca öğretmendedir.</span>
        </div>
    </div>
</main>
<footer>
    <div class="footer-links">
        <a href="#">Yardım</a>
        <a href="#">Güvenlik Bildirimi</a>
    </div>
    <div class="footer-copy">Developed by Emirhan Gök</div>
</footer>
</body>
</html>`

	tmpHTML := filepath.Join(os.TempDir(), "polyos_lock.html")
	_ = os.WriteFile(tmpHTML, []byte(htmlContent), 0644)

	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", "-a", "Google Chrome", "--args", "--kiosk", "--user-data-dir=/tmp/polyos_lock_chrome", "--app=file://"+tmpHTML)
		if err := cmd.Start(); err != nil {
			cmd = exec.Command("open", tmpHTML)
			_ = cmd.Start()
		}
		lockOverlayCmd = cmd
	} else {
		// Ensure the custom firefox profile directory exists and is accessible
		firefoxProfileDir := "/tmp/polyos_lock_firefox"
		_ = os.MkdirAll(firefoxProfileDir, 0777)
		_ = os.Chmod(firefoxProfileDir, 0777)

		browsers := [][]string{
			{"firefox", "--new-instance", "--profile", firefoxProfileDir, "--kiosk", "file://" + tmpHTML},
			{"chromium-browser", "--kiosk", "--user-data-dir=/tmp/polyos_lock_chrome", "--app=file://" + tmpHTML},
			{"chromium", "--kiosk", "--user-data-dir=/tmp/polyos_lock_chrome", "--app=file://" + tmpHTML},
			{"google-chrome", "--kiosk", "--user-data-dir=/tmp/polyos_lock_chrome", "--app=file://" + tmpHTML},
		}

		for _, b := range browsers {
			c, err := runAndMonitorGUICommand("LockScreen", b[0], b[1:]...)
			if err == nil {
				lockOverlayCmd = c
				break
			}
		}

		if lockOverlayCmd == nil {
			pyCode := `import tkinter as tk
root = tk.Tk()
root.attributes('-fullscreen', True)
root.configure(bg='white')
lbl_icon = tk.Label(root, text="🔒", fg='#ba1a1a', bg='white', font=('Arial', 82))
lbl_icon.pack(expand=True, pady=(150, 10))
lbl_text = tk.Label(root, text="Erişim Kısıtlandı", fg='#091426', bg='white', font=('Arial', 32, 'bold'))
lbl_text.pack(expand=True, pady=(10, 10))
lbl_sub = tk.Label(root, text="Bu bilgisayar PolyOS Lab politikaları gereği veya öğretmeniniz tarafından kilitlenmiştir.", fg='#595f66', bg='white', font=('Arial', 20))
lbl_sub.pack(expand=True, pady=(10, 150))
root.mainloop()
`
			tmpPy := filepath.Join(os.TempDir(), "polyos_lock.py")
			_ = os.WriteFile(tmpPy, []byte(pyCode), 0644)
			c, err := runAndMonitorGUICommand("LockScreenPython", "python3", tmpPy)
			if err == nil {
				lockOverlayCmd = c
			}
		}
	}
}

func stopLockOverlay() {
	lockMutex.Lock()
	defer lockMutex.Unlock()

	if lockOverlayCmd != nil {
		_ = lockOverlayCmd.Process.Kill()
		_ = lockOverlayCmd.Wait()
		lockOverlayCmd = nil
	}
	killProcessByName("firefox")
	killProcessByName("chromium-browser")
	killProcessByName("chromium")
	killProcessByName("chrome")
	_ = os.Remove(filepath.Join(os.TempDir(), "polyos_lock.html"))
	_ = os.Remove(filepath.Join(os.TempDir(), "polyos_lock.py"))
}

func setInputsEnabled(enabled bool) {
	if runtime.GOOS == "darwin" {
		log.Printf("[MOCK] Girişler Etkin: %t\n", enabled)
		return
	}
	val := "0"
	if enabled {
		val = "1"
	}

	user := getLoggedInGUIUser()
	xauth := getXAuthorityPath(user)

	cmdList := exec.Command(findExecutable("xinput"), "list", "--id-only")
	cmdList.Env = append(os.Environ(), "DISPLAY=:0")
	if xauth != "" {
		cmdList.Env = append(cmdList.Env, "XAUTHORITY="+xauth)
	}

	out, err := cmdList.Output()
	if err == nil {
		ids := strings.Fields(string(out))
		for _, id := range ids {
			cmdSet := exec.Command(findExecutable("xinput"), "set-prop", id, "Device Enabled", val)
			cmdSet.Env = append(os.Environ(), "DISPLAY=:0")
			if xauth != "" {
				cmdSet.Env = append(cmdSet.Env, "XAUTHORITY="+xauth)
			}
			_ = cmdSet.Run()
		}
	}
}

func blockUSBDevices(block bool) error {
	if runtime.GOOS == "darwin" {
		log.Printf("[MOCK] USB Engelleme: %t\n", block)
		return nil
	}
	confPath := "/etc/modprobe.d/block_usb.conf"
	if block {
		content := "blacklist usb-storage\nblacklist uas\n"
		err := os.WriteFile(confPath, []byte(content), 0644)
		if err != nil {
			tmpFile := os.TempDir() + "/block_usb_temp"
			_ = os.WriteFile(tmpFile, []byte(content), 0644)
			_ = exec.Command("pkexec", "cp", tmpFile, confPath).Run()
			_ = os.Remove(tmpFile)
		}
		_ = exec.Command("pkexec", "modprobe", "-r", "usb-storage", "uas").Run()
		_ = exec.Command("modprobe", "-r", "usb-storage", "uas").Run()
	} else {
		_ = os.Remove(confPath)
		_ = exec.Command("pkexec", "modprobe", "usb-storage", "uas").Run()
		_ = exec.Command("modprobe", "usb-storage", "uas").Run()
	}
	return nil
}

var (
	screenShareCmd    *exec.Cmd
	screenShareMutex  sync.Mutex
)

func startScreenShareViewer() {
	screenShareMutex.Lock()
	defer screenShareMutex.Unlock()

	if screenShareCmd != nil {
		return // Zaten açık
	}

	shareURL := getShareURL()
	// Reconstruct WebSocket share URL for student stream: ws://<server_ip>:<port>/ws/student-viewer
	wsShareURL := strings.Replace(shareURL, "http://", "ws://", 1)
	wsShareURL = strings.Replace(wsShareURL, "https://", "wss://", 1)
	if !strings.HasSuffix(wsShareURL, "/ws/student-viewer") {
		// If it is /share, map to /ws/student-viewer
		wsShareURL = strings.Replace(wsShareURL, "/share", "/ws/student-viewer", 1)
	}

	log.Printf("[ScreenShare] Python Tkinter yansıtıcı başlatılıyor: %s\n", wsShareURL)

	pyCode := fmt.Sprintf(`import tkinter as tk
import websocket
import base64
import io
import threading
from PIL import Image, ImageTk

class ScreenViewer:
    def __init__(self, root, url):
        self.root = root
        self.url = url
        self.root.title("PolyOS Lab - Öğretmen Ekranı")
        self.root.attributes('-fullscreen', True)
        self.root.configure(bg='black')
        
        # Prevent window closing manually
        self.root.protocol("WM_DELETE_WINDOW", lambda: None)
        
        # Label to display image, configured to fill everything with zero borders/padding
        self.label = tk.Label(self.root, bg='black', bd=0, highlightthickness=0)
        self.label.pack(expand=True, fill='both')
        
        # Bind keys
        self.root.bind("<Escape>", lambda e: None)
        
        self.ws = None
        self.thread = threading.Thread(target=self.connect_ws, daemon=True)
        self.thread.start()

    def connect_ws(self):
        def on_message(ws, message):
            try:
                img_data = base64.b64decode(message)
                image = Image.open(io.BytesIO(img_data))
                
                # Dynamic full-screen resizing fitting coordinates exactly
                screen_width = self.root.winfo_screenwidth()
                screen_height = self.root.winfo_screenheight()
                
                img_width, img_height = image.size
                ratio = min(screen_width/img_width, screen_height/img_height)
                new_width = int(img_width * ratio)
                new_height = int(img_height * ratio)
                
                image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
                photo = ImageTk.PhotoImage(image)
                
                self.label.config(image=photo)
                self.label.image = photo
            except Exception as e:
                print("Image error:", e)

        def on_error(ws, error):
            print("WS Error:", error)

        def on_close(ws, close_status_code, close_msg):
            print("WS Closed")

        self.ws = websocket.WebSocketApp(
            self.url,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close
        )
        self.ws.run_forever()

if __name__ == "__main__":
    root = tk.Tk()
    app = ScreenViewer(root, "%s")
    root.mainloop()
`, wsShareURL)

	tmpPy := filepath.Join(os.TempDir(), "polyos_share_viewer.py")
	_ = os.WriteFile(tmpPy, []byte(pyCode), 0644)

	c, err := runAndMonitorGUICommand("ScreenShareTkinter", "python3", tmpPy)
	if err == nil {
		screenShareCmd = c
	} else {
		// Fallback to browsers if tkinter fails
		browsers := [][]string{
			{"firefox", "--new-instance", "--profile", "/tmp/polyos_share_firefox", "--kiosk", shareURL},
			{"chromium-browser", "--kiosk", "--no-first-run", "--no-default-browser-check", "--user-data-dir=/tmp/polyos_share_chrome", shareURL},
			{"chromium", "--kiosk", "--no-first-run", "--no-default-browser-check", "--user-data-dir=/tmp/polyos_share_chrome", shareURL},
		}
		for _, b := range browsers {
			c, err := runAndMonitorGUICommand("ScreenShareBrowser", b[0], b[1:]...)
			if err == nil {
				screenShareCmd = c
				break
			}
		}
	}
}

func stopScreenShareViewer() {
	screenShareMutex.Lock()
	defer screenShareMutex.Unlock()

	if screenShareCmd != nil {
		_ = screenShareCmd.Process.Kill()
		_ = screenShareCmd.Wait()
		screenShareCmd = nil
	}
	killProcessByName("firefox")
	killProcessByName("chromium-browser")
	killProcessByName("chromium")
	killProcessByName("chrome")
	_ = os.Remove(filepath.Join(os.TempDir(), "polyos_share_viewer.py"))
}

func convertJpegBase64ToPngBase64(jpegB64 string) (string, error) {
	jpegBytes, err := base64.StdEncoding.DecodeString(jpegB64)
	if err != nil {
		return "", err
	}

	img, err := jpeg.Decode(bytes.NewReader(jpegBytes))
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	err = png.Encode(&buf, img)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// İşletim sistemine göre komutları çalıştıran fonksiyon
func runSystemCommand(action string) {
	log.Printf("Komut çalıştırılıyor: %s (OS: %s)\n", action, runtime.GOOS)

	if action == "block_usb" {
		_ = blockUSBDevices(true)
		return
	}
	if action == "unblock_usb" {
		_ = blockUSBDevices(false)
		return
	}
	
	if action == "screen_share_on" {
		setInputsEnabled(false)
		startScreenShareViewer()
		return
	}
	if action == "screen_share_off" {
		stopScreenShareViewer()
		setInputsEnabled(true)
		return
	}
	
	if strings.HasPrefix(action, "open_url:") {
		url := strings.TrimPrefix(action, "open_url:")
		if runtime.GOOS == "darwin" {
			runCommandWithLog("open", url)
		} else {
			c := runGUICommand("xdg-open", url)
			_ = c.Run()
		}
		return
	}

	if strings.HasPrefix(action, "show_message:") {
		msg := strings.TrimPrefix(action, "show_message:")
		if runtime.GOOS == "darwin" {
			runCommandWithLog("osascript", "-e", fmt.Sprintf(`display dialog "%s" buttons {"Tamam"} default button "Tamam" with title "PolyOS Lab"`, msg))
		} else {
			// Linux/Pardus: zenity or notify-send
			c := runGUICommand("zenity", "--info", "--text="+msg, "--title=PolyOS Lab", "--width=350")
			err := c.Run()
			if err != nil {
				// Fallback to notify-send
				c2 := runGUICommand("notify-send", "PolyOS Lab", msg)
				_ = c2.Run()
			}
		}
		return
	}

	if action == "internet_off" {
		if runtime.GOOS == "darwin" {
			runCommandWithLog("networksetup", "-setnetworkserviceenabled", "Wi-Fi", "off")
		} else {
			iptablesPath := findExecutable("iptables")
			ip6tablesPath := findExecutable("ip6tables")
			serverIP := getServerIP()

			// Create custom POLYOS_BLOCK chain (IPv4) and reject non-local traffic
			_ = exec.Command(iptablesPath, "-N", "POLYOS_BLOCK").Run()
			_ = exec.Command(iptablesPath, "-F", "POLYOS_BLOCK").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-o", "lo", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-i", "lo", "-j", "ACCEPT").Run()
			
			// Whitelist resolved server IP specifically first
			if serverIP != "" && serverIP != "localhost" && serverIP != "127.0.0.1" {
				_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-d", serverIP, "-j", "ACCEPT").Run()
				_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-s", serverIP, "-j", "ACCEPT").Run()
			}

			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-d", "192.168.0.0/16", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-s", "192.168.0.0/16", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-d", "10.0.0.0/8", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-s", "10.0.0.0/8", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-d", "172.16.0.0/12", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-s", "172.16.0.0/12", "-j", "ACCEPT").Run()
			_ = exec.Command(iptablesPath, "-A", "POLYOS_BLOCK", "-j", "REJECT").Run()
			
			// Insert POLYOS_BLOCK jump rule to OUTPUT and INPUT if not already there
			if exec.Command(iptablesPath, "-C", "OUTPUT", "-j", "POLYOS_BLOCK").Run() != nil {
				_ = exec.Command(iptablesPath, "-I", "OUTPUT", "1", "-j", "POLYOS_BLOCK").Run()
			}
			if exec.Command(iptablesPath, "-C", "INPUT", "-j", "POLYOS_BLOCK").Run() != nil {
				_ = exec.Command(iptablesPath, "-I", "INPUT", "1", "-j", "POLYOS_BLOCK").Run()
			}

			// Create custom POLYOS_BLOCK chain (IPv6) and reject non-local traffic
			_ = exec.Command(ip6tablesPath, "-N", "POLYOS_BLOCK").Run()
			_ = exec.Command(ip6tablesPath, "-F", "POLYOS_BLOCK").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-o", "lo", "-j", "ACCEPT").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-i", "lo", "-j", "ACCEPT").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-d", "fe80::/10", "-j", "ACCEPT").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-s", "fe80::/10", "-j", "ACCEPT").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-d", "fc00::/7", "-j", "ACCEPT").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-s", "fc00::/7", "-j", "ACCEPT").Run()
			_ = exec.Command(ip6tablesPath, "-A", "POLYOS_BLOCK", "-j", "REJECT").Run()

			// Insert POLYOS_BLOCK jump rule to OUTPUT and INPUT (IPv6) if not already there
			if exec.Command(ip6tablesPath, "-C", "OUTPUT", "-j", "POLYOS_BLOCK").Run() != nil {
				_ = exec.Command(ip6tablesPath, "-I", "OUTPUT", "1", "-j", "POLYOS_BLOCK").Run()
			}
			if exec.Command(ip6tablesPath, "-C", "INPUT", "-j", "POLYOS_BLOCK").Run() != nil {
				_ = exec.Command(ip6tablesPath, "-I", "INPUT", "1", "-j", "POLYOS_BLOCK").Run()
			}

			log.Println("İnternet kısıtlandı (POLYOS_BLOCK IPv4 ve IPv6 INPUT/OUTPUT aktif). Yerel ağ bağlantısı korundu.")
		}
		return
	}

	if action == "internet_on" {
		if runtime.GOOS == "darwin" {
			runCommandWithLog("networksetup", "-setnetworkserviceenabled", "Wi-Fi", "on")
		} else {
			iptablesPath := findExecutable("iptables")
			ip6tablesPath := findExecutable("ip6tables")

			// Tear down POLYOS_BLOCK chain (IPv4)
			_ = exec.Command(iptablesPath, "-D", "OUTPUT", "-j", "POLYOS_BLOCK").Run()
			_ = exec.Command(iptablesPath, "-D", "INPUT", "-j", "POLYOS_BLOCK").Run()
			_ = exec.Command(iptablesPath, "-F", "POLYOS_BLOCK").Run()
			_ = exec.Command(iptablesPath, "-X", "POLYOS_BLOCK").Run()

			// Tear down POLYOS_BLOCK chain (IPv6)
			_ = exec.Command(ip6tablesPath, "-D", "OUTPUT", "-j", "POLYOS_BLOCK").Run()
			_ = exec.Command(ip6tablesPath, "-D", "INPUT", "-j", "POLYOS_BLOCK").Run()
			_ = exec.Command(ip6tablesPath, "-F", "POLYOS_BLOCK").Run()
			_ = exec.Command(ip6tablesPath, "-X", "POLYOS_BLOCK").Run()

			log.Println("İnternet kısıtlaması kaldırıldı (POLYOS_BLOCK IPv4 ve IPv6 silindi).")
		}
		return
	}

	if strings.HasPrefix(action, "block_site:") {
		domain := strings.TrimPrefix(action, "block_site:")
		err := updateHostsFile(domain, true)
		if err != nil {
			log.Println("Domain engellenirken hata oluştu:", err)
		} else {
			log.Printf("Domain başarıyla engellendi: %s\n", domain)
			flushDNSCache()
		}
		return
	}

	if strings.HasPrefix(action, "unblock_site:") {
		domain := strings.TrimPrefix(action, "unblock_site:")
		err := updateHostsFile(domain, false)
		if err != nil {
			log.Println("Domain engeli kaldırılırken hata oluştu:", err)
		} else {
			log.Printf("Domain engeli başarıyla kaldırıldı: %s\n", domain)
			flushDNSCache()
		}
		return
	}
	
	if runtime.GOOS == "darwin" {
		// macOS (Simülasyon ve test)
		switch action {
		case "lock":
			startLockOverlay()
			setInputsEnabled(false)
			runCommandWithLog("osascript", "-e", `display notification "Ekran Kilitlendi" with title "PolyOS Lab"`)
			runCommandWithLog("pmset", "displaysleepnow")
		case "unlock":
			stopLockOverlay()
			setInputsEnabled(true)
			runCommandWithLog("osascript", "-e", `display notification "Ekran Kilidi Açıldı" with title "PolyOS Lab"`)
		case "sleep":
			runCommandWithLog("pmset", "sleepnow")
		case "reboot":
			runCommandWithLog("osascript", "-e", `display dialog "PolyOS Lab: Yeniden başlatma komutu alındı." buttons {"Tamam"} default button "Tamam"`)
		case "shutdown":
			runCommandWithLog("osascript", "-e", `display dialog "PolyOS Lab: Kapatma komutu alındı." buttons {"Tamam"} default button "Tamam"`)
		}
	} else {
		// Linux (Pardus)
		switch action {
		case "lock":
			startLockOverlay()
			setInputsEnabled(false)
		case "unlock":
			stopLockOverlay()
			setInputsEnabled(true)
		case "sleep":
			runCommandWithLog("systemctl", "suspend")
		case "reboot":
			runCommandWithLog("systemctl", "reboot")
		case "shutdown":
			runCommandWithLog("systemctl", "poweroff")
		}
	}
}

// Sunucudan gönderilen dosyayı indirip masaüstüne kaydeden fonksiyon
func handleFileTransfer(fileURL, filename string) {
	// Reconstruct the URL using the correct, reachable server address we are communicating with
	activeServer := getServerHTTPURL()
	fileURL = activeServer + "/uploads/" + filename
	log.Printf("Dosya transfer isteği alındı (yeniden yapılandırıldı): %s -> %s\n", filename, fileURL)

	// Dosyayı indir
	resp, err := http.Get(fileURL)
	if err != nil {
		log.Println("Dosya indirilemedi:", err)
		return
	}
	defer resp.Body.Close()

	// Hedef masaüstü dizinini belirle
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Println("Kullanıcı ev dizini bulunamadı:", err)
		return
	}

	var desktopPath string
	if runtime.GOOS == "darwin" {
		desktopPath = filepath.Join(homeDir, "Desktop")
	} else {
		// Türkçe Pardus için "Masaüstü", İngilizce için "Desktop" kontrolü
		desktopPath = filepath.Join(homeDir, "Masaüstü")
		if _, err := os.Stat(desktopPath); os.IsNotExist(err) {
			desktopPath = filepath.Join(homeDir, "Desktop")
		}
	}

	// Eğer klasör yoksa oluştur (güvenlik için)
	_ = os.MkdirAll(desktopPath, 0755)

	targetFile := filepath.Join(desktopPath, filename)
	out, err := os.Create(targetFile)
	if err != nil {
		log.Println("Hedef dosya oluşturulamadı:", err)
		return
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		log.Println("Dosya yazılırken hata oluştu:", err)
		return
	}

	log.Printf("Dosya başarıyla kaydedildi: %s\n", targetFile)

	// Başarılı bildirim gönder
	if runtime.GOOS == "darwin" {
		runCommandWithLog("osascript", "-e", `display notification "`+filename+` başarıyla Masaüstüne kaydedildi." with title "Dosya Alındı"`)
	} else {
		runCommandWithLog("notify-send", "Dosya Alındı", filename+" başarıyla Masaüstüne kaydedildi.")
	}
}

// macOS'te CoreGraphics API ile tıklama gerçekleştiren Swift scripti tetikleyicisi
func macosClick(xStr, yStr string, rightClick bool) {
	btnType := ".left"
	mouseDownType := ".leftMouseDown"
	mouseUpType := ".leftMouseUp"
	
	if rightClick {
		btnType = ".right"
		mouseDownType = ".rightMouseDown"
		mouseUpType = ".rightMouseUp"
	}

	swiftCode := fmt.Sprintf(`
import Foundation
import CoreGraphics

let point = CGPoint(x: %s, y: %s)
let source = CGEventSource(stateID: .combinedSessionState)

let mouseDown = CGEvent(mouseEventSource: source, mouseType: %s, mouseCursorPosition: point, mouseButton: %s)
mouseDown?.post(tap: .cghidEventTap)

let mouseUp = CGEvent(mouseEventSource: source, mouseType: %s, mouseCursorPosition: point, mouseButton: %s)
mouseUp?.post(tap: .cghidEventTap)
`, xStr, yStr, mouseDownType, btnType, mouseUpType, btnType)

	runCommandWithLog("swift", "-e", swiftCode)
}

// Fare, klavye ve uzaktan kontrol girdilerini simüle eden fonksiyon
func handleInputEvent(event string, data map[string]interface{}) {
	log.Printf("Girdi olayı alınıp simüle ediliyor: %s\n", event)

	switch event {
	case "start_control":
		log.Println("Uzaktan kontrol modu aktif: Akış hızı 100ms'ye düşürüldü.")
		setCaptureInterval(100 * time.Millisecond)
	case "stop_control":
		log.Println("Uzaktan kontrol modu pasif: Akış hızı 2sn'ye çekildi.")
		setCaptureInterval(2000 * time.Millisecond)
	case "mousemove", "click":
		xPct, _ := data["x"].(float64)
		yPct, _ := data["y"].(float64)
		w, h := getScreenResolution()
		
		xStr := strconv.Itoa(int(xPct * float64(w)))
		yStr := strconv.Itoa(int(yPct * float64(h)))

		if runtime.GOOS == "darwin" {
			// macOS Swift tık simülasyonu
			rightClick := false
			if button, ok := data["button"].(string); ok && button == "right" {
				rightClick = true
			}
			macosClick(xStr, yStr, rightClick)
		} else {
			// Linux/Pardus xdotool
			if event == "mousemove" {
				runCommandWithLog("xdotool", "mousemove", xStr, yStr)
			} else if event == "click" {
				button, _ := data["button"].(string)
				btnCode := "1" // sol tık
				if button == "right" {
					btnCode = "3" // sağ tık
				}
				runCommandWithLog("xdotool", "mousemove", xStr, yStr, "click", btnCode)
			}
		}
	case "key":
		key, _ := data["key"].(string)
		if runtime.GOOS == "darwin" {
			runCommandWithLog("osascript", "-e", fmt.Sprintf(`tell application "System Events" to keystroke "%s"`, key))
		} else {
			runCommandWithLog("xdotool", "key", key)
		}
	case "clipboard":
		text, _ := data["text"].(string)
		if runtime.GOOS == "darwin" {
			cmd := exec.Command("pbcopy")
			in, _ := cmd.StdinPipe()
			cmd.Start()
			in.Write([]byte(text))
			in.Close()
			cmd.Wait()
		} else {
			cmd := exec.Command("xclip", "-selection", "clipboard")
			in, _ := cmd.StdinPipe()
			cmd.Start()
			in.Write([]byte(text))
			in.Close()
			cmd.Wait()
		}
	}
}

func main() {
	setupLogging()
	defer closeLogging()

	log.Println("PolyOS Lab İstemcisi başlatılıyor...")

	// Konfigürasyonu yükle
	loadConfig()

	// Eğer sunucu adresi belirtilmemişse veya varsayılansa UDP keşfi dene
	if serverURL == "ws://localhost:8080/ws" {
		discoverServer()
	}

	// Yönlendirme sunucusunu başlat (sudo ile çalıştırıldıysa :80 portunu dinler)
	startLocalRedirectServer(serverURL)

	hostname, err := os.Hostname()
	if err != nil {
		hostname = "Bilinmeyen-Pardus"
	}

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	for {
		// Eğer sunucu adresi varsayılan ise veya keşfedilemediyse her denemede tekrar keşfetmeyi dene
		if serverURL == "ws://localhost:8080/ws" {
			discoverServer()
		}

		dialURL := fmt.Sprintf("%s?token=%s", serverURL, secretToken)
		log.Printf("Bağlanılıyor: %s (Cihaz: %s)...\n", serverURL, hostname)

		c, _, err := websocket.DefaultDialer.Dial(dialURL, nil)
		if err != nil {
			log.Println("Bağlantı başarısız, 5 saniye içinde tekrar deneniyor...", err)
			time.Sleep(5 * time.Second)
			log.Println("Bağlantı kurulamadı, mDNS ile sunucu tekrar aranıyor...")
			discoverServer()
			continue
		}

		// Sisteme bağlandığını bildiren ilk mesaj (Handshake)
		handshake := map[string]string{
			"hostname": hostname,
			"mac":      getMACAddress(),
			"version":  clientVersion,
		}
		wsWriteMutex.Lock()
		err = c.WriteJSON(handshake)
		wsWriteMutex.Unlock()
		if err != nil {
			log.Println("Handshake gönderilemedi, yeniden deneniyor...", err)
			c.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		wsMutex.Lock()
		wsConn = c
		wsMutex.Unlock()

		log.Println("Sunucuya başarıyla bağlanıldı!")

		done := make(chan struct{})

		// Sunucudan gelen komutları ve dosya aktarımlarını dinle
		go func() {
			defer func() {
				c.Close()
				wsMutex.Lock()
				if wsConn == c {
					wsConn = nil
				}
				wsMutex.Unlock()
				close(done)
			}()
			for {
				_, message, err := c.ReadMessage()
				if err != nil {
					log.Println("Sunucu bağlantısı koptu (Okuma hatası):", err)
					return
				}
				
				var cmdData map[string]interface{}
				if err := json.Unmarshal(message, &cmdData); err == nil {
					action, _ := cmdData["action"].(string)
					event, _ := cmdData["event"].(string)
					
					if action == "file_transfer" {
						url, _ := cmdData["url"].(string)
						filename, _ := cmdData["filename"].(string)
						handleFileTransfer(url, filename)
					} else if event != "" {
						handleInputEvent(event, cmdData)
					} else if strings.HasPrefix(action, "quality_") {
						switch action {
						case "quality_low":
							setScreenQuality(15)
							log.Println("Ekran kalitesi Düşük (15) olarak ayarlandı.")
						case "quality_medium":
							setScreenQuality(30)
							log.Println("Ekran kalitesi Orta (30) olarak ayarlandı.")
						case "quality_high":
							setScreenQuality(60)
							log.Println("Ekran kalitesi Yüksek (60) olarak ayarlandı.")
						}
					} else if action == "run_terminal" {
						cmdStr, _ := cmdData["command"].(string)
						cmdID, _ := cmdData["command_id"].(string)
						go executeTerminalCommand(cmdStr, cmdID)
					} else {
						runSystemCommand(action)
					}
				} else {
					// Discard binary frames on the control socket. The kiosk browser
					// connects directly to the server's /ws/student-viewer stream.
				}
			}
		}()

		// Ekran akışı gönderim döngüsü (Dinamik hız)
		go func() {
			for {
				select {
				case <-done:
					return
				case <-time.After(getCaptureInterval()):
					imgBytes := captureScreen()
					if imgBytes == nil {
						continue
					}

					base64Str := base64.StdEncoding.EncodeToString(imgBytes)
					screenMsg := map[string]string{
						"type": "screen",
						"data": base64Str,
					}

					// WebSocket üzerinden sunucuya gönder
					err := safeWriteJSON(screenMsg)
					if err != nil {
						log.Println("Ekran verisi gönderilemedi:", err)
						return
					}
				}
			}
		}()

		// Telemetri gönderim döngüsü (Her 5 saniyede bir)
		go func() {
			for {
				select {
				case <-done:
					return
				case <-time.After(5 * time.Second):
					ramPct, ramTotal, ramUsed := getRAMDetails()
					diskPct, diskTotal, diskUsed := getDiskDetails()
					telData := TelemetryData{
						CPUUsage:  getCPUUsage(),
						CPUTemp:   getCPUTemp(),
						RAMUsage:  ramPct,
						DiskUsage: diskPct,
						TotalRAM:  ramTotal,
						UsedRAM:   ramUsed,
						TotalDisk: diskTotal,
						UsedDisk:  diskUsed,
					}
					_ = safeWriteJSON(map[string]interface{}{
						"type": "telemetry",
						"data": telData,
					})
				}
			}
		}()

		// Bekleme döngüsü: bağlantı kopana kadar veya interrupt gelene kadar bekle
		select {
		case <-done:
			log.Println("Bağlantı kesildi, 5 saniye içinde yeniden bağlanılacak...")
			wsMutex.Lock()
			wsConn = nil
			wsMutex.Unlock()
			time.Sleep(5 * time.Second)
		case <-interrupt:
			log.Println("İstemci kapatılıyor...")
			wsMutex.Lock()
			wsConn = nil
			wsMutex.Unlock()
			_ = c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			c.Close()
			return
		}
	}
}

var (
	terminalCwd      string
	terminalCwdMutex sync.Mutex
)

func executeTerminalCommand(cmdStr, cmdID string) {
	log.Printf("[Terminal] Komut çalıştırılıyor: %s\n", cmdStr)
	
	terminalCwdMutex.Lock()
	if terminalCwd == "" {
		if home, err := os.UserHomeDir(); err == nil {
			terminalCwd = home
		} else {
			terminalCwd = "/"
		}
	}
	currentDir := terminalCwd
	terminalCwdMutex.Unlock()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		wrappedCmd := fmt.Sprintf("%s & echo. & echo POLYOS_CWD: & cd", cmdStr)
		cmd = exec.Command("cmd", "/c", wrappedCmd)
	} else {
		wrappedCmd := fmt.Sprintf("%s; echo ''; echo 'POLYOS_CWD:'; pwd", cmdStr)
		cmd = exec.Command("/bin/sh", "-c", wrappedCmd)
	}
	
	cmd.Dir = currentDir

	out, err := cmd.CombinedOutput()
	outputStr := string(out)

	var newCwd string
	cwdMarker := "POLYOS_CWD:"
	if idx := strings.LastIndex(outputStr, cwdMarker); idx != -1 {
		part := outputStr[idx+len(cwdMarker):]
		part = strings.TrimSpace(part)
		if part != "" {
			newCwd = part
			outputStr = outputStr[:idx]
			outputStr = strings.TrimRight(outputStr, "\r\n")
		}
	}

	if newCwd != "" {
		terminalCwdMutex.Lock()
		terminalCwd = newCwd
		terminalCwdMutex.Unlock()
		log.Printf("[Terminal] Yeni dizin: %s\n", newCwd)
	}

	if err != nil && outputStr == "" {
		outputStr = "Hata: " + err.Error()
	}

	log.Printf("[Terminal] Çıktı uzunluğu: %d\n", len(outputStr))

	payload := map[string]interface{}{
		"type": "terminal_output",
		"data": map[string]string{
			"command_id": cmdID,
			"output":     outputStr,
		},
	}
	err = safeWriteJSON(payload)
	if err != nil {
		log.Printf("[Terminal] WebSocket gönderme hatası: %v\n", err)
	} else {
		log.Println("[Terminal] Çıktı sunucuya gönderildi.")
	}
}

// Dosyayı yetkili olarak güncellemeye çalışan yedek fonksiyon
func writeHostsWithSudo(content string) error {
	tmpFile := os.TempDir() + "/polyos_hosts_temp"
	err := os.WriteFile(tmpFile, []byte(content), 0644)
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile)

	if runtime.GOOS == "darwin" {
		// macOS AppleScript yetkilendirme penceresi
		script := fmt.Sprintf(`do shell script "cp %s /etc/hosts" with administrator privileges`, tmpFile)
		return exec.Command("osascript", "-e", script).Run()
	} else {
		// Linux pkexec yetkilendirme penceresi
		return exec.Command("pkexec", "cp", tmpFile, "/etc/hosts").Run()
	}
}

// hosts dosyasında domain engelleme / engel kaldırma
func updateHostsFile(domain string, block bool) error {
	hostsPath := "/etc/hosts"
	if runtime.GOOS == "windows" {
		hostsPath = `C:\Windows\System32\drivers\etc\hosts`
	}

	data, err := os.ReadFile(hostsPath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(data), "\n")
	var newLines []string
	domainLower := strings.ToLower(strings.TrimSpace(domain))
	// Protocol takılarını temizle
	domainLower = strings.TrimPrefix(domainLower, "http://")
	domainLower = strings.TrimPrefix(domainLower, "https://")
	// Yol (path) veya port varsa temizle
	if idx := strings.Index(domainLower, "/"); idx != -1 {
		domainLower = domainLower[:idx]
	}
	if idx := strings.Index(domainLower, ":"); idx != -1 {
		domainLower = domainLower[:idx]
	}

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			newLines = append(newLines, line)
			continue
		}
		fields := strings.Fields(trimmed)
		if len(fields) >= 2 {
			currentDomain := strings.ToLower(fields[1])
			if currentDomain == domainLower || currentDomain == "www."+domainLower {
				continue // bu satırı atla (eski kaydı temizle)
			}
		}
		newLines = append(newLines, line)
	}

	if block {
		newLines = append(newLines, fmt.Sprintf("127.0.0.1 %s", domainLower))
		newLines = append(newLines, fmt.Sprintf("127.0.0.1 www.%s", domainLower))
	}

	output := strings.Join(newLines, "\n")
	
	// Önce doğrudan yazmayı dene
	err = os.WriteFile(hostsPath, []byte(output), 0644)
	if err != nil {
		// Doğrudan yazma yetki hatası verirse sudo ile dene
		log.Println("[YETKİ UYARISI] hosts dosyası doğrudan yazılamadı, yönetici yetkisi isteniyor...")
		return writeHostsWithSudo(output)
	}
	return nil
}

// Sunucu adresini WS URL'sinden çıkaran fonksiyon
func getServerHost(serverURL string) string {
	u := strings.TrimPrefix(serverURL, "ws://")
	u = strings.TrimPrefix(u, "wss://")
	parts := strings.Split(u, "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return "localhost:8080"
}

// Engellenen siteleri sunucu üzerindeki /blocked sayfasına yönlendiren yerel HTTP sunucusu
func startLocalRedirectServer(serverURL string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		serverHost := getServerHost(serverURL)
		
		// Eğer istek zaten localhost veya serverHost adresine ise yönlendirme döngüsüne girmesin
		if strings.Contains(host, "localhost") || strings.Contains(host, "127.0.0.1") || strings.Contains(host, serverHost) {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		redirectURL := fmt.Sprintf("http://%s/blocked?site=%s", serverHost, host)
		http.Redirect(w, r, redirectURL, http.StatusFound)
	})

	server := &http.Server{
		Addr:    ":80",
		Handler: mux,
	}

	go func() {
		log.Println("Yerel yönlendirme sunucusu başlatılıyor (:80)...")
		err := server.ListenAndServe()
		if err != nil {
			log.Println("Yerel yönlendirme sunucusu başlatılamadı (Muhtemelen port 80 dolu veya sudo yetkisi yok):", err)
		}
	}()
}

// DNS önbelleğini temizleyerek yeni kuralların anında geçerli olmasını sağlayan fonksiyon
func flushDNSCache() {
	log.Println("İşletim sistemi DNS önbelleği temizleniyor...")
	if runtime.GOOS == "darwin" {
		// macOS DNS önbellek temizleme
		_ = exec.Command("dscacheutil", "-flushcache").Run()
		_ = exec.Command("killall", "-HUP", "mDNSResponder").Run()
	} else {
		// Linux/Pardus önbellek temizleme (systemd-resolved vb.)
		_ = exec.Command("resolvectl", "flush-caches").Run()
		_ = exec.Command("systemd-resolve", "--flush-caches").Run()
		_ = exec.Command("systemctl", "restart", "systemd-resolved").Run()
		_ = exec.Command("nscd", "-i", "hosts").Run()
	}
}
