# Scanin Lah 📄

**Asisten Dokumen Pintar** — Aplikasi scanner dokumen berbasis AI untuk Android.

> Dikembangkan oleh **Ihya' Nashirudin Abrar**  
> 📧 ihyakpati1144@gmail.com

---

## Fitur

- 📷 **Scan Dokumen** — Kamera live dengan AI edge detection (OpenCV.js + jscanify), crop perspektif otomatis/manual
- 📚 **Multi-Scan** — Scan banyak halaman, atur urutan, gabung jadi 1 PDF
- ✏️ **Edit** — OCR (Tesseract.js), markup, sensor/redaksi, pisah, gabung, cari & ganti
- 🔄 **Konversi** — PDF, DOCX, TXT, JPG, PNG
- 🤖 **Tanya AI** — Analisa isi dokumen, ringkasan, cari kata, bandingkan dokumen
- 📁 **Manajemen Dokumen** — Grid view, viewer fullscreen, download, share, rename, hapus

## Teknologi

| Library | Fungsi |
|---|---|
| React 19 + TypeScript | UI Framework |
| Tailwind CSS v4 | Styling |
| Vite 7 | Build tool |
| OpenCV.js + jscanify | Edge detection & perspective correction |
| Tesseract.js | OCR Engine (Indonesia + English) |
| jsPDF | PDF generation |
| Capacitor | Native Android wrapper |

## Cara Build APK

### Prasyarat
- Node.js 18+
- Android Studio (dengan Android SDK)
- Java JDK 17+

### Langkah

```bash
# 1. Install dependencies
npm install

# 2. Build web
npm run build

# 3. Tambah platform Android (sekali saja)
npx cap add android

# 4. Sync ke Android
npx cap sync android

# 5. Buka di Android Studio
npx cap open android
```

Di Android Studio:
1. Tunggu Gradle sync selesai
2. **Build → Generate Signed Bundle/APK**
3. Pilih **APK** → buat keystore → Build Release
4. APK ada di `android/app/release/app-release.apk`

## Development

```bash
npm run dev        # Jalankan dev server
npm run build      # Build production
npm run cap:sync   # Build + sync Capacitor
```

## Lisensi

MIT License © 2025 Ihya' Nashirudin Abrar
