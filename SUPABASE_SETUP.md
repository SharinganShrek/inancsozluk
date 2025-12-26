# İnanç Sözlük - Supabase Kurulum Rehberi

Bu dosya Supabase projenizi kurmak için gereken tüm adımları içerir.

## 1. .env.local Dosyası Oluşturma

Proje kök dizininde (package.json ile aynı seviyede) `.env.local` adında bir dosya oluştur ve şu içeriği ekle:

```
NEXT_PUBLIC_SUPABASE_URL=https://raejvigwblergcwgpkes.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_P1xvOMLfKxBVXyg23AeHsQ_vnIIqGPK
```

## 2. Temizleme (Eğer Zaten Tablolar Varsa)

**ÖNEMLİ**: Eğer daha önce tablolar oluşturduysan, önce bunları temizle:

```sql
-- Tüm politikaları sil
DROP POLICY IF EXISTS "Headings are viewable by everyone" ON headings;
DROP POLICY IF EXISTS "Anyone can create headings" ON headings;
DROP POLICY IF EXISTS "Entries are viewable by everyone" ON entries;
DROP POLICY IF EXISTS "Anyone can create entries" ON entries;
DROP POLICY IF EXISTS "User profiles are viewable by everyone" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can create user profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;

-- View'ları sil
DROP VIEW IF EXISTS headings_with_entry_counts;

-- Tabloları sil (sıra önemli - foreign key'ler nedeniyle)
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS headings CASCADE;
```

## 3. Supabase SQL Editor'da Çalıştırılacak Komutlar

Supabase Dashboard'a git → SQL Editor → New Query → Aşağıdaki SQL komutlarını **SIRAYLA** çalıştır:

### Adım 1: Tabloları Oluştur

```sql
-- 1. Headings (Başlıklar) tablosu
CREATE TABLE headings (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Entries (Girdiler) tablosu
CREATE TABLE entries (
  id BIGSERIAL PRIMARY KEY,
  heading_id BIGINT NOT NULL REFERENCES headings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Profiles (Kullanıcı Profilleri) tablosu
-- NOT: Foreign key constraint'i kaldırdık çünkü kayıt sırasında auth.users'da henüz kullanıcı olmayabilir
CREATE TABLE user_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Index'ler (performans için)
CREATE INDEX idx_entries_heading_id ON entries(heading_id);
CREATE INDEX idx_entries_created_at ON entries(created_at);
CREATE INDEX idx_headings_created_at ON headings(created_at);
CREATE INDEX idx_headings_title ON headings(title);
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(username);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
```

### Adım 2: Popüler Başlıklar için View Oluştur

```sql
-- Son 7 günde en çok entry alan başlıkları gösteren view
CREATE OR REPLACE VIEW headings_with_entry_counts AS
SELECT 
  h.id,
  h.title,
  h.created_at,
  COUNT(e.id) as entry_count
FROM headings h
LEFT JOIN entries e 
  ON e.heading_id = h.id 
  AND e.created_at >= NOW() - INTERVAL '7 days'
GROUP BY h.id, h.title, h.created_at
ORDER BY entry_count DESC, h.created_at DESC;
```

### Adım 3: Row Level Security (RLS) Politikaları

```sql
-- RLS'yi aktif et
ALTER TABLE headings ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Headings tablosu için politikalar
-- Herkes okuyabilir
CREATE POLICY "Headings are viewable by everyone"
  ON headings FOR SELECT
  USING (true);

-- Herkes başlık oluşturabilir (giriş yapmış olmasına gerek yok)
CREATE POLICY "Anyone can create headings"
  ON headings FOR INSERT
  WITH CHECK (true);

-- Entries tablosu için politikalar
-- Herkes okuyabilir
CREATE POLICY "Entries are viewable by everyone"
  ON entries FOR SELECT
  USING (true);

-- Herkes entry ekleyebilir (giriş yapmış olmasına gerek yok)
CREATE POLICY "Anyone can create entries"
  ON entries FOR INSERT
  WITH CHECK (true);

-- User Profiles tablosu için politikalar
-- Herkes kullanıcı profillerini okuyabilir
CREATE POLICY "User profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

-- Herkes profil oluşturabilir (kod tarafında user_id kontrolü yapılıyor)
CREATE POLICY "Anyone can create user profile"
  ON user_profiles FOR INSERT
  WITH CHECK (true);
```

### Adım 5: Test Verisi Ekleme (Opsiyonel)

Eğer test için örnek veri eklemek istersen:

```sql
-- Örnek başlıklar ekle
INSERT INTO headings (title) VALUES 
  ('TEV İnanç Lisesi'),
  ('Matematik'),
  ('Fizik'),
  ('Kimya'),
  ('Edebiyat');

-- Örnek entry'ler ekle
INSERT INTO entries (heading_id, content, author) VALUES
  (1, 'TEV İnanç Lisesi, Türkiye''nin önde gelen eğitim kurumlarından biridir.', 'Öğrenci1'),
  (1, 'Okulumuzun tarihi çok eskilere dayanır.', 'Öğrenci2'),
  (2, 'Matematik dersinde en çok integral konusunu seviyorum.', 'Öğrenci1'),
  (3, 'Fizik laboratuvarında deneyler yapmak çok eğlenceli.', 'Öğrenci3');
```

### Adım 4: Authentication (Auth) Ayarları

Supabase Dashboard'da:

1. **Authentication** → **Settings** → **Auth** sekmesine git
2. **Enable Email Signup** seçeneğinin açık olduğundan emin ol
3. **Email Templates** (opsiyonel): Email doğrulama şablonlarını özelleştirebilirsin
4. **Site URL**: `http://localhost:3000` ekle (development için)
5. **Redirect URLs**: `http://localhost:3000/**` ekle

**Not**: Email doğrulama zorunlu değil, ama güvenlik için önerilir. Şu an kod email doğrulama olmadan da çalışır.

## 3. Supabase Dashboard'da Kontrol Et

1. **Table Editor** → `headings`, `entries` ve `user_profiles` tablolarının oluşturulduğunu kontrol et
2. **SQL Editor** → View'ların oluşturulduğunu kontrol et (`headings_with_entry_counts`)
3. **Authentication** → **Users** sekmesinde kayıtlı kullanıcıları görebilirsin

## 4. Projeyi Çalıştır

Terminal'de:

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine git ve platformu test et!

## Notlar

- **RLS Politikaları**: Şu an herkes okuyup yazabilir. Entry eklemek için giriş yapmak gerekiyor (kod tarafında kontrol ediliyor).
- **Popüler Başlıklar**: `headings_with_entry_counts` view'ı son 7 günde en çok entry alan başlıkları gösterir. Bu süreyi değiştirmek istersen view'daki `INTERVAL '7 days'` kısmını değiştir.
- **Kullanıcı Adı**: Kayıt olurken kullanıcı adı girilmesi zorunludur. Giriş yaparken email veya kullanıcı adı kullanılabilir. Kullanıcı adları benzersiz olmalıdır (sadece küçük harf, rakam ve alt çizgi).
- **Author Alanı**: Entry'lerde `author` alanı kullanıcı adını kullanıyor. Eğer kullanıcı adı yoksa email'in @ öncesi kısmı kullanılıyor.
- **Authentication**: Email/şifre ile giriş yapılıyor. Email doğrulama açıksa, kayıt sonrası email'deki linke tıklanması gerekir.

