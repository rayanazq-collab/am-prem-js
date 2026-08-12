# AM PREM JS

Bot WhatsApp khusus Alight Motion berbasis **Node.js + Baileys**.

Author: **x-znn**  
GitHub: https://github.com/x-znn

## Fitur

- `.amprem bulk <jumlah>`
- `.amprem send <email>`
- `.amprem verify <email>`
- `.amprem verify <email> <link>`
- `.ampremcreate`
- `.tempmail`
- `.tempmail read [email]`
- `.mode public`
- `.mode self`
- Pairing Code / QR
- Bulk `1-10` sebagai teks
- Bulk `>10` sebagai ZIP berisi TXT
- Validasi input sebelum request API
- Token AM melalui `.env`

Tidak ada command `amprem inbox`. Inbox ditangani oleh Temp Mail.

## Install Pterodactyl

Gunakan egg **Node.js 20+**.

```bash
cd /home/container
git clone https://github.com/x-znn/am-prem-js.git .
cp .env.example .env
npm install
```

Edit `.env`:

```env
BOT_NAME=AM PREM JS
BOT_PREFIX=.
BOT_MODE=public

OWNER=6281234567890
PAIRING_PHONE=6281234567890

API_BASE=https://api.znn.my.id
AM_TOKEN=TOKEN_AM_KAMU
AM_API_VERSION=v1

MAX_BULK=100
BULK_ZIP_THRESHOLD=10
```

Lalu:

```bash
bash check.sh
npm start
```

Startup command Pterodactyl:

```bash
cd /home/container && npm start
```

## Pairing

Pairing Code:

```env
PAIRING_PHONE=6281234567890
```

QR:

```env
PAIRING_PHONE=
```

Session disimpan di folder `session/`.

## Command

```text
.menu
.help

.amprem bulk 5
.amprem send email@gmail.com
.amprem verify email@gmail.com
.amprem verify email@gmail.com https://alight-creative...

.ampremcreate

.tempmail
.tempmail read
.tempmail read email@domain.com

.mode public
.mode self
```

### Validasi input

Contoh:

```text
.amprem send
```

Bot membalas petunjuk dan **tidak request API**.

```text
.amprem bulk
```

Bot meminta jumlah dan **tidak request API**.

```text
.amprem verify
```

Bot meminta email dan **tidak request API**.

## AM Prem Create

`.ampremcreate`:

1. Mengambil 1 email dari bulk.
2. Mengirim email login ke user.
3. Memantau Temp Mail selama 5 menit.
4. Hanya membaca email baru setelah sesi dimulai.
5. Saat link Alight terbaru ditemukan, bot mengirim **link saja**.

## Token

Token disimpan pada:

```env
AM_TOKEN=am_feed0086497e9cbcf35bf288c35775c2a1263d5f3be91af48865e6d2f3d3683f
```

Jangan commit file `.env`.
