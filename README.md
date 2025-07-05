## 🇻🇳 **Pharos Auto Bot – Tiếng Việt**

**Pharos Auto Bot** là một framework tự động hóa mạnh mẽ, có cấu trúc mô-đun được xây dựng bằng **Node.js** để tương tác với [Pharos Testnet](https://pharos.network). Nó xử lý các tác vụ hàng ngày như điểm danh, nhận faucet, xác minh mạng xã hội và các hoạt động on-chain một cách dễ dàng và chính xác.

Phù hợp cho tester, người farm điểm, và nhà phát triển muốn tự động hóa công việc lặp đi lặp lại một cách an toàn và hiệu quả.

---

## Tính Năng

* **Hỗ Trợ Nhiều Tài Khoản**
  Xử lý không giới hạn tài khoản song song qua `wallet.json`

* **Tích Hợp Proxy**
  Hỗ trợ proxy tùy chọn qua `proxy.txt` để xoay IP và bảo mật.

* **Kiến Trúc Mô-đun**
  Dễ mở rộng, phân tách rõ ràng giữa các service và utility.

### Tự Động Hóa Nhiệm Vụ

1. **Quản lý tài khoản**:

   * Đăng nhập.
   * Điểm danh hàng ngày.
   * Kiểm tra trạng thái tài khoản.

2. **Nhận Faucet**:

   * Nhận token PHRS từ faucet.
   * Nhận USDC từ faucet.

3. **Hoán đổi token**:

   * Đổi PHRS sang USDC.
   * Đổi PHRS sang USDT.

4. **Cung cấp thanh khoản**:

   * Thêm thanh khoản cặp PHRS-USDC.
   * Thêm thanh khoản cặp PHRS-USDT.

5. **Chuyển ngẫu nhiên**:

   * Thực hiện chuyển token ngẫu nhiên.

6. **Tác vụ mạng xã hội**:

   * Làm các nhiệm vụ liên quan MXH (chưa rõ chi tiết).

7. **Mint NFT**:

   * Mint Gotchipus NFT.

8. **Tác vụ OpenFi**:

   * Các nhiệm vụ liên quan OpenFi (chưa rõ chi tiết).

9. **Triển khai Pharos**:

   * Triển khai trên Pharos (chưa rõ chi tiết).

10. **Auto All**:

    * Chạy tất cả nhiệm vụ cùng lúc theo batch.

11. **Cấu hình số lượng giao dịch**:

    * Cài đặt số lượng tx muốn thực hiện (mặc định: 5).

12. **Thoát**:

    * Kết thúc bot.

* **Chạy Đa Luồng**
  Xử lý nhiệm vụ hiệu quả bằng async JavaScript.

* **Cấu hình dễ dàng**
  Tùy chỉnh tác vụ, delay, threads, API key qua `config.js`.

* **Tương thích đa nền tảng**
  Hỗ trợ Windows, macOS, Linux (dùng được với Termux).

---

## Cấu Trúc Thư Mục

```bash
Pharos-Auto-Bot/
pharos_bot/
├── index5.js          # Script chính với menu tương tác
├── service.js         # Logic nhiệm vụ chính (có cả faucet không giới hạn)
├── chains             # Cấu hình testnet Pharos
├── wallet.json        # Lưu nhiều ví
├── wallet.txt         # Ví chính cho transfer
├── address.txt        # Private key được tạo
├── package.json       # Cấu hình Node.js
├── node_modules/      # Dependency đã cài
└── README.md          # Tài liệu dự án
```

---

## ⚙️ Yêu Cầu

* Node.js v16+
* Git đã cài
* Tài khoản Pharos Testnet hợp lệ → [pharos.network](https://pharos.network/)
* Tùy chọn: Danh sách proxy
* Biết dùng terminal một chút sẽ tốt hơn

---

## 🧠 Cài đặt & Khởi chạy

```bash
# 1. Clone repo
git clone https://github.com/airdroptestnet275/Pharos-Bot.git
cd Pharos-Bot
```

```bash
# 2. Cài dependency
npm install
```

```bash
# 3. Cấu hình ví
nano wallet.json
```

```bash
# 4. Dán địa chỉ ví chính vào wallet.txt
nano wallet.txt
```

```bash
# 5. Chạy bot
node main.js
```

---

