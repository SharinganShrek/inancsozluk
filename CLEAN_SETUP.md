# Temiz Kurulum Rehberi - İnanç Sözlük

Bu dosya Supabase'deki tüm tabloları silip baştan kurmak için adım adım talimatlar içerir.

## ⚠️ ÖNEMLİ: Bu işlem tüm verileri silecek!

## Adım 1: Temizleme

Supabase Dashboard → SQL Editor → New Query → Aşağıdaki komutları çalıştır:

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

## Adım 2: Tabloları Oluştur

Yeni bir query aç ve şu komutları çalıştır:

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

## Adım 3: View Oluştur

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

## Adım 4: RLS Politikaları

```sql
-- RLS'yi aktif et
ALTER TABLE headings ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Headings tablosu için politikalar
CREATE POLICY "Headings are viewable by everyone"
  ON headings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create headings"
  ON headings FOR INSERT
  WITH CHECK (true);

-- Entries tablosu için politikalar
CREATE POLICY "Entries are viewable by everyone"
  ON entries FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create entries"
  ON entries FOR INSERT
  WITH CHECK (true);

-- User Profiles tablosu için politikalar
CREATE POLICY "User profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create user profile"
  ON user_profiles FOR INSERT
  WITH CHECK (true);
```

## Adım 5: Authentication Ayarları

Supabase Dashboard'da:

1. **Authentication** → **Settings** → **Auth** sekmesine git
2. **Enable Email Signup** seçeneğinin açık olduğundan emin ol
3. **Site URL**: `http://localhost:3000` ekle (development için)
4. **Redirect URLs**: `http://localhost:3000/**` ekle
5. **Email Confirmation**: İstersen kapatabilirsin (test için daha kolay)

## Adım 6: Kontrol

1. **Table Editor** → `headings`, `entries` ve `user_profiles` tablolarının oluşturulduğunu kontrol et
2. **SQL Editor** → View'ların oluşturulduğunu kontrol et (`headings_with_entry_counts`)
3. **Authentication** → **Users** sekmesinde kayıtlı kullanıcıları görebilirsin

## Adım 7: Test

Projeyi çalıştır:

```bash
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine git ve:
1. Kayıt ol (kullanıcı adı ile)
2. Giriş yap (email veya kullanıcı adı ile)
3. Entry ekle

## Sorun Giderme

- **Foreign key hatası**: Foreign key constraint'i kaldırdık, bu normal. Kod tarafında kontrol yapılıyor.
- **RLS hatası**: Politikaların doğru oluşturulduğundan emin ol.
- **View hatası**: Tablolar oluşturulduktan sonra view'ı oluştur.



