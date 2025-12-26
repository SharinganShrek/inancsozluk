"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User, Session } from "@supabase/supabase-js";

type FilterType = "today" | "yesterday" | "popular" | "none";

type Heading = {
  id: number;
  title: string;
  createdAt: string;
  entryCount: number;
};

type Entry = {
  id: number;
  headingId: number;
  content: string;
  createdAt: string;
  author?: string | null;
};

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("none");
  const [sideMenuHeadings, setSideMenuHeadings] = useState<Heading[]>([]);
  const [selectedHeading, setSelectedHeading] = useState<Heading | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [newEntryContent, setNewEntryContent] = useState("");
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [searchResults, setSearchResults] = useState<Heading[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [userUsername, setUserUsername] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [votes, setVotes] = useState<
    Record<number, { up: number; down: number; userVote: -1 | 0 | 1 }>
  >({});
  const [showBkzPanel, setShowBkzPanel] = useState(false);
  const [bkzSearchTerm, setBkzSearchTerm] = useState("");
  const [bkzSearchResults, setBkzSearchResults] = useState<Heading[]>([]);
  const [selectedBkzHeading, setSelectedBkzHeading] = useState<Heading | null>(null);

  // Auth state kontrolü
  useEffect(() => {
    checkUser();
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserUsername(session.user.id);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.user) {
      await fetchUserUsername(session.user.id);
    }
  }

  async function fetchUserUsername(userId: string) {
    const { data } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("user_id", userId)
      .single();
    
    if (data) {
      setUserUsername(data.username);
    }
  }

  // Sayfa açıldığında popüler başlıkları getir
  useEffect(() => {
    fetchPopularHeadings();
  }, []);

  async function fetchPopularHeadings() {
    setLoading(true);
    setActiveFilter("popular");

    try {
      // View kullanarak popüler başlıkları getir
      const { data, error } = await supabase
        .from("headings_with_entry_counts")
        .select("*")
        .order("entry_count", { ascending: false })
        .limit(50);

      if (error) {
        // View yoksa alternatif sorgu
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data: headingsData, error: headingsError } = await supabase
          .from("headings")
          .select(`
            id,
            title,
            created_at,
            entries!inner(id)
          `)
          .gte("entries.created_at", oneWeekAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(50);

        if (!headingsError && headingsData) {
          // Entry sayılarını hesapla
          const headingMap = new Map<number, Heading>();
          headingsData.forEach((h: any) => {
            if (!headingMap.has(h.id)) {
              headingMap.set(h.id, {
                id: h.id,
                title: h.title,
                createdAt: h.created_at,
                entryCount: 0,
              });
            }
            headingMap.get(h.id)!.entryCount++;
          });
          setSideMenuHeadings(Array.from(headingMap.values()));
        }
      } else if (data) {
        const mapped: Heading[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          entryCount: row.entry_count ?? 0,
        }));
        setSideMenuHeadings(mapped);
      }
    } catch (err) {
      console.error("Error fetching popular headings:", err);
    }

    setLoading(false);
  }

  async function fetchHeadingsByDay(day: "today" | "yesterday") {
    setLoading(true);
    setActiveFilter(day);

    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (day === "today" ? 0 : 1),
      0,
      0,
      0
    );
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (day === "today" ? 0 : 1),
      23,
      59,
      59
    );

    try {
      const { data, error } = await supabase
        .from("headings")
        .select(`
          id,
          title,
          created_at,
          entries(count)
        `)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });

      if (!error && data) {
        // Entry count'ları ayrı sorgu ile al
        const headingIds = data.map((h: any) => h.id);
        const { data: entryCounts } = await supabase
          .from("entries")
          .select("heading_id")
          .in("heading_id", headingIds);

        const countMap = new Map<number, number>();
        entryCounts?.forEach((e: any) => {
          countMap.set(e.heading_id, (countMap.get(e.heading_id) || 0) + 1);
        });

        const mapped: Heading[] = data.map((row: any) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          entryCount: countMap.get(row.id) ?? 0,
        }));
        setSideMenuHeadings(mapped);
      }
    } catch (err) {
      console.error("Error fetching headings by day:", err);
    }

    setLoading(false);
  }

  async function fetchRandomHeading() {
    setLoading(true);
    setActiveFilter("none");

    const { data, error } = await supabase
      .from("headings")
      .select("id, title, created_at")
      .limit(1000);

    if (!error && data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      const heading: Heading = {
        id: random.id,
        title: random.title,
        createdAt: random.created_at,
        entryCount: 0,
      };
      setSelectedHeading(heading);
      await fetchEntriesForHeading(heading.id);
    }

    setLoading(false);
  }

  async function fetchEntriesForHeading(headingId: number) {
    setLoading(true);
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("heading_id", headingId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      const mapped: Entry[] = data.map((row: any) => ({
        id: row.id,
        headingId: row.heading_id,
        content: row.content,
        createdAt: row.created_at,
        author: row.author ?? null,
      }));
      setEntries(mapped);
      await refreshVotes(mapped.map((m) => m.id));
    }
    setLoading(false);
  }

  function handleSelectHeading(heading: Heading) {
    setSelectedHeading(heading);
    fetchEntriesForHeading(heading.id);
  }

  // Auth fonksiyonları
  async function handleLogin() {
    setAuthLoading(true);
    setAuthError(null);

    // Email veya kullanıcı adı kontrolü
    let emailToUse = emailOrUsername;
    
    // Eğer @ işareti yoksa, kullanıcı adı olarak kabul et ve email'i bul
    if (!emailOrUsername.includes("@")) {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("email")
        .eq("username", emailOrUsername.toLowerCase())
        .single();
      
      if (!profileData) {
        setAuthError("Kullanıcı adı veya email bulunamadı.");
        setAuthLoading(false);
        return;
      }
      
      emailToUse = profileData.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error) {
      setAuthError(error.message);
    } else {
      setShowAuthModal(false);
      setEmailOrUsername("");
      setPassword("");
      if (data.user) {
        await fetchUserUsername(data.user.id);
      }
    }

    setAuthLoading(false);
  }

  async function handleSignup() {
    setAuthLoading(true);
    setAuthError(null);

    // Kullanıcı adı kontrolü
    if (!username.trim()) {
      setAuthError("Kullanıcı adı gereklidir.");
      setAuthLoading(false);
      return;
    }

    // Kullanıcı adı benzersizlik kontrolü
    const { data: existingUser } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("username", username.toLowerCase())
      .single();

    if (existingUser) {
      setAuthError("Bu kullanıcı adı zaten kullanılıyor.");
      setAuthLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailOrUsername,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
    } else if (data.user) {
      // Kullanıcı profilini oluştur
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: data.user.id,
          username: username.toLowerCase(),
          email: emailOrUsername,
        });

      if (profileError) {
        setAuthError("Profil oluşturulurken bir hata oluştu: " + profileError.message);
      } else {
        setAuthError("Kayıt başarılı! Email'inizi kontrol edin.");
        setUserUsername(username.toLowerCase());
        setTimeout(() => {
          setShowAuthModal(false);
          setEmailOrUsername("");
          setUsername("");
          setPassword("");
        }, 2000);
      }
    }

    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }

  // Entry ekleme
  async function handleSubmitEntry() {
    if (!selectedHeading || !newEntryContent.trim() || !user) return;

    setSubmittingEntry(true);

    const { data, error } = await supabase
      .from("entries")
      .insert({
        heading_id: selectedHeading.id,
        content: newEntryContent.trim(),
        author: userUsername || user.email?.split("@")[0] || "anonim",
      })
      .select()
      .single();

    if (!error && data) {
      setNewEntryContent("");
      setSelectedBkzHeading(null);
      setShowBkzPanel(false);
      setBkzSearchTerm("");
      setBkzSearchResults([]);
      // Entry'leri yeniden yükle
      await fetchEntriesForHeading(selectedHeading.id);
      // Başlık entry count'unu güncelle
      const updatedHeading = { ...selectedHeading };
      updatedHeading.entryCount++;
      setSelectedHeading(updatedHeading);
    }

    setSubmittingEntry(false);
  }

  // Arama fonksiyonu
  async function handleSearch() {
    if (!searchTerm.trim()) {
      setShowSearchResults(false);
      return;
    }

    setLoading(true);
    setShowSearchResults(true);

    try {
      // Başlıklarda ara
      const { data: headingsData, error: headingsError } = await supabase
        .from("headings")
        .select("id, title, created_at")
        .ilike("title", `%${searchTerm}%`)
        .limit(20);

      if (!headingsError && headingsData) {
        // Entry sayılarını al
        const headingIds = headingsData.map((h: any) => h.id);
        const { data: entryCounts } = await supabase
          .from("entries")
          .select("heading_id")
          .in("heading_id", headingIds);

        const countMap = new Map<number, number>();
        entryCounts?.forEach((e: any) => {
          countMap.set(e.heading_id, (countMap.get(e.heading_id) || 0) + 1);
        });

        const mapped: Heading[] = headingsData.map((row: any) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          entryCount: countMap.get(row.id) ?? 0,
        }));

        setSearchResults(mapped);
        setSideMenuHeadings(mapped);
        setActiveFilter("none");
      }
    } catch (err) {
      console.error("Error searching:", err);
    }

    setLoading(false);
  }

  // Enter tuşu ile arama
  function handleSearchKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  // Başlık oluşturma (arama sonucu yoksa)
  async function handleCreateHeading(title: string) {
    if (!title.trim()) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("headings")
      .insert({ title: title.trim() })
      .select()
      .single();

    if (!error && data) {
      const newHeading: Heading = {
        id: data.id,
        title: data.title,
        createdAt: data.created_at,
        entryCount: 0,
      };
      setSelectedHeading(newHeading);
      setSearchTerm("");
      setShowSearchResults(false);
    }

    setLoading(false);
  }

  // Bkz arama fonksiyonu
  async function handleBkzSearch(searchText: string) {
    if (!searchText.trim()) {
      setBkzSearchResults([]);
      return;
    }

    try {
      const { data: headingsData, error: headingsError } = await supabase
        .from("headings")
        .select("id, title, created_at")
        .ilike("title", `%${searchText}%`)
        .limit(10);

      if (!headingsError && headingsData) {
        const headingIds = headingsData.map((h: any) => h.id);
        const { data: entryCounts } = await supabase
          .from("entries")
          .select("heading_id")
          .in("heading_id", headingIds);

        const countMap = new Map<number, number>();
        entryCounts?.forEach((e: any) => {
          countMap.set(e.heading_id, (countMap.get(e.heading_id) || 0) + 1);
        });

        const mapped: Heading[] = headingsData.map((row: any) => ({
          id: row.id,
          title: row.title,
          createdAt: row.created_at,
          entryCount: countMap.get(row.id) ?? 0,
        }));

        setBkzSearchResults(mapped);
      }
    } catch (err) {
      console.error("Error searching for bkz:", err);
    }
  }

  // Bkz başlık seçme
  function handleSelectBkzHeading(heading: Heading) {
    setSelectedBkzHeading(heading);
    setShowBkzPanel(false);
    setBkzSearchTerm("");
    setBkzSearchResults([]);
    
    // Entry içeriğine (bkz: [başlık]) ekle
    const cursorPos = (document.activeElement as HTMLTextAreaElement)?.selectionStart || newEntryContent.length;
    const textBefore = newEntryContent.substring(0, cursorPos);
    const textAfter = newEntryContent.substring(cursorPos);
    const bkzText = `(bkz: ${heading.title})`;
    setNewEntryContent(textBefore + bkzText + textAfter);
  }

  // Entry içeriğini parse edip (bkz:) linklerini render et
  function renderEntryContent(content: string) {
    // (bkz: başlık) formatını bul
    const bkzRegex = /\(bkz:\s*([^)]+)\)/gi;
    const parts: JSX.Element[] = [];
    let lastIndex = 0;
    let match;
    let keyIndex = 0;

    while ((match = bkzRegex.exec(content)) !== null) {
      // Önceki metni ekle
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${keyIndex++}`}>
            {content.substring(lastIndex, match.index)}
          </span>
        );
      }
      
      const headingTitle = match[1].trim();
      // Başlık linki oluştur
      parts.push(
        <span
          key={`bkz-${keyIndex++}`}
          onClick={() => {
            // Başlığı bul ve seç
            supabase
              .from("headings")
              .select("id, title, created_at")
              .ilike("title", headingTitle)
              .limit(1)
              .single()
              .then(({ data, error }) => {
                if (!error && data) {
                  const heading: Heading = {
                    id: data.id,
                    title: data.title,
                    createdAt: data.created_at,
                    entryCount: 0,
                  };
                  handleSelectHeading(heading);
                }
              });
          }}
          className={`cursor-pointer font-medium hover:underline ${
            theme === "light" ? "text-red-600" : "text-red-400"
          }`}
        >
          {headingTitle}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Kalan metni ekle
    if (lastIndex < content.length) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {content.substring(lastIndex)}
        </span>
      );
    }
    
    return parts.length > 0 ? <>{parts}</> : <>{content}</>;
  }

  // Oy verme (geçici, local state; DB'ye yazmak istersen entries tablosuna upvote/downvote kolonları ekle)
  async function refreshVotes(entryIds: number[]) {
    if (entryIds.length === 0) return;
    // Tüm oylar
    const { data: votesData } = await supabase
      .from("entry_votes")
      .select("entry_id, value, user_id")
      .in("entry_id", entryIds);

    const counts: Record<number, { up: number; down: number; userVote: -1 | 0 | 1 }> = {};
    votesData?.forEach((v) => {
      const current = counts[v.entry_id] || { up: 0, down: 0, userVote: 0 };
      if (v.value === 1) current.up += 1;
      if (v.value === -1) current.down += 1;
      if (v.user_id === session?.user?.id) current.userVote = v.value as -1 | 0 | 1;
      counts[v.entry_id] = current;
    });

    // Boş olanlar için default
    entryIds.forEach((id) => {
      if (!counts[id]) counts[id] = { up: 0, down: 0, userVote: 0 };
    });

    setVotes((prev) => ({ ...prev, ...counts }));
  }

  async function handleVote(entryId: number, value: -1 | 1) {
    if (!user) {
      setAuthMode("login");
      setShowAuthModal(true);
      return;
    }

    const currentVote = votes[entryId]?.userVote ?? 0;

    if (currentVote === value) {
      // Aynı oyu verdi, sil
      await supabase
        .from("entry_votes")
        .delete()
        .eq("entry_id", entryId)
        .eq("user_id", session!.user.id);
    } else {
      // Yeni oy
      await supabase
        .from("entry_votes")
        .upsert(
          {
            entry_id: entryId,
            user_id: session!.user.id,
            value,
          },
          { onConflict: "entry_id,user_id" }
        )
        .select();
    }

    await refreshVotes([entryId]);
  }

  const mainBg = theme === "light" ? "bg-white text-zinc-900" : "bg-zinc-950 text-zinc-50";
  const panelBg = theme === "light" ? "bg-white" : "bg-zinc-900/60";
  const panelBorder = theme === "light" ? "border-zinc-200" : "border-zinc-800";
  const surface = theme === "light" ? "bg-white" : "bg-zinc-900/80";
  const inputBg = theme === "light" ? "bg-white" : "bg-zinc-950";
  const inputBorder = theme === "light" ? "border-zinc-300" : "border-zinc-700";
  const subText = theme === "light" ? "text-zinc-600" : "text-zinc-500";
  const mutedText = theme === "light" ? "text-zinc-500" : "text-zinc-500";
  const headingTitleColor = theme === "light" ? "text-red-600" : "text-red-300";
  const entryTextColor = theme === "light" ? "text-zinc-900" : "text-zinc-200";
  const metaTextColor = theme === "light" ? "text-zinc-600" : "text-zinc-500";

  return (
    <div className={`flex flex-col min-h-screen ${mainBg}`}>
      {/* Üst bar */}
      <header
        className={`sticky top-0 z-30 flex items-center gap-4 border-b ${panelBorder} ${
          theme === "light" ? "bg-white/90" : "bg-zinc-950/80"
        } px-6 py-3 backdrop-blur-md w-full`}
      >
          {/* Sol: logo + butonlar */}
          <div className="flex items-center gap-4">
            <div
              className={`text-xl font-bold ${
                theme === "light" ? "text-red-600" : "text-red-400"
              }`}
              style={{ fontFamily: 'var(--font-chillax-bold)' }}
            >
              İnanç Sözlük
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <button
                className={`rounded-full border px-3 py-1 transition-colors ${
                  theme === "light"
                    ? "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                }`}
                onClick={fetchRandomHeading}
              >
                rastgele
              </button>
              <button
                className={`rounded-full border px-3 py-1 transition-colors ${
                  theme === "light"
                    ? "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                }`}
                onClick={() => fetchHeadingsByDay("today")}
              >
                bugün
              </button>
              <button
                className={`rounded-full border px-3 py-1 transition-colors ${
                  theme === "light"
                    ? "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                }`}
                onClick={() => fetchHeadingsByDay("yesterday")}
              >
                dün
              </button>
              <button
                className="rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-red-300 hover:bg-red-500/20"
                onClick={fetchPopularHeadings}
              >
                popüler
              </button>
            </div>
          </div>

          {/* Orta: arama */}
          <div className="mx-auto flex max-w-xl flex-1 items-center">
            <div className="relative w-full">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                placeholder="başlık veya entry ara..."
                className={`w-full rounded-full border px-4 py-2 text-sm placeholder:text-zinc-500 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
                  theme === "light"
                    ? "border-zinc-300 bg-white text-zinc-800"
                    : "border-zinc-700 bg-zinc-900 text-zinc-100"
                }`}
              />
              <button
                onClick={handleSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500"
              >
                Ara
              </button>
            </div>
          </div>

          {/* Sağ: giriş alanı + tema */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              className={`rounded-full border px-3 py-1 transition-colors ${
                theme === "light"
                  ? "border-zinc-300 bg-white text-zinc-700 hover:border-red-400 hover:bg-red-50"
                  : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-red-500 hover:bg-zinc-800"
              }`}
            >
              {theme === "light" ? "karanlık" : "aydınlık"}
            </button>
            {user ? (
              <>
                <span className="hidden text-zinc-400 sm:inline">
                  {userUsername || user.email?.split("@")[0] || "Kullanıcı"}
                </span>
                <button
                  onClick={handleLogout}
                  className={`rounded-full border px-3 py-1 transition-colors ${
                    theme === "light"
                      ? "border-zinc-300 bg-white text-zinc-700 hover:border-red-400 hover:bg-red-50"
                      : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-red-500 hover:bg-zinc-800"
                  }`}
                >
                  çıkış
                </button>
              </>
            ) : (
              <>
                <span className="hidden text-zinc-400 sm:inline">
                  Henüz giriş yapılmadı
                </span>
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setShowAuthModal(true);
                  }}
                  className={`rounded-full border px-3 py-1 transition-colors ${
                    theme === "light"
                      ? "border-zinc-300 bg-white text-zinc-700 hover:border-red-400 hover:bg-red-50"
                      : "border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-red-500 hover:bg-zinc-800"
                  }`}
                >
                  giriş yap
                </button>
                <button
                  onClick={() => {
                    setAuthMode("signup");
                    setShowAuthModal(true);
                  }}
                  className="hidden rounded-full bg-red-600 px-3 py-1 text-white hover:bg-red-500 sm:inline"
                >
                  kayıt ol
                </button>
              </>
            )}
          </div>
        </header>

      {/* Alt kısım: Sol menü + Ana alan */}
      <div className="flex flex-1 min-h-0">
        {/* Sol menü */}
        <aside
          className={`relative z-20 flex w-72 flex-col border-r ${panelBorder} ${surface} backdrop-blur-sm`}
        >
          <div className={`flex items-center justify-between px-4 py-3 border-b ${panelBorder}`}>
            <span className="text-xs uppercase tracking-wide text-zinc-400">
              {activeFilter === "today"
                ? "Bugün Girilen Başlıklar"
                : activeFilter === "yesterday"
                ? "Dün Girilen Başlıklar"
                : activeFilter === "popular"
                ? "Popüler Başlıklar"
                : "Başlıklar"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-zinc-400">
                Yükleniyor...
              </div>
            )}
            {!loading && sideMenuHeadings.length === 0 && (
              <div className="px-4 py-3 text-sm text-zinc-500">
                Henüz gösterilecek başlık yok.
              </div>
            )}
            <ul className="space-y-0.5 px-2 py-2">
              {sideMenuHeadings.map((heading) => (
                <li key={heading.id}>
                  <button
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      theme === "light" ? "hover:bg-zinc-200" : "hover:bg-zinc-700"
                    }`}
                    onClick={() => handleSelectHeading(heading)}
                  >
                    <div className={`font-medium line-clamp-2 ${
                      theme === "light" ? "text-red-600" : "text-red-400"
                    }`}>
                      {heading.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {heading.entryCount} entry
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Ana alan */}
        <div className="flex flex-1 flex-col min-h-0">
          {/* İçerik */}
          <main className="flex flex-1 flex-col px-4 py-4 lg:px-6 overflow-y-auto">
          {/* Seçili başlık */}
          {selectedHeading ? (
            <>
              {/* Başlık başlığı */}
              <div className={`mb-4 pb-3 border-b ${panelBorder}`}>
                <h1 className={`text-xl font-semibold mb-1 ${headingTitleColor}`}>
                  {selectedHeading.title}
                </h1>
                <span className={`text-xs ${metaTextColor}`}>
                  {selectedHeading.entryCount} entry
                </span>
              </div>

              {/* Entry listesi - eksisozluk tarzı */}
              <div className="mb-6 max-h-[65vh] overflow-y-auto">
                {entries.length === 0 && (
                  <div className="py-8 text-center text-sm text-zinc-500">
                    Bu başlıkta henüz entry yok. İlk yazan sen ol.
                  </div>
                )}
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="mb-5 pb-5 border-b border-zinc-800/30 last:border-b-0 last:mb-0 last:pb-0"
                  >
                    {/* Oylar */}
                    <div className="flex items-center justify-end max-w-3xl mx-auto px-4 mb-2 gap-2 text-xs">
                      <button
                        onClick={() => handleVote(entry.id, 1)}
                        className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-colors ${
                          votes[entry.id]?.userVote === 1
                            ? "border-red-500 bg-red-500/10 text-red-300"
                            : "border-zinc-700 text-zinc-400 hover:border-red-500"
                        }`}
                      >
                        ↑ <span>{votes[entry.id]?.up ?? 0}</span>
                      </button>
                      <button
                        onClick={() => handleVote(entry.id, -1)}
                        className={`flex items-center gap-1 rounded-full border px-2 py-1 transition-colors ${
                          votes[entry.id]?.userVote === -1
                            ? "border-red-500 bg-red-500/10 text-red-300"
                            : "border-zinc-700 text-zinc-400 hover:border-red-500"
                        }`}
                      >
                        ↓ <span>{votes[entry.id]?.down ?? 0}</span>
                      </button>
                    </div>
                    {/* Entry içeriği - ortalanmış ve genişliği sınırlı */}
                    <div className={`mb-3 text-sm leading-6 max-w-3xl mx-auto px-4 ${entryTextColor}`}>
                      <p className="whitespace-pre-wrap">{renderEntryContent(entry.content)}</p>
                    </div>
                    {/* Yazar ve tarih - sağa hizalı */}
                    <div className={`flex justify-end items-center text-xs max-w-3xl mx-auto px-4 ${metaTextColor}`}>
                      <span className="font-medium">
                        {entry.author ?? "anonim"}
                      </span>
                      <span className="mx-2 text-zinc-600">•</span>
                      <span className={metaTextColor}>
                        {new Date(entry.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Entry yazma alanı - eksisozluk tarzı */}
              <div className="border-t border-zinc-800 pt-5 mt-2">
                {user ? (
                  <div className="flex flex-col gap-3 max-w-3xl mx-auto px-4">
                    <textarea
                      value={newEntryContent}
                      onChange={(e) => setNewEntryContent(e.target.value)}
                      className={`min-h-[120px] w-full resize-y rounded border px-4 py-3 text-sm placeholder:text-zinc-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
                        theme === "light"
                          ? "border-zinc-300 bg-zinc-100 text-zinc-900"
                          : "border-zinc-700 bg-zinc-950/40 text-zinc-100"
                      }`}
                      placeholder="entry'nizi yazın..."
                      disabled={submittingEntry}
                    />
                    {showBkzPanel && (
                      <div className={`rounded-lg border ${panelBorder} ${panelBg} p-3 space-y-2`}>
                        <p className="text-xs text-zinc-500 mb-2">Hangi başlığa yönlendirilmesini istersiniz?</p>
                        <input
                          type="text"
                          value={bkzSearchTerm}
                          onChange={(e) => {
                            setBkzSearchTerm(e.target.value);
                            handleBkzSearch(e.target.value);
                          }}
                          placeholder="başlık ara..."
                          className={`w-full rounded-full border px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
                            theme === "light"
                              ? "border-zinc-300 bg-white text-zinc-800"
                              : "border-zinc-700 bg-zinc-900 text-zinc-100"
                          }`}
                          autoFocus
                        />
                        {bkzSearchResults.length > 0 && (
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {bkzSearchResults.map((heading) => (
                              <button
                                key={heading.id}
                                onClick={() => handleSelectBkzHeading(heading)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                  theme === "light"
                                    ? "hover:bg-zinc-200 text-red-600"
                                    : "hover:bg-zinc-700 text-red-400"
                                }`}
                              >
                                {heading.title}
                              </button>
                            ))}
                          </div>
                        )}
                        {bkzSearchTerm && bkzSearchResults.length === 0 && (
                          <p className="text-xs text-zinc-500 px-3">Sonuç bulunamadı</p>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowBkzPanel(!showBkzPanel);
                          if (!showBkzPanel) {
                            setBkzSearchTerm("");
                            setBkzSearchResults([]);
                          }
                        }}
                        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                          theme === "light"
                            ? "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-100"
                            : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
                        }`}
                      >
                        (bkz:)
                      </button>
                      <button
                        onClick={handleSubmitEntry}
                        disabled={!newEntryContent.trim() || submittingEntry}
                        className="rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:bg-red-400 disabled:text-white disabled:cursor-not-allowed"
                      >
                        {submittingEntry ? "gönderiliyor..." : "gönder"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto px-4">
                    <div className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-center text-sm text-zinc-500">
                      Entry yazmak için{" "}
                      <button
                        onClick={() => {
                          setAuthMode("login");
                          setShowAuthModal(true);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        giriş yap
                      </button>{" "}
                      veya{" "}
                      <button
                        onClick={() => {
                          setAuthMode("signup");
                          setShowAuthModal(true);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        kayıt ol
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <section className={`rounded-xl border ${panelBorder} ${panelBg} p-4 shadow-sm`}>
              <div className="flex flex-col gap-3 text-sm">
                <p className={subText}>
                  Yeni bir başlık açmak ister misin?
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="başlık adı"
                    className={`w-full max-w-md rounded-full border px-4 py-2 text-sm outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 ${
                      theme === "light"
                        ? "border-zinc-300 bg-white text-zinc-800"
                        : "border-zinc-700 bg-zinc-900 text-zinc-100"
                    }`}
                  />
                  <button
                    onClick={() => handleCreateHeading(searchTerm)}
                    disabled={!searchTerm.trim() || loading}
                    style={{ backgroundColor: 'var(--color-red-600)' }}
                    className="rounded-full border border-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:bg-red-400 disabled:text-white disabled:cursor-not-allowed"
                  >
                    yeni başlık oluştur
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Arama sonuçları yoksa başlık oluştur */}
          {showSearchResults && searchResults.length === 0 && !loading && searchTerm.trim() && (
            <section className={`rounded-xl border ${panelBorder} ${panelBg} p-4 shadow-sm`}>
              <div className="flex flex-col gap-2">
                <p className="text-sm text-zinc-400">
                  "{searchTerm}" için başlık bulunamadı. Yeni başlık oluşturmak ister misin?
                </p>
                <button
                  onClick={() => handleCreateHeading(searchTerm)}
                  disabled={loading}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:bg-red-400 disabled:text-white disabled:cursor-not-allowed"
                >
                  "{searchTerm}" başlığını oluştur
                </button>
              </div>
            </section>
          )}
        </main>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-100">
                {authMode === "login" ? "Giriş Yap" : "Kayıt Ol"}
              </h2>
              <button
                onClick={() => setShowAuthModal(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  {authMode === "login" ? "Email veya Kullanıcı Adı" : "Email"}
                </label>
                <input
                  type={authMode === "login" ? "text" : "email"}
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder={authMode === "login" ? "email veya kullanıcı adı" : "email@example.com"}
                />
              </div>

              {authMode === "signup" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    placeholder="kullanici_adi"
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Sadece küçük harf, rakam ve alt çizgi kullanılabilir
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Şifre
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="••••••••"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      authMode === "login" ? handleLogin() : handleSignup();
                    }
                  }}
                />
              </div>

              {authError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {authError}
                </div>
              )}

              <button
                onClick={authMode === "login" ? handleLogin : handleSignup}
                disabled={authLoading || !emailOrUsername || !password || (authMode === "signup" && !username)}
                className="w-full rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed"
              >
                {authLoading
                  ? "Yükleniyor..."
                  : authMode === "login"
                  ? "Giriş Yap"
                  : "Kayıt Ol"}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400">
                <span>
                  {authMode === "login"
                    ? "Hesabın yok mu?"
                    : "Zaten hesabın var mı?"}
                </span>
                <button
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login");
                    setAuthError(null);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  {authMode === "login" ? "Kayıt ol" : "Giriş yap"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
