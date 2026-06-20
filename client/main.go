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
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	captureInterval = 2000 * time.Millisecond
	intervalMutex   sync.Mutex
	screenQuality   = 60 // Varsayılan kalite
	qualityMutex    sync.Mutex
	serverURL       = "ws://localhost:8080/ws"
	secretToken     = "polyos-secure-token"
	logFile         *os.File
)

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
	log.Println("UDP üzerinden sunucu aranıyor (Port: 9999)...")
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

	// 8 saniyelik okuma zaman aşımı
	_ = conn.SetReadDeadline(time.Now().Add(8 * time.Second))

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
			ip := parts[1]
			port := parts[2]
			serverURL = fmt.Sprintf("ws://%s:%s/ws", ip, port)
			log.Println("Sunucu otomatik keşfedildi:", serverURL)
		}
	}
}

func setupLogging() {
	if runtime.GOOS == "darwin" {
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
			log.SetOutput(logFile)
			log.Println("Log dosyası geçici klasörde açıldı:", tempLogPath)
		}
	} else {
		log.SetOutput(logFile)
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

var (
	lockOverlayCmd *exec.Cmd
	lockMutex      sync.Mutex
)

func startLockOverlay() {
	lockMutex.Lock()
	defer lockMutex.Unlock()

	if lockOverlayCmd != nil {
		return
	}

	pyCode := `import tkinter as tk
root = tk.Tk()
root.attributes('-fullscreen', True)
root.configure(bg='#1e293b')
lbl_icon = tk.Label(root, text="🔒", fg='#ee2b2b', bg='#1e293b', font=('Arial', 82))
lbl_icon.pack(expand=True, pady=(150, 10))
lbl_text = tk.Label(root, text="Bu Bilgisayar Kilitlendi", fg='white', bg='#1e293b', font=('Arial', 32, 'bold'))
lbl_text.pack(expand=True, pady=(10, 10))
lbl_sub = tk.Label(root, text="Lütfen dersinize ve öğretmeninize odaklanın.", fg='#94a3b8', bg='#1e293b', font=('Arial', 20))
lbl_sub.pack(expand=True, pady=(10, 150))
root.mainloop()
`
	tmpFile := filepath.Join(os.TempDir(), "polyos_lock.py")
	_ = os.WriteFile(tmpFile, []byte(pyCode), 0644)

	lockOverlayCmd = exec.Command("python3", tmpFile)
	_ = lockOverlayCmd.Start()
}

func stopLockOverlay() {
	lockMutex.Lock()
	defer lockMutex.Unlock()

	if lockOverlayCmd != nil {
		_ = lockOverlayCmd.Process.Kill()
		_ = lockOverlayCmd.Wait()
		lockOverlayCmd = nil
	}
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
	out, err := exec.Command("xinput", "list", "--id-only").Output()
	if err == nil {
		ids := strings.Fields(string(out))
		for _, id := range ids {
			_ = exec.Command("xinput", "set-prop", id, "Device Enabled", val).Run()
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
	screenShareWriter io.WriteCloser
	screenShareMutex  sync.Mutex
)

func startScreenShareViewer() {
	screenShareMutex.Lock()
	defer screenShareMutex.Unlock()

	if screenShareCmd != nil {
		return // Zaten açık
	}

	pyCode := `import sys
import tkinter as tk

root = tk.Tk()
root.attributes('-fullscreen', True)
root.attributes('-topmost', True)
root.overrideredirect(True)
root.configure(bg='black')

try:
    root.grab_set_global()
except:
    pass

root.bind("<Alt-F4>", lambda e: "break")
root.bind("<Alt-Tab>", lambda e: "break")

label = tk.Label(root, bg='black')
label.pack(expand=True, fill='both')

def check_stdin():
    line = sys.stdin.readline()
    if line:
        try:
            data = line.strip()
            if data == "close":
                root.destroy()
                return
            photo = tk.PhotoImage(data=data)
            label.config(image=photo)
            label.image = photo
        except Exception as e:
            pass
    root.after(15, check_stdin)

root.after(15, check_stdin)
root.mainloop()
`
	tmpFile := filepath.Join(os.TempDir(), "polyos_share_viewer.py")
	_ = os.WriteFile(tmpFile, []byte(pyCode), 0644)

	screenShareCmd = exec.Command("python3", tmpFile)
	var err error
	screenShareWriter, err = screenShareCmd.StdinPipe()
	if err == nil {
		_ = screenShareCmd.Start()
	}
}

func stopScreenShareViewer() {
	screenShareMutex.Lock()
	defer screenShareMutex.Unlock()

	if screenShareCmd != nil {
		if screenShareWriter != nil {
			_, _ = screenShareWriter.Write([]byte("close\n"))
			screenShareWriter.Close()
		}
		_ = screenShareCmd.Process.Kill()
		_ = screenShareCmd.Wait()
		screenShareCmd = nil
		screenShareWriter = nil
	}
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
			runCommandWithLog("xdg-open", url)
		}
		return
	}

	if strings.HasPrefix(action, "show_message:") {
		msg := strings.TrimPrefix(action, "show_message:")
		if runtime.GOOS == "darwin" {
			runCommandWithLog("osascript", "-e", fmt.Sprintf(`display dialog "%s" buttons {"Tamam"} default button "Tamam" with title "PolyOS Lab"`, msg))
		} else {
			// Linux/Pardus: zenity or notify-send
			cmd := exec.Command("zenity", "--info", "--text="+msg, "--title=PolyOS Lab", "--width=350")
			err := cmd.Run()
			if err != nil {
				// Fallback to notify-send
				runCommandWithLog("notify-send", "PolyOS Lab", msg)
			}
		}
		return
	}

	if action == "internet_off" {
		if runtime.GOOS == "darwin" {
			runCommandWithLog("networksetup", "-setnetworkserviceenabled", "Wi-Fi", "off")
		} else {
			runCommandWithLog("nmcli", "networking", "off")
		}
		return
	}

	if action == "internet_on" {
		if runtime.GOOS == "darwin" {
			runCommandWithLog("networksetup", "-setnetworkserviceenabled", "Wi-Fi", "on")
		} else {
			runCommandWithLog("nmcli", "networking", "on")
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
			runCommandWithLog("xdg-screensaver", "lock")
			runCommandWithLog("light-locker-command", "-l")
			runCommandWithLog("loginctl", "lock-session")
		case "unlock":
			stopLockOverlay()
			setInputsEnabled(true)
			runCommandWithLog("loginctl", "unlock-session")
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
	log.Printf("Dosya transfer isteği alındı: %s -> %s\n", filename, fileURL)

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
		dialURL := fmt.Sprintf("%s?token=%s", serverURL, secretToken)
		log.Printf("Bağlanılıyor: %s (Cihaz: %s)...\n", serverURL, hostname)

		c, _, err := websocket.DefaultDialer.Dial(dialURL, nil)
		if err != nil {
			log.Println("Bağlantı başarısız, 5 saniye içinde tekrar deneniyor...", err)
			time.Sleep(5 * time.Second)
			continue
		}

		log.Println("Sunucuya başarıyla bağlanıldı!")

		// Sisteme bağlandığını bildiren ilk mesaj (Handshake)
		handshake := map[string]string{
			"hostname": hostname,
			"mac":      getMACAddress(),
		}
		err = c.WriteJSON(handshake)
		if err != nil {
			log.Println("Handshake gönderilemedi, yeniden deneniyor...", err)
			c.Close()
			time.Sleep(2 * time.Second)
			continue
		}

		done := make(chan struct{})

		// Sunucudan gelen komutları ve dosya aktarımlarını dinle
		go func() {
			defer func() {
				c.Close()
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
							setScreenQuality(30)
							log.Println("Ekran kalitesi Düşük (30) olarak ayarlandı.")
						case "quality_medium":
							setScreenQuality(60)
							log.Println("Ekran kalitesi Orta (60) olarak ayarlandı.")
						case "quality_high":
							setScreenQuality(90)
							log.Println("Ekran kalitesi Yüksek (90) olarak ayarlandı.")
						}
					} else {
						runSystemCommand(action)
					}
				} else {
					screenShareMutex.Lock()
					writer := screenShareWriter
					screenShareMutex.Unlock()

					if writer != nil {
						pngB64, err := convertJpegBase64ToPngBase64(string(message))
						if err == nil {
							_, _ = writer.Write([]byte(pngB64 + "\n"))
						}
					} else {
						if len(message) < 500 {
							log.Printf("Bilinmeyen mesaj formatı: %s\n", message)
						}
					}
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
					err := c.WriteJSON(screenMsg)
					if err != nil {
						log.Println("Ekran verisi gönderilemedi:", err)
						return
					}
				}
			}
		}()

		// Bekleme döngüsü: bağlantı kopana kadar veya interrupt gelene kadar bekle
		select {
		case <-done:
			log.Println("Bağlantı kesildi, 5 saniye içinde yeniden bağlanılacak...")
			time.Sleep(5 * time.Second)
		case <-interrupt:
			log.Println("İstemci kapatılıyor...")
			_ = c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
			c.Close()
			return
		}
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
