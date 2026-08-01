import { useStore } from '../store'

/**
 * Translation, keyed on the English source text.
 *
 * There is no key registry — `t('Send feedback')` *is* the English string, and
 * the dictionary below maps it to Indonesian. Retrofitting a naming scheme
 * onto three hundred existing strings would have meant inventing and then
 * remembering three hundred names, and every typo would surface to the user as
 * a raw `views.data.title`. Here a missing or misspelt entry falls through to
 * readable English, so the app is never worse than untranslated.
 */

export type Language = 'en' | 'id'

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'id', label: 'Bahasa Indonesia' },
]

/**
 * Indonesian.
 *
 * Warehouse vocabulary follows what Indonesian logistics actually says rather
 * than the dictionary form: "gudang" for warehouse, "stok" for stock, "SKU"
 * and "barcode" left as-is because they are what appears on the paperwork.
 */
const ID: Record<string, string> = {
  // --- navigation & chrome ---
  'Dashboard': 'Dasbor',
  'Rooms & Layout': 'Ruangan & Tata Letak',
  'Inventory': 'Inventaris',
  'Movements': 'Pergerakan',
  'Reports': 'Laporan',
  'Data & Settings': 'Data & Pengaturan',
  'Data & settings': 'Data & pengaturan',
  'Send feedback': 'Kirim masukan',
  'Search  (Ctrl K)': 'Cari  (Ctrl K)',
  'Dark theme': 'Tema gelap',
  'Light theme': 'Tema terang',
  'StoreSpace': 'StoreSpace',

  // --- generic actions ---
  'Cancel': 'Batal',
  'Close': 'Tutup',
  'Delete': 'Hapus',
  'Edit': 'Ubah',
  'Duplicate': 'Gandakan',
  'Print': 'Cetak',
  // "Share" only ever appears as the ABC table's share-of-value column, so it
  // takes the proportion sense — never the "share this with someone" verb.
  'Share': 'Porsi',
  'Top 80% of value — tight control': '80% teratas dari nilai — kendali ketat',
  'Next 15% — routine control': '15% berikutnya — kendali rutin',
  'Last 5% — minimal control': '5% terakhir — kendali minimal',
  'Top 80% of inventory value': '80% teratas dari nilai inventaris',
  'Next 15% of value': '15% berikutnya dari nilai',
  'Last 5% of value': '5% terakhir dari nilai',
  'SKU / Barcode': 'SKU / Barcode',
  'Expiry': 'Kedaluwarsa',
  'Clear': 'Bersihkan',
  'Load': 'Muat',
  'Manage': 'Kelola',
  'Next': 'Lanjut',
  'Previous': 'Sebelumnya',
  'Post': 'Catat',
  'All': 'Semua',
  'List': 'Daftar',
  'Total': 'Total',
  'Transfer': 'Pindahkan',
  'Locate': 'Temukan',
  'Preview': 'Pratinjau',
  'Nothing selected': 'Belum ada yang dipilih',
  'Nothing to choose from': 'Tidak ada pilihan',

  // --- dashboard ---
  'Inventory value': 'Nilai inventaris',
  'Recent activity': 'Aktivitas terbaru',
  'Room utilisation': 'Pemakaian ruangan',
  'Top categories by value': 'Kategori teratas menurut nilai',
  'Open alerts': 'Peringatan terbuka',
  'Open layout': 'Buka tata letak',
  'Low stock': 'Stok menipis',
  'Expiring / expired': 'Akan / sudah kedaluwarsa',
  'Stock lines': 'Baris stok',
  'Storage objects': 'Objek penyimpanan',
  'Occupancy': 'Keterisian',
  'Create rooms, add storage objects and record stock — reports build automatically.':
    'Buat ruangan, tambahkan objek penyimpanan, lalu catat stok — laporan tersusun otomatis.',
  'Nothing to report yet': 'Belum ada yang dilaporkan',

  // --- rooms & layout ---
  'Rooms': 'Ruangan',
  'Room': 'Ruangan',
  'Room name': 'Nama ruangan',
  'New room': 'Ruangan baru',
  'Create first room': 'Buat ruangan pertama',
  'No rooms yet': 'Belum ada ruangan',
  'No rooms at this site yet.': 'Belum ada ruangan di lokasi ini.',
  'Add a room to this site': 'Tambah ruangan ke lokasi ini',
  'Add room here': 'Tambah ruangan di sini',
  'Delete room?': 'Hapus ruangan?',
  'All objects inside this room and their inventory lines are deleted as well.':
    'Semua objek di dalam ruangan ini beserta baris inventarisnya ikut terhapus.',
  "Edit this room's size and colours": 'Ubah ukuran dan warna ruangan ini',
  'Sites & rooms': 'Lokasi & ruangan',
  'Site': 'Lokasi',
  'Site / location': 'Situs / lokasi',
  'Site deleted': 'Lokasi dihapus',
  'Zone': 'Zona',
  'Floor': 'Lantai',
  'Floor area': 'Luas lantai',
  'Floor colour': 'Warna lantai',
  'Wall colour': 'Warna dinding',
  'Walls': 'Dinding',
  'Floor grid': 'Grid lantai',
  'Grid': 'Grid',
  'Snap grid': 'Grid rekat',
  'Snap to grid': 'Rekat ke grid',
  'Objects snap to this spacing': 'Objek merekat pada jarak ini',
  "Objects align to the room's grid spacing while dragging":
    'Objek menyejajarkan diri ke grid ruangan saat digeser',
  'Collision detection': 'Deteksi tabrakan',
  'Blocks objects from overlapping each other': 'Mencegah objek saling bertumpang tindih',
  'Show grid': 'Tampilkan grid',
  'Show walls': 'Tampilkan dinding',
  'Show object labels': 'Tampilkan label objek',
  'Object labels': 'Label objek',
  'Show fill badges': 'Tampilkan lencana isi',
  'Fill badges': 'Lencana isi',
  'Fill': 'Isi',
  'Only containers holding stock get a badge': 'Hanya wadah berisi stok yang diberi lencana',
  'Zoom in': 'Perbesar',
  'Zoom out': 'Perkecil',
  'Fit room to view': 'Paskan ruangan ke layar',
  'Centre in room': 'Pusatkan di ruangan',
  'Auto-arrange: pack objects into tidy rows': 'Tata otomatis: rapikan objek menjadi baris',
  'Add furniture': 'Tambah perabot',
  'Add an object': 'Tambah objek',
  'Objects in room': 'Objek di ruangan',
  'Objects': 'Objek',
  'Object': 'Objek',
  'Furniture': 'Perabot',
  'Start from a preset': 'Mulai dari preset',
  'Click an object to drop it into the room — it lands in the nearest free spot.':
    'Klik objek untuk menaruhnya di ruangan — objek mendarat di tempat kosong terdekat.',
  'Click an object in the room to edit its size, position and contents.':
    'Klik objek di ruangan untuk mengubah ukuran, posisi, dan isinya.',
  'Search objects…': 'Cari objek…',
  'Filter objects…': 'Saring objek…',
  'No free floor space left in this room': 'Tidak ada sisa ruang lantai di ruangan ini',
  'No space for a copy': 'Tidak ada ruang untuk salinan',
  'Not enough space to rotate here': 'Ruang tidak cukup untuk memutar di sini',
  'Overlapping another object or outside the room.': 'Bertumpang tindih dengan objek lain atau di luar ruangan.',
  'Loading 3D engine…': 'Memuat mesin 3D…',

  // --- object properties ---
  'Properties': 'Properti',
  'Close properties': 'Tutup properti',
  'Type': 'Tipe',
  'Code': 'Kode',
  'Colour': 'Warna',
  'Width': 'Lebar',
  'Length': 'Panjang',
  'Height': 'Tinggi',
  'Dimensions': 'Dimensi',
  'Size (cm)': 'Ukuran (cm)',
  'Position': 'Posisi',
  'Shift X': 'Geser X',
  'Shift Z': 'Geser Z',
  'Over floor': 'Di atas lantai',
  'Rotate Y': 'Putar Y',
  'Rotate 90° (R)': 'Putar 90° (R)',
  'Levels': 'Tingkat',
  'Slot capacity': 'Kapasitas slot',
  'Slot occupancy': 'Keterisian slot',
  'Slots': 'Slot',
  'Slots used': 'Slot terpakai',
  'Max weight': 'Berat maksimum',
  'Capacity': 'Kapasitas',
  'Capacity & load': 'Kapasitas & beban',
  'Footprint': 'Tapak',
  'Volume': 'Volume',
  'Weight': 'Berat',
  'Temp': 'Suhu',
  'Target temp': 'Suhu target',
  'Lock position': 'Kunci posisi',
  'Prevents dragging and auto-arrange': 'Mencegah penggeseran dan penataan otomatis',
  'Duplicate (Ctrl+D)': 'Gandakan (Ctrl+D)',
  'Transfer stock': 'Pindahkan stok',
  'Destination': 'Tujuan',
  'Destination container': 'Wadah tujuan',
  'Current stock:': 'Stok saat ini:',
  'No stock recorded.': 'Belum ada stok tercatat.',

  // --- inventory & items ---
  'Item': 'Barang',
  'Item name': 'Nama barang',
  'New item': 'Barang baru',
  'Add item': 'Tambah barang',
  'Delete line': 'Hapus baris',
  'Delete this stock line?': 'Hapus baris stok ini?',
  'SKU': 'SKU',
  'SKU / Part no.': 'SKU / No. part',
  'Barcode': 'Barcode',
  'Generate new barcode': 'Buat barcode baru',
  'Category': 'Kategori',
  'Categories': 'Kategori',
  'Status': 'Status',
  'Stock status': 'Status stok',
  'Qty': 'Jml',
  'Quantity': 'Jumlah',
  'Unit of measure': 'Satuan ukur',
  'Unit cost': 'Harga satuan',
  'Unit weight': 'Berat satuan',
  'Reorder point': 'Titik pemesanan ulang',
  'Low-stock alert threshold': 'Ambang peringatan stok menipis',
  'How much container capacity this line consumes': 'Berapa kapasitas wadah yang dipakai baris ini',
  'Lot': 'Lot',
  'Lot / Batch': 'Lot / Batch',
  'Serial no.': 'No. seri',
  'Supplier': 'Pemasok',
  'Received date': 'Tanggal terima',
  'Expiry date': 'Tanggal kedaluwarsa',
  'Expiry warning': 'Peringatan kedaluwarsa',
  'Exp': 'Kedaluwarsa',
  'Location': 'Lokasi',
  'Sub-location / bin': 'Sub-lokasi / bin',
  'Notes': 'Catatan',
  'Note': 'Catatan',
  'Tags (comma separated)': 'Tag (dipisah koma)',
  'Value': 'Nilai',
  'Share of value': 'Porsi nilai',
  'Lines': 'Baris',
  'Print labels': 'Cetak label',
  'Columns': 'Kolom',
  'Columns per row': 'Kolom per baris',
  'Show in layout': 'Tampilkan di tata letak',
  'Select container…': 'Pilih wadah…',
  'Select stock line…': 'Pilih baris stok…',
  'Search or scan barcode…': 'Cari atau pindai barcode…',
  'Filter items…': 'Saring barang…',
  'Filter by category': 'Saring menurut kategori',
  'Filter by container': 'Saring menurut wadah',
  'Filter by room': 'Saring menurut ruangan',
  'Filter by status': 'Saring menurut status',
  'e.g. Bearing 6204-2RS': 'mis. Bearing 6204-2RS',
  'fast-mover, fragile': 'cepat-laku, mudah-pecah',

  // --- movements ---
  'Movements & audit trail': 'Pergerakan & jejak audit',
  'Post movement': 'Catat pergerakan',
  'Movement posted': 'Pergerakan tercatat',
  'Movement type': 'Jenis pergerakan',
  'All movements': 'Semua pergerakan',
  'Record a receipt, pick, transfer, adjustment or count':
    'Catat penerimaan, pengambilan, pemindahan, penyesuaian, atau perhitungan',
  'Reference': 'Referensi',
  'Timestamp': 'Waktu',
  'When': 'Kapan',
  'User': 'Pengguna',
  'Filter by date range': 'Saring menurut rentang tanggal',
  'Filter by movement type': 'Saring menurut jenis pergerakan',
  'Search reference, SKU, user…': 'Cari referensi, SKU, pengguna…',
  'No movements in this window': 'Tidak ada pergerakan pada rentang ini',
  'No movements recorded yet.': 'Belum ada pergerakan tercatat.',
  'Change the date range or post a movement manually.':
    'Ubah rentang tanggal atau catat pergerakan secara manual.',
  'Clear history': 'Bersihkan riwayat',
  'Clear movement history?': 'Bersihkan riwayat pergerakan?',
  'This deletes the audit trail. Stock levels and objects are not affected.':
    'Ini menghapus jejak audit. Level stok dan objek tidak terpengaruh.',
  'Enter a quantity above zero': 'Masukkan jumlah di atas nol',
  'An adjustment of zero changes nothing': 'Penyesuaian nol tidak mengubah apa pun',
  'That destination no longer exists': 'Tujuan itu sudah tidak ada',

  // --- reports ---
  'Age bucket': 'Kelompok umur',
  'Class': 'Kelas',
  'Cumulative': 'Kumulatif',
  'What the class means.': 'Arti kelas tersebut.',
  'Export CSV': 'Ekspor CSV',

  // --- data & settings ---
  'Preferences, backups and bulk import/export': 'Preferensi, cadangan, dan impor/ekspor massal',
  'Display & behaviour': 'Tampilan & perilaku',
  'Measurement units': 'Satuan pengukuran',
  'Units': 'Satuan',
  'Sizes are stored in cm and converted for display':
    'Ukuran disimpan dalam cm dan dikonversi saat ditampilkan',
  'Theme': 'Tema',
  'Language': 'Bahasa',
  'Operator name': 'Nama operator',
  'Stamped on every movement': 'Dicap pada setiap pergerakan',
  'Currency': 'Mata uang',
  'Used for stock value across the dashboard and reports':
    'Dipakai untuk nilai stok di dasbor dan laporan',
  'Wall clearance': 'Jarak dari dinding',
  'Keeps objects away from room edges': 'Menjaga objek menjauh dari tepi ruangan',
  'Reset settings to defaults': 'Kembalikan pengaturan ke bawaan',
  'Storage': 'Penyimpanan',
  'Backup & restore': 'Cadangkan & pulihkan',
  'Export JSON backup': 'Ekspor cadangan JSON',
  'Export a backup': 'Ekspor cadangan',
  'Backup downloaded': 'Cadangan terunduh',
  'Import JSON': 'Impor JSON',
  'Import mode': 'Mode impor',
  'Bulk item import (CSV)': 'Impor barang massal (CSV)',
  'Import items CSV': 'Impor CSV barang',
  'Download template': 'Unduh templat',
  'Demo & reset': 'Demo & atur ulang',
  'Load sample warehouse': 'Muat gudang contoh',
  'Sample data loaded': 'Data contoh dimuat',
  'Loading the sample replaces the current rooms, objects, items and history.':
    'Memuat contoh akan mengganti ruangan, objek, barang, dan riwayat saat ini.',
  'Delete all data': 'Hapus semua data',
  'Delete all data?': 'Hapus semua data?',
  'Delete everything': 'Hapus semuanya',
  'All data cleared': 'Semua data dibersihkan',
  'Every room, object, stock line and movement is removed from this browser. Export a backup first if you need one.':
    'Setiap ruangan, objek, baris stok, dan pergerakan dihapus dari peramban ini. Ekspor cadangan dulu bila perlu.',
  'Nothing importable found in that file': 'Tidak ada yang bisa diimpor dari berkas itu',
  'Replay guided tour': 'Putar ulang tur panduan',
  'Guided tour': 'Tur panduan',
  'Welcome to StoreSpace': 'Selamat datang di StoreSpace',
  'Unique within the site': 'Unik dalam satu lokasi',

  // --- feedback ---
  'Goes straight to the maintainers': 'Langsung ke pengelola',
  'What is this about?': 'Ini tentang apa?',
  'Details': 'Rincian',
  'Email (optional)': 'Email (opsional)',
  'Only needed if you want a reply. Your data stays in your browser either way.':
    'Hanya perlu bila Anda ingin dibalas. Data Anda tetap di peramban Anda.',
  'What happened, or what would you like to see? Steps that reproduce a bug are gold.':
    'Apa yang terjadi, atau apa yang Anda inginkan? Langkah untuk memunculkan bug sangat membantu.',
  'Thanks — your feedback was sent': 'Terima kasih — masukan Anda terkirim',

  // --- errors ---
  'StoreSpace hit an error': 'StoreSpace mengalami galat',
  'Download a copy of the data': 'Unduh salinan data',
  'Clear data and restart': 'Bersihkan data dan mulai ulang',
  'Just reload': 'Muat ulang saja',

  // --- object types (CONTAINER_TYPES) ---
  'Shelf': 'Rak Terbuka',
  'Pallet Rack': 'Rak Palet',
  'Storage Unit': 'Unit Penyimpanan',
  'Cupboard': 'Lemari',
  'Cabinet': 'Kabinet',
  'Roll Cage': 'Troli Kandang',
  'Pallet': 'Palet',
  'Stack': 'Tumpukan',
  'Box': 'Kardus',
  'Crate': 'Peti',
  'Bin': 'Tong',
  'Drum': 'Drum',
  'Tank': 'Tangki',
  'Fridge': 'Kulkas',
  'Freezer': 'Freezer',
  'Table': 'Meja',
  'Workbench': 'Meja Kerja',
  'Pillar': 'Tiang',
  'Door / Access': 'Pintu / Akses',
  'Unknown type': 'Tipe tidak dikenal',
  'Open shelving, multiple levels': 'Rak terbuka, beberapa tingkat',
  'Heavy duty racking bay': 'Bay rak tugas berat',
  'Modular multi-compartment unit': 'Unit modular multi-kompartemen',
  'Closed doors, dry goods': 'Pintu tertutup, barang kering',
  'Drawer cabinet / tool store': 'Kabinet laci / simpan perkakas',
  'Mobile roll cage / trolley': 'Troli kandang beroda',
  'Euro/standard pallet base': 'Alas palet euro/standar',
  'Stacked goods on the floor': 'Barang bertumpuk di lantai',
  'Single carton or tote': 'Satu karton atau tote',
  'Reusable plastic/wood crate': 'Peti plastik/kayu pakai ulang',
  'Round bin / hopper': 'Tong bundar / hopper',
  '200 L steel drum': 'Drum baja 200 L',
  'Bulk liquid tank (IBC/vessel)': 'Tangki cairan curah (IBC/bejana)',
  'Chilled storage 0–8 °C': 'Penyimpanan dingin 0–8 °C',
  'Frozen storage below −15 °C': 'Penyimpanan beku di bawah −15 °C',
  'Staging / sorting table': 'Meja persiapan / sortir',
  'Packing or repair bench': 'Meja kemas atau perbaikan',
  'Structural column (obstacle)': 'Kolom struktur (penghalang)',
  'Doorway, keep clear (obstacle)': 'Ambang pintu, jangan dihalangi (penghalang)',
  'This object came from a newer or hand-edited file and is not recognised.':
    'Objek ini berasal dari berkas yang lebih baru atau disunting manual dan tidak dikenali.',

  // --- object categories ---
  'Shelving & storage': 'Rak & penyimpanan',
  'Containers & bulk': 'Wadah & curah',
  'Cold storage': 'Penyimpanan dingin',
  'Work surfaces': 'Permukaan kerja',
  'Structure': 'Struktur',

  // --- item statuses ---
  'In stock': 'Tersedia',
  'Reserved': 'Dipesan',
  'Quarantine': 'Karantina',
  'Damaged': 'Rusak',
  'Expired': 'Kedaluwarsa',

  // --- movement types ---
  'Receive (GRN)': 'Penerimaan (GRN)',
  'Issue / Pick': 'Pengeluaran / Ambil',
  'Adjustment': 'Penyesuaian',
  'Relocate object': 'Pindahkan objek',
  'Cycle count': 'Hitung siklus',
  'Dispose / Scrap': 'Buang / Afkir',

  // --- site kinds ---
  'Warehouse': 'Gudang',
  'Distribution centre': 'Pusat distribusi',
  'Retail store': 'Toko ritel',
  'Factory': 'Pabrik',
  'Yard / outdoor': 'Halaman / luar ruang',
  'Office': 'Kantor',

  // --- item categories ---
  'General': 'Umum',
  'Hardware': 'Perangkat keras',
  'Consumables': 'Barang habis pakai',
  'Packaging': 'Kemasan',
  'Spare Parts': 'Suku cadang',
  'Electrical': 'Kelistrikan',
  'Chemicals': 'Bahan kimia',
  'Fluids': 'Cairan',
  'Food': 'Makanan',
  'Pharma': 'Farmasi',
  'PPE': 'APD',
  'Logistics': 'Logistik',
  'Raw Material': 'Bahan baku',
  'Finished Goods': 'Barang jadi',

  // --- feedback kinds ---
  'Something is broken': 'Ada yang rusak',
  'Idea or request': 'Ide atau permintaan',
  'Question': 'Pertanyaan',
  'Something else': 'Hal lain',

  // --- units ---
  'Centimetres (cm)': 'Sentimeter (cm)',
  'Metres (m)': 'Meter (m)',
  'Inches (in)': 'Inci (in)',
  'Dark': 'Gelap',
  'Light': 'Terang',
  'Replace everything': 'Ganti semuanya',
  'Merge into current': 'Gabung ke yang sekarang',
  'Sending…': 'Mengirim…',
  'Save changes': 'Simpan perubahan',
  'New inventory line': 'Baris inventaris baru',
  'Add stock to a container': 'Tambah stok ke sebuah wadah',
  'Skip': 'Lewati',
  'No thanks': 'Tidak, terima kasih',
  'days': 'hari',

  // --- guided tour ---
  'Rooms & layout': 'Ruangan & tata letak',
  'Search anything': 'Cari apa saja',
  'Light or dark': 'Terang atau gelap',
  'One last thing': 'Satu hal terakhir',
  'A storage planner and stock ledger in one: model your rooms to real dimensions, place the furniture inside them, then track every item that goes in or out. Here is the whole app in a minute.':
    'Perencana penyimpanan dan buku besar stok dalam satu aplikasi: modelkan ruangan sesuai ukuran asli, tempatkan perabot di dalamnya, lalu lacak setiap barang yang masuk dan keluar. Berikut seluruh aplikasinya dalam satu menit.',
  'The morning glance: room utilisation, stock status, value by category and the latest movements. Low stock and expiring lots are listed here — click any of them to jump straight to the shelf holding it.':
    'Pandangan sekilas pagi hari: pemakaian ruangan, status stok, nilai per kategori, dan pergerakan terbaru. Stok menipis dan lot yang akan kedaluwarsa terdaftar di sini — klik salah satunya untuk langsung menuju rak yang menyimpannya.',
  'The heart of it. Draw rooms to size, then drag shelves, racks, fridges and pallets around the floor in 3D or on the flat plan. Snapping and collision keep the plan buildable, auto-arrange packs everything into tidy rows, and the properties panel on the right edits whatever is selected.':
    'Inti aplikasinya. Gambar ruangan sesuai ukuran, lalu geser rak, rak palet, kulkas, dan palet di lantai secara 3D atau pada denah datar. Perekatan dan deteksi tabrakan menjaga denah tetap masuk akal, penataan otomatis merapikan semuanya menjadi baris, dan panel properti di kanan mengubah apa pun yang sedang dipilih.',
  'Every stock line in one table — SKU, barcode, lot, quantity, cost, expiry. Filter and sort it, edit in place, move stock between containers, or print barcode labels. The locate button pins any line on the floor plan.':
    'Semua baris stok dalam satu tabel — SKU, barcode, lot, jumlah, harga, kedaluwarsa. Saring dan urutkan, ubah di tempat, pindahkan stok antar wadah, atau cetak label barcode. Tombol temukan menandai baris mana pun pada denah lantai.',
  'The audit trail. Receipts, picks, transfers, adjustments, counts and relocations are all recorded with a timestamp and the operator name. Post one by hand when stock moves outside the app.':
    'Jejak audit. Penerimaan, pengambilan, pemindahan, penyesuaian, perhitungan, dan relokasi semuanya tercatat lengkap dengan waktu dan nama operator. Catat manual bila stok berpindah di luar aplikasi.',
  'Five ready-made views over the same data: ABC analysis, capacity and space, stock aging, valuation and zone density. Each one exports to CSV or prints.':
    'Lima tampilan siap pakai atas data yang sama: analisis ABC, kapasitas dan ruang, umur stok, penilaian, dan kepadatan zona. Masing-masing bisa diekspor ke CSV atau dicetak.',
  'Units, theme, operator name, snapping and clearance live here — along with JSON backups, bulk item import from CSV, and the sample warehouse. Everything is stored in this browser, so a backup is the only copy that leaves it.':
    'Satuan, tema, nama operator, perekatan, dan jarak dinding ada di sini — bersama cadangan JSON, impor barang massal dari CSV, dan gudang contoh. Semuanya disimpan di peramban ini, jadi cadangan adalah satu-satunya salinan yang keluar.',
  'Ctrl K from any screen finds rooms, objects, SKUs and barcodes, then flies you to the match and flashes it in the layout. A barcode scanner typing into that box works too.':
    'Ctrl K dari layar mana pun mencari ruangan, objek, SKU, dan barcode, lalu membawa Anda ke hasilnya dan menyorotnya di tata letak. Pemindai barcode yang mengetik ke kotak itu juga bekerja.',
  'One click swaps the theme. It sticks with the rest of your settings.':
    'Satu klik menukar tema. Pilihan itu tersimpan bersama pengaturan Anda yang lain.',
  'That is the tour. This button sends a note straight to the maintainers — a bug, an idea, or something that made no sense just now. It would help a lot if you told us how this went.':
    'Sekian turnya. Tombol ini mengirim pesan langsung ke pengelola — bug, ide, atau sesuatu yang tadi membingungkan. Sangat membantu bila Anda memberi tahu bagaimana pengalamannya.',

  // --- storage warnings ---
  'This browser is out of storage — changes are no longer being saved and will be lost on reload.':
    'Penyimpanan peramban ini penuh — perubahan tidak lagi disimpan dan akan hilang saat dimuat ulang.',
  'Saved data could not be read. Saving is paused so the existing copy is not overwritten.':
    'Data tersimpan tidak dapat dibaca. Penyimpanan dijeda agar salinan yang ada tidak tertimpa.',
  'Any status': 'Semua status',
  'All types': 'Semua jenis',
  'Could not finish loading': 'Pemuatan tidak selesai',
  'Reload': 'Muat ulang',
  'Part of the app failed to download — usually a dropped connection or an update landing mid-session. Your data is untouched. Reloading should fix it.':
    'Sebagian aplikasi gagal diunduh — biasanya karena koneksi terputus atau pembaruan yang masuk di tengah sesi. Data Anda tidak tersentuh. Memuat ulang seharusnya memperbaikinya.',
  'Something in the stored data made the app stop rendering. Save a copy before clearing — the backup can be edited by hand and imported again.':
    'Ada sesuatu pada data tersimpan yang membuat aplikasi berhenti menampilkan. Simpan salinan sebelum membersihkan — cadangan itu bisa disunting manual lalu diimpor lagi.',

  // --- report tabs and blurbs ---
  'ABC analysis': 'Analisis ABC',
  'Capacity & space': 'Kapasitas & ruang',
  'Stock aging': 'Umur stok',
  'Valuation': 'Penilaian',
  'Zone density': 'Kepadatan zona',
  'Pareto classification: A = top 80% of stock value, B = next 15%, C = last 5%':
    'Klasifikasi Pareto: A = 80% teratas dari nilai stok, B = 15% berikutnya, C = 5% terakhir',
  'Floor and slot utilisation per room and object': 'Pemakaian lantai dan slot per ruangan dan objek',
  'How long stock has been sitting, by receipt date': 'Berapa lama stok mengendap, menurut tanggal terima',
  'Value and weight rolled up by category and status': 'Nilai dan berat dijumlahkan per kategori dan status',
  'Objects, slots and value grouped by zone': 'Objek, slot, dan nilai dikelompokkan per zona',
  '0–30 days': '0–30 hari',
  '31–90 days': '31–90 hari',
  '91–180 days': '91–180 hari',
  '181–365 days': '181–365 hari',
  'Over 1 year': 'Lebih dari 1 tahun',
  'No date': 'Tanpa tanggal',

  // --- filters ---
  'All rooms': 'Semua ruangan',
  'All containers': 'Semua wadah',
  'All categories': 'Semua kategori',
  'All time': 'Sepanjang waktu',
  'Expiring ≤{d}d': 'Kedaluwarsa ≤{d}h',
  'Last {d} days': '{d} hari terakhir',

  // --- layout hint strip ---
  'Drag': 'Geser',
  'move': 'pindah',
  'copy': 'salin',
  'Dbl-click': 'Klik ganda',
  'items': 'barang',

  // --- sentences with values in them (see `trf`) ---
  '{n} m² floor': 'lantai {n} m²',
  '{n} units': '{n} unit',
  '{a} / {b} slots': '{a} / {b} slot',
  '{n} kg total': 'total {n} kg',
  'low stock · expiry · capacity': 'stok menipis · kedaluwarsa · kapasitas',
  '{o} obj · {l} lines': '{o} objek · {l} baris',
  '{o} objects · {l} lines': '{o} objek · {l} baris',
  '{n} objects': '{n} objek',
  '{a} m² · {p}% used': '{a} m² · {p}% terpakai',
  'All lines above their reorder point.': 'Semua baris di atas titik pemesanan ulang.',
  '{n} lines': '{n} baris',
  "Roughly {n} KB held in this browser's local storage.":
    'Sekitar {n} KB tersimpan di penyimpanan lokal peramban ini.',
  'Match rows to objects with a': 'Cocokkan baris ke objek lewat kolom',
  'column holding the object code (e.g.': 'yang berisi kode objek (mis.',
  '). Unknown codes fall back to the first object.':
    '). Kode yang tidak dikenal jatuh ke objek pertama.',

  // --- item form ---
  'Edit {sku}': 'Ubah {sku}',
  'Line weight {n} kg': 'Berat baris {n} kg',
  'Line value {n} {cur}': 'Nilai baris {n} {cur}',
  'no barcode': 'tanpa barcode',

  // --- feedback form ---
  '{n} / {max} characters': '{n} / {max} karakter',
  'No feedback endpoint in this build. Deploy': 'Build ini tidak punya endpoint masukan. Terapkan',
  'and put its URL in': 'lalu masukkan URL-nya ke',
  ', then rebuild.': ', kemudian build ulang.',
  'Could not reach the feedback service.': 'Tidak dapat menghubungi layanan masukan.',
  'Could not reach the feedback service. Check your connection and try again.':
    'Tidak dapat menghubungi layanan masukan. Periksa koneksi Anda lalu coba lagi.',

  // --- room form ---
  'Edit {code}': 'Ubah {code}',
  'Save room': 'Simpan ruangan',
  'Create room': 'Buat ruangan',
  'Width (X)': 'Lebar (X)',
  'Length (Z)': 'Panjang (Z)',
  'Height (Y)': 'Tinggi (Y)',
  'Define the floor area that objects are placed in':
    'Tentukan luas lantai tempat objek ditempatkan',

  // --- room size presets ---
  'Small store 4×3 m': 'Toko kecil 4×3 m',
  'Stock room 8×6 m': 'Gudang stok 8×6 m',
  'Warehouse 24×16 m': 'Gudang 24×16 m',
  'Container 40 ft': 'Kontainer 40 kaki',
  'Cold store 9×7 m': 'Ruang dingin 9×7 m',
  '{shown} of {all} lines · {qty} units · {value} · {kg} kg':
    '{shown} dari {all} baris · {qty} unit · {value} · {kg} kg',
  '{money} · {pct}% of value': '{money} · {pct}% dari nilai',
  'expired {n} days ago': 'kedaluwarsa {n} hari lalu',
  '{n} days left': 'sisa {n} hari',
  'Live snapshot across {rooms} rooms and {objects} storage objects':
    'Cuplikan langsung dari {rooms} ruangan dan {objects} objek penyimpanan',
  '{n} hold stock': '{n} berisi stok',
  '{n} entries · every receipt, pick, transfer, count and relocation':
    '{n} entri · setiap penerimaan, pengambilan, pemindahan, perhitungan, dan relokasi',

  // --- search ---
  'Search rooms, objects, SKUs, barcodes…': 'Cari ruangan, objek, SKU, barcode…',
  'Type to search. Scan a barcode into this box to jump straight to the stock line.':
    'Ketik untuk mencari. Pindai barcode ke kotak ini untuk langsung ke baris stok.',
}

