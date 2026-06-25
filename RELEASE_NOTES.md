# PolyOS Lab v1.3.5 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.5**

Bu sürüm, yerel Python Tkinter ekran yansıtıcısının (Screen Share) istemci ekranlarında tam olarak oturmaması ve ortada küçük kalması/sınır çizgisi oluşturması sorununu giderir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🖥️ Gerçek Tam Ekran Paylaşımı (True Full-Screen Sharing)
* **Kök Neden:** Tkinter `Label` nesnesi varsayılan kenarlık (border) ve highlight genişliklerine sahipti. Ayrıca `pack` parametreleri tam ekran koordinatlarına genişlerken ekran kartı sürücülerine göre dış kenarlardan piksel boşluğu bırakabiliyordu.
* **Çözüm:** `polyos_share_viewer.py` içerisindeki görsel yansıtma `Label` bileşeni sıfır kenarlık (`bd=0`, `highlightthickness=0`) ile sıfırlandı. Resim çözünürlükleri pencere çözünürlüğüne göre dinamik olarak en-boy oranı bozulmadan hesaplanıp, pencerenin tamamını kaplayacak şekilde (`expand=True, fill='both'`) genişletildi.

---

## 📦 Kurulum ve Çalıştırma

1. **Sunucu:**
   ```bash
   cd server
   go run main.go
   ```
2. **Dashboard (Arayüz):**
   ```bash
   cd dashboard
   npm install
   npm run electron:dev
   ```
3. **İstemci (Pardus / Linux Cihazlar):**
   ```bash
   cd client
   sudo go run main.go
   ```
