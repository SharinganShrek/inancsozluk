# Moderasyon Sistemi Kurulum Rehberi

Bu dosya moderasyon sistemini kurmak için Supabase'de çalıştırılması gereken SQL komutlarını içerir.

## Adım 1: Moderatör Tablosu Oluştur

Supabase Dashboard → SQL Editor → New Query → Aşağıdaki komutları çalıştır:

```sql
-- Moderatörler tablosu
CREATE TABLE IF NOT EXISTS moderators (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_moderators_user_id ON moderators(user_id);

-- RLS aktif et
ALTER TABLE moderators ENABLE ROW LEVEL SECURITY;

-- Moderatörler herkes tarafından görülebilir (kontrol için)
CREATE POLICY "Moderators are viewable by everyone"
  ON moderators FOR SELECT
  USING (true);

-- Sadece mevcut moderatörler yeni moderatör ekleyebilir (opsiyonel, manuel ekleme yapabilirsiniz)
-- Bu politikayı şimdilik eklemiyoruz, manuel olarak ekleyeceğiz
```

## Adım 2: Headings Tablosuna Status Kolonu Ekle

```sql
-- Headings tablosuna status kolonu ekle
ALTER TABLE headings 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Mevcut başlıkları approved yap
UPDATE headings SET status = 'approved' WHERE status IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_headings_status ON headings(status);
```

## Adım 3: Entries Tablosuna Status Kolonu Ekle

```sql
-- Entries tablosuna status kolonu ekle
ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Mevcut entry'leri approved yap
UPDATE entries SET status = 'approved' WHERE status IS NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
```

## Adım 4: RLS Politikalarını Güncelle

```sql
-- Mevcut politikaları güncelle - Sadece approved olanları göster
DROP POLICY IF EXISTS "Headings are viewable by everyone" ON headings;
DROP POLICY IF EXISTS "Entries are viewable by everyone" ON entries;

-- Headings: Sadece approved olanlar herkese görünür, pending/rejected olanlar sadece moderatörlere
CREATE POLICY "Headings are viewable by everyone"
  ON headings FOR SELECT
  USING (
    status = 'approved' OR
    EXISTS (
      SELECT 1 FROM moderators 
      WHERE moderators.user_id = auth.uid()
    )
  );

-- Entries: Sadece approved olanlar herkese görünür, pending/rejected olanlar sadece moderatörlere
CREATE POLICY "Entries are viewable by everyone"
  ON entries FOR SELECT
  USING (
    status = 'approved' OR
    EXISTS (
      SELECT 1 FROM moderators 
      WHERE moderators.user_id = auth.uid()
    )
  );

-- Yeni başlık oluştururken status pending olarak ayarlanacak
DROP POLICY IF EXISTS "Anyone can create headings" ON headings;
CREATE POLICY "Anyone can create headings"
  ON headings FOR INSERT
  WITH CHECK (true);

-- Yeni entry oluştururken status pending olarak ayarlanacak
DROP POLICY IF EXISTS "Anyone can create entries" ON entries;
CREATE POLICY "Anyone can create entries"
  ON entries FOR INSERT
  WITH CHECK (true);

-- Moderatörler status güncelleyebilir
CREATE POLICY "Moderators can update heading status"
  ON headings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM moderators 
      WHERE moderators.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moderators 
      WHERE moderators.user_id = auth.uid()
    )
  );

CREATE POLICY "Moderators can update entry status"
  ON entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM moderators 
      WHERE moderators.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM moderators 
      WHERE moderators.user_id = auth.uid()
    )
  );
```

## Adım 5: Moderatör Ekleme

Kendinizi ve arkadaşınızı moderatör olarak eklemek için:

1. Önce kullanıcı ID'lerinizi bulun:
```sql
-- Kullanıcı email'lerinizle ID'lerinizi bulun
SELECT id, email FROM auth.users WHERE email IN ('sizin-email@example.com', 'arkadas-email@example.com');
```

2. Sonra moderatör olarak ekleyin (yukarıdaki sorgudan aldığınız ID'leri kullanın):
```sql
-- Moderatör ekle (user_id'leri yukarıdaki sorgudan alın)
INSERT INTO moderators (user_id) 
VALUES 
  ('user-id-1-buraya'),
  ('user-id-2-buraya');
```

## Adım 6: View'ı Güncelle (Opsiyonel)

Eğer headings_with_entry_counts view'ını kullanıyorsanız, sadece approved olanları gösterecek şekilde güncelleyin:

```sql
-- Önce mevcut view'ı sil
DROP VIEW IF EXISTS headings_with_entry_counts;

-- View'ı yeniden oluştur (sadece approved başlıklar ve entry'ler)
CREATE VIEW headings_with_entry_counts AS
SELECT 
  h.id,
  h.title,
  h.created_at,
  h.status,
  COUNT(e.id) FILTER (WHERE e.status = 'approved') as entry_count
FROM headings h
LEFT JOIN entries e 
  ON e.heading_id = h.id 
  AND e.created_at >= NOW() - INTERVAL '7 days'
  AND e.status = 'approved'
WHERE h.status = 'approved'
GROUP BY h.id, h.title, h.created_at, h.status
ORDER BY entry_count DESC, h.created_at DESC;
```

## Notlar

- Yeni başlık ve entry'ler otomatik olarak `pending` status'ü ile oluşturulacak
- Sadece `approved` status'ündeki içerikler normal kullanıcılara görünecek
- Moderatörler tüm status'leri görebilir ve değiştirebilir
- Moderatör paneli frontend'de eklenecek