const TABLE: Record<Language, Record<string, string>> = { en: {}, id: ID }

/** Translate against an explicit language. */
export function translate(key: string, lang: Language): string {
  return TABLE[lang]?.[key] ?? key
}

/**
 * The translate function, callable from anywhere — components, store actions,
 * plain helpers — with no hook and no prop threading.
 *
 * It reads the store snapshot rather than subscribing, which would normally
 * mean a component could render stale text after the language changed. `App`
 * closes that hole by keying its subtree on the language, so switching remounts
 * everything below it and every `t()` re-runs against the new value. The
 * trade-off is that a switch also clears transient UI state — open dialogs,
 * half-typed filters — which is the right outcome anyway: a form captioned in
 * two languages at once would be worse.
 */
export function t(key: string): string {
  return translate(key, useStore.getState().settings.language)
}

/**
 * Translate a sentence with values in it: `trf('{n} rooms', { n: 4 })`.
 *
 * Placeholders rather than string concatenation, because the pieces of an
 * English sentence do not come back in the same order in every language and
 * stitching translated fragments together produces nonsense.
 */
export function trf(key: string, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
}

/** Subscribe to the language itself — only `App` needs this. */
export function useLanguage(): Language {
  return useStore((s) => s.settings.language)
}

/** Kept for call sites that prefer the hook form; same function either way. */
export function useT() {
  useLanguage()
  return t
}
