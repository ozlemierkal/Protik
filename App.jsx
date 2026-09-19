import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import foods from './foods.json'



let barcodeLibraryPromise = null

function loadBarcodeLibrary() {
  if (window.Html5Qrcode) return Promise.resolve(window.Html5Qrcode)
  if (barcodeLibraryPromise) return barcodeLibraryPromise

  barcodeLibraryPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-protik-barcode]')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Html5Qrcode), { once: true })
      existing.addEventListener('error', () => reject(new Error('Barkod kütüphanesi yüklenemedi.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    script.async = true
    script.dataset.protikBarcode = 'true'
    script.onload = () => resolve(window.Html5Qrcode)
    script.onerror = () => reject(new Error('Barkod kütüphanesi yüklenemedi.'))
    document.head.appendChild(script)
  })

  return barcodeLibraryPromise
}

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem('protik_profile')) || null
  } catch {
    return null
  }
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem('protik_entries')) || []
  } catch {
    return []
  }
}

function loadCustomFoods() {
  try {
    return JSON.parse(localStorage.getItem('protik_custom_foods')) || []
  } catch {
    return []
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}


function useScreenTop() {
  const topRef = useRef(null)

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    const reset = () => {
      if (topRef.current) {
        topRef.current.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' })
        topRef.current.scrollTop = 0
      }
      window.scrollTo(0, 0)
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    reset()
    const frame = requestAnimationFrame(reset)
    const timer = window.setTimeout(reset, 60)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])

  return topRef
}

function App() {
  const [profile, setProfile] = useState(loadProfile)
  const [entries, setEntries] = useState(loadEntries)
  const [customFoods, setCustomFoods] = useState(loadCustomFoods)
  const [screen, setScreen] = useState(profile ? 'home' : 'onboarding')
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)

  useEffect(() => {
    // Ana ekran / Geçmiş / Profil / detay ekranları arasında geçerken
    // önceki ekranın scroll konumu yeni ekrana taşınmasın.
    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0
      document.body.scrollTop = 0
      document.documentElement.scrollTop = 0
    }

    resetScroll()
    const frame = requestAnimationFrame(resetScroll)
    return () => cancelAnimationFrame(frame)
  }, [screen, selectedMeal, selectedHistoryDate])

  const todayKey = localDateKey()
  const todayEntries = entries.filter((e) => e.date === todayKey)
  const totalProtein = todayEntries.reduce((sum, e) => sum + Number(e.protein || 0), 0)

  const target = profile?.proteinTarget || 90
  const remaining = Math.max(target - totalProtein, 0)
  const allFoods = useMemo(() => [...foods, ...customFoods], [customFoods])

  const recentFoods = useMemo(() => {
    const seen = new Set()
    const sorted = [...entries].sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
    const result = []

    for (const entry of sorted) {
      const key = entry.foodId || entry.name
      if (!key || seen.has(key)) continue

      const food = allFoods.find((item) =>
        item.food_id === entry.foodId ||
        item.name?.toLocaleLowerCase('tr') === entry.name?.toLocaleLowerCase('tr')
      )

      if (!food) continue
      seen.add(key)
      result.push({
        ...food,
        recent_amount: Number(entry.amount || food.default_portion || 0),
        recent_unit: entry.unit || food.default_unit || 'g',
      })
      if (result.length === 5) break
    }

    return result
  }, [entries, allFoods])

  const recommendations = useMemo(() => {
    if (remaining <= 0) return []
    return buildCompletionPlans(allFoods, remaining)
  }, [remaining, allFoods])

  function finishOnboarding(nextProfile) {
    save('protik_profile', nextProfile)
    setProfile(nextProfile)
    setScreen('home')
  }

  function addEntry(entry) {
    const next = [...entries, { ...entry, id: Date.now(), date: localDateKey() }]
    save('protik_entries', next)
    setEntries(next)
    setScreen(selectedMeal ? 'meal' : 'home')
  }

  function updateEntry(updated) {
    const next = entries.map((entry) =>
      entry.id === updated.id ? { ...updated } : entry
    )
    save('protik_entries', next)
    setEntries(next)
    setEditingEntry(null)
    setScreen('meal')
  }

  function deleteEntry(id) {
    const next = entries.filter((entry) => entry.id !== id)
    save('protik_entries', next)
    setEntries(next)
  }

  function saveCustomFood(food) {
    const nextFood = {
      ...food,
      food_id: food.food_id || `custom-${Date.now()}`,
      is_custom: true,
      aliases: food.aliases || [food.name],
    }

    const next = [
      ...customFoods.filter((item) => item.name.toLocaleLowerCase('tr') !== nextFood.name.toLocaleLowerCase('tr')),
      nextFood,
    ]

    save('protik_custom_foods', next)
    setCustomFoods(next)
    return nextFood
  }

  if (screen === 'onboarding') {
    return (
      <Onboarding
        onFinish={finishOnboarding}
        initialProfile={profile}
        onExit={profile ? () => setScreen('profile') : null}
      />
    )
  }

  if (screen === 'edit' && editingEntry) {
    return (
      <AddProtein
        foods={allFoods}
        onBack={() => {
          setEditingEntry(null)
          setScreen('meal')
        }}
        onSave={updateEntry}
        onSaveCustomFood={saveCustomFood}
        editingEntry={editingEntry}
      />
    )
  }

  if (screen === 'meal' && selectedMeal) {
    return (
      <MealDetails
        meal={selectedMeal}
        entries={todayEntries.filter((entry) => entry.meal === selectedMeal)}
        foods={allFoods}
        recentFoods={recentFoods}
        onBack={() => setScreen('home')}
        onDelete={deleteEntry}
        onSave={addEntry}
        onSaveCustomFood={saveCustomFood}
        onHome={() => setScreen('home')}
        onHistory={() => setScreen('history')}
        onProfile={() => setScreen('profile')}
        onEdit={(entry) => {
          setEditingEntry(entry)
          setScreen('edit')
        }}
      />
    )
  }

  if (screen === 'history') {
    return (
      <History
        entries={entries}
        target={target}
        onBackHome={() => setScreen('home')}
        onOpenDay={(date) => {
          setSelectedHistoryDate(date)
          setScreen('history-day')
        }}
        onProfile={() => setScreen('profile')}
      />
    )
  }

  if (screen === 'history-day' && selectedHistoryDate) {
    return (
      <HistoryDay
        date={selectedHistoryDate}
        entries={entries}
        target={target}
        onBack={() => setScreen('history')}
      />
    )
  }

  if (screen === 'privacy') {
    return <PrivacyPolicy onBack={() => setScreen('profile')} />
  }

  if (screen === 'profile') {
    return (
      <Profile
        profile={profile}
        onBack={() => setScreen('home')}
        onHome={() => setScreen('home')}
        onHistory={() => setScreen('history')}
        onPrivacy={() => setScreen('privacy')}
        onSave={(next) => {
          save('protik_profile', next)
          setProfile(next)
          setScreen('home')
        }}
      />
    )
  }

  return (
    <Home
      target={target}
      total={totalProtein}
      remaining={remaining}
      recommendations={recommendations}
      todayEntries={todayEntries}
      onProfile={() => setScreen('profile')}
      onHistory={() => setScreen('history')}
      onMeal={(meal) => {
        setSelectedMeal(meal)
        setScreen('meal')
      }}
    />
  )
}

function Logo() {
  return (
    <div className="brand">
      <div className="logoMark">✓</div>
      <div>
        <div className="brandName">Protik</div>
        <div className="brandSub">Günlük Protein Asistanın</div>
      </div>
    </div>
  )
}

function UiIcon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  const paths = {
    home: <><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.7V21h13V9.7"/><path d="M9.3 21v-6.2h5.4V21"/></>,
    history: <><path d="M4 20V11"/><path d="M9.4 20V5"/><path d="M14.8 20v-8"/><path d="M20.2 20V8"/></>,
    profile: <><circle cx="12" cy="7.5" r="3.5"/><path d="M4.8 20.5c.8-4.5 3.3-6.8 7.2-6.8s6.4 2.3 7.2 6.8"/></>,
    settings: <><circle cx="12" cy="12" r="3.1"/><path d="M19.3 14.8a1.8 1.8 0 0 0 .3 2l.1.1-2.8 2.8-.1-.1a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1 1.6v.2H10v-.2a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .3l-.1.1-2.8-2.8.1-.1a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.6-1H2.7V10h.2a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.3-2l-.1-.1 2.8-2.8.1.1a1.8 1.8 0 0 0 2 .3 1.8 1.8 0 0 0 1-1.6v-.2h3.8v.2a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.3l.1-.1 2.8 2.8-.1.1a1.8 1.8 0 0 0-.3 2 1.8 1.8 0 0 0 1.6 1h.2v3.8h-.2a1.8 1.8 0 0 0-1.6 1Z"/></>,
    bulb: <><path d="M8.3 14.8a6 6 0 1 1 7.4 0c-1 .8-1.5 1.6-1.6 2.5H9.9c-.1-.9-.6-1.7-1.6-2.5Z" strokeWidth="2.8"/><path d="M9.5 18.4h5M10.4 21h3.2" strokeWidth="2.8"/><circle cx="12" cy="8.5" r="1.4" fill="currentColor" stroke="none"/></>,
    breakfast: <><circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/><path d="M12 1.7v2.8M12 19.5v2.8M1.7 12h2.8M19.5 12h2.8M4.6 4.6l2 2M17.4 17.4l2 2M19.4 4.6l-2 2M6.6 17.4l-2 2" strokeWidth="2.6"/></>,
    lunch: <><path d="M4.5 2.5v7.2M8.1 2.5v7.2M4.5 6.2h3.6M6.3 9.7V21" strokeWidth="2.9"/><path d="M14.8 3v18" strokeWidth="3.2"/><path d="M19.4 3c0 4.1-1.5 6.5-4.6 7.2" strokeWidth="2.9"/></>,
    snack: <><path d="M6.2 7.2h9.6v10.9a2.3 2.3 0 0 1-2.3 2.3H8.5a2.3 2.3 0 0 1-2.3-2.3V7.2Z" fill="currentColor" stroke="none"/><path d="M15.8 9.8h1.6a3.1 3.1 0 0 1 0 6.2h-1.6" strokeWidth="2.8"/><path d="M8.2 4.6h5.6" strokeWidth="2.8"/></>,
    dinner: <path d="M15.8 3.3a8.2 8.2 0 1 0 5 14.5 7.7 7.7 0 0 1-5-14.5Z" fill="currentColor" stroke="none"/>,
    gender: <><circle cx="12" cy="9" r="4.3" strokeWidth="2.8"/><path d="M12 13.5V22M8.8 18.3h6.4" strokeWidth="2.8"/></>,
    weight: <><rect x="3.7" y="4.5" width="16.6" height="15.8" rx="3.2" strokeWidth="2.8"/><path d="M8.4 10a3.6 3.6 0 0 1 7.2 0M12 10l2.6-1.5" strokeWidth="2.8"/></>,
    height: <><path d="M8 2.8h8M8 21.2h8M12 3v18" strokeWidth="2.8"/><path d="m8.8 6.2 3.2-3.2 3.2 3.2M8.8 17.8 12 21l3.2-3.2" strokeWidth="2.8"/></>,
    goal: <><circle cx="12" cy="12" r="8.2" strokeWidth="2.7"/><circle cx="12" cy="12" r="4.2" strokeWidth="2.7"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/></>,
    activity: <><circle cx="12.4" cy="4" r="2.2" fill="currentColor" stroke="none"/><path d="m10.4 9.1 3-2 2.1 4.1 3 1.8M11.2 10.4 8.8 15l-3 2.3M13.4 12l1.1 5.8 3 3.2" strokeWidth="2.9"/></>,
    age: <><circle cx="12" cy="7.8" r="3.1" fill="currentColor" stroke="none"/><path d="M7 21v-2.3a5 5 0 0 1 10 0V21" strokeWidth="2.8"/></>,
    trophy: <><path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6"/></>,
    chart: <><path d="M4 20V11M10 20V6M16 20v-9M22 20V3"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    back: <path d="m15 18-6-6 6-6"/>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
  }

  return <svg {...common}>{paths[name] || paths.chevron}</svg>
}

function BottomNav({ active = 'home', onHome, onHistory, onProfile }) {
  return (
    <nav className="bottomNav proNav">
      <button className={active === 'home' ? 'active' : ''} onClick={onHome}>
        <UiIcon name="home" size={21} />
        <span>Ana Sayfa</span>
      </button>
      <button className={active === 'history' ? 'active' : ''} onClick={onHistory}>
        <UiIcon name="history" size={21} />
        <span>Geçmiş</span>
      </button>
      <button className={active === 'profile' ? 'active' : ''} onClick={onProfile}>
        <UiIcon name="profile" size={21} />
        <span>Profil</span>
      </button>
    </nav>
  )
}

function mealIconName(meal) {
  if (meal === 'Kahvaltı') return 'breakfast'
  if (meal === 'Öğle Yemeği') return 'lunch'
  if (meal === 'Ara Öğün') return 'snack'
  return 'dinner'
}



function TargetIllustration({ compact = false }) {
  return (
    <div className={`targetIllustration ${compact ? 'compact' : ''}`} aria-hidden="true">
      {!compact && <span className="targetPercent">75%</span>}
      <svg viewBox="0 0 140 140" className="targetIllustrationSvg">
        <defs>
          <linearGradient id="targetOuter" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#b56cff"/>
            <stop offset="1" stopColor="#6c22c6"/>
          </linearGradient>
          <linearGradient id="targetArrow" x1="0" x2="1">
            <stop offset="0" stopColor="#ffc23c"/>
            <stop offset="1" stopColor="#ff9700"/>
          </linearGradient>
          <filter id="targetShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#6e2bb7" floodOpacity=".18"/>
          </filter>
        </defs>
        <g filter="url(#targetShadow)">
          <circle cx="58" cy="78" r="43" fill="#f3e8ff" stroke="#fff" strokeWidth="5"/>
          <circle cx="58" cy="78" r="34" fill="url(#targetOuter)"/>
          <circle cx="58" cy="78" r="24" fill="#f6ecff"/>
          <circle cx="58" cy="78" r="14" fill="#7a2ec4"/>
          <circle cx="58" cy="78" r="5.5" fill="#5c149f"/>
        </g>
        <path d="M62 73 101 34" stroke="url(#targetArrow)" strokeWidth="9" strokeLinecap="round"/>
        <path d="M98 38 100 19 113 32 98 38Z" fill="#ffc33b"/>
        <path d="M101 34 120 32 107 19 101 34Z" fill="#f59a00"/>
        {!compact && <><path d="M10 73h10" stroke="#a66bf0" strokeWidth="5" strokeLinecap="round"/><path d="M15 55l9 4" stroke="#c59af5" strokeWidth="5" strokeLinecap="round"/></>}
      </svg>
    </div>
  )
}

function AddIllustration() {
  return (
    <div className="addIllustration" aria-hidden="true">
      <span className="addIllustrationPlus">+</span>
      <div className="addIllustrationSheet">
        <span><b>🍗</b><em>Tavuk</em><strong>24 g</strong></span>
        <span><b>🥣</b><em>Yoğurt</em><strong>10 g</strong></span>
      </div>
    </div>
  )
}

function IdeaIllustration() {
  return (
    <div className="ideaIllustration" aria-hidden="true">
      <div className="ideaBulb">💡</div>
      <div className="ideaBubble">Bugün 20 g<br/>daha alabilirsin</div>
      <div className="ideaFoods"><span>🥛</span><span>🥚</span><span>🥜</span></div>
    </div>
  )
}

function Onboarding({ onFinish, initialProfile = null, onExit = null }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: initialProfile?.name || '',
    age: initialProfile?.age || '',
    gender: initialProfile?.gender || '',
    height: initialProfile?.height || '',
    weight: initialProfile?.weight || '',
    activity: '',
    goal: '',
  })
  const [manualTarget, setManualTarget] = useState(null)
  const onboardingPanelRef = useRef(null)

  useEffect(() => {
    // Her onboarding adımı kendi başlangıcından açılsın.
    if (onboardingPanelRef.current) {
      onboardingPanelRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [step])

  const weightNumber = Number(form.weight)
  const multiplier = getProteinMultiplier(form.activity, form.goal)
  const suggested = weightNumber > 0 && multiplier > 0
    ? Math.max(40, Math.round((weightNumber * multiplier) / 5) * 5)
    : 40
  const target = manualTarget ?? suggested

  function updateForm(patch, resetTarget = false) {
    setForm((current) => ({ ...current, ...patch }))
    if (resetTarget) setManualTarget(null)
  }

  const activityOptions = [
    { value: 'Düşük', icon: '○', title: 'Düşük', description: 'Çoğunlukla masa başı veya az hareketli bir gün.' },
    { value: 'Orta', icon: '◐', title: 'Orta', description: 'Haftada 1–3 gün egzersiz veya düzenli yürüyüş.' },
    { value: 'Yüksek', icon: '●', title: 'Yüksek', description: 'Haftada 4+ gün düzenli egzersiz veya yoğun hareket.' },
  ]

  const goalOptions = [
    { value: 'Genel sağlık', icon: '♡', title: 'Genel sağlık', description: 'Günlük proteinini daha dengeli tutmak istiyorum.' },
    { value: 'Kilo verme sürecinde', icon: '◎', title: 'Kilo verme sürecinde', description: 'Kilo verirken kas kaybını azaltmak istiyorum.' },
    { value: 'Kas koruma / geliştirme', icon: '▲', title: 'Kas koruma / geliştirme', description: 'Kas kütlemi korumak veya artırmak istiyorum.' },
  ]

  const canContinue =
    step === 0 ? true
      : step === 1 ? isBasicsValid(form)
        : step === 2 ? Boolean(form.activity)
          : step === 3 ? Boolean(form.goal)
            : true

  function goNext() {
    if (!canContinue) return
    if (step < 4) setStep(step + 1)
  }

  function complete() {
    if (!isBasicsValid(form) || !form.activity || !form.goal) return
    onFinish({
      name: form.name.trim(),
      age: Number(form.age),
      gender: form.gender || 'Belirtmek istemiyorum',
      height: Number(form.height),
      weight: Number(form.weight),
      activity: form.activity,
      goal: form.goal,
      proteinTarget: target,
    })
  }

  return (
    <main className="appShell onboarding modernOnboarding">
      <div className="onboardingTopline">
        <div className="topDots">{step + 1} / 5</div>
        {onExit && (
          <button type="button" className="onboardingClose" onClick={onExit}>Kapat</button>
        )}
      </div>

      <div className="panel" ref={onboardingPanelRef}>
        {step === 0 && (
          <section className="onboardingStep centered welcomeStep">
            <div className="welcomeArt">
              <div className="welcomeGlow"></div>
              <div className="welcomeLogoWrap"><Logo /></div>
            </div>
            <h1>Protein hedefini takip et.</h1>
            <p>
              Eksik kalan proteini nasıl tamamlayacağını da
              <strong> Protik </strong>
              sana önersin.
            </p>
            <div className="welcomeFeatureStack">
              <div className="welcomeFeatureCard">
                <div className="welcomeFeatureVisual targetVisual">
                  <TargetIllustration />
                </div>
                <div>
                  <strong>Hedefini gör</strong>
                  <span>Günlük protein hedefini anında gör, ilerlemeni kolayca takip et.</span>
                </div>
              </div>
              <div className="welcomeFeatureCard">
                <div className="welcomeFeatureVisual addVisual">
                  <AddIllustration />
                </div>
                <div>
                  <strong>Kolayca ekle</strong>
                  <span>Yediklerini saniyeler içinde ekle, protein hesabın otomatik güncellensin.</span>
                </div>
              </div>
              <div className="welcomeFeatureCard">
                <div className="welcomeFeatureVisual ideaVisual">
                  <IdeaIllustration />
                </div>
                <div>
                  <strong>Eksik kalanı tamamla</strong>
                  <span>Hedefine ulaşman için sana özel, pratik öneriler sunsun.</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="onboardingStep">
            <div className="stepIntro centered">
              <h2>Seni biraz tanıyalım</h2>
              <p className="muted">
                Protein hedefini sana daha uygun önerebilmemiz için birkaç bilgiye ihtiyacımız var.
              </p>
            </div>
            <div className="formCard warmCard">
              <Field label="Sana nasıl hitap edelim?">
                <input
                  type="text"
                  placeholder="Örn. Özlem"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Yaşın">
                <input
                  type="number"
                  placeholder="Örn. 35"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                />
              </Field>
              <Field label="Cinsiyetin">
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">Seç</option>
                  <option value="Kadın">Kadın</option>
                  <option value="Erkek">Erkek</option>
                  <option value="Belirtmek istemiyorum">Belirtmek istemiyorum</option>
                </select>
              </Field>
              <Field label="Boyun (cm)">
                <input
                  type="number"
                  placeholder="Örn. 165"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                />
              </Field>
              <Field label="Kilon (kg)">
                <input
                  type="number"
                  placeholder="Örn. 65"
                  value={form.weight}
                  onChange={(e) => updateForm({ weight: e.target.value }, true)}
                />
              </Field>
            </div>
            {!isBasicsValid(form) && (
              <div className="helperText">Devam etmek için yaşını, boyunu ve kilonu gir.</div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="onboardingStep centered choiceStep">
            <div className="stepIntro centered">
              <h2>Günlük hareketin nasıl?</h2>
              <p className="muted">Sana daha uygun bir protein hedefi önermemize yardımcı olur.</p>
            </div>
            <ChoiceGroup
              value={form.activity}
              onChange={(value) => updateForm({ activity: value }, true)}
              options={activityOptions}
            />
          </section>
        )}

        {step === 3 && (
          <section className="onboardingStep centered choiceStep">
            <div className="stepIntro centered">
              <h2>Hedefin ne?</h2>
              <p className="muted">Protein hedefini buna göre ayarlayacağız.</p>
            </div>
            <ChoiceGroup
              value={form.goal}
              onChange={(value) => updateForm({ goal: value }, true)}
              options={goalOptions}
            />
          </section>
        )}

        {step === 4 && (
          <section className="onboardingStep centered targetStep warmTargetStep">
            <div className="targetWarmIcon" aria-hidden="true">
              <TargetIllustration compact />
            </div>
            <div className="stepIntro centered narrow">
              <h2>Önerilen başlangıç hedefin</h2>
              <p className="muted">Kilon, hareket düzeyin ve hedefine göre hesaplandı.</p>
            </div>
            <div className="targetSummaryCard warmCard">
              <div className="targetPreviewCircle">
                <div className="targetPreviewContent">
                  <span>{target}</span>
                  <small>g / gün</small>
                </div>
              </div>
              <p className="muted">İstersen şimdi değiştirebilirsin.</p>
              <input
                className="range"
                type="range"
                min="40"
                max="200"
                step="5"
                value={target}
                onChange={(e) => setManualTarget(Number(e.target.value))}
              />
              <div className="targetMetaRow">
                <span>{form.weight} kg</span>
                <span>{form.activity}</span>
                <span>{form.goal}</span>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="onboardingActions">
        {step > 0 && (
          <button className="ghost" onClick={() => setStep((current) => Math.max(0, current - 1))}>
            Geri
          </button>
        )}
        {step < 4 ? (
          <button className="primary" disabled={!canContinue} onClick={goNext}>
            Devam
          </button>
        ) : (
          <button className="primary" onClick={complete}>
            Protik’i kullanmaya başla
          </button>
        )}
      </div>
    </main>
  )
}


function formatLongDateTR(date = new Date()) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date)
}

function Home({ target, total, remaining, recommendations, todayEntries, onProfile, onHistory, onMeal }) {
  const screenTopRef = useScreenTop()
  const pct = Math.min(Math.round((total / target) * 100), 100)
  const [activePlan, setActivePlan] = useState(0)
  const [showPlans, setShowPlans] = useState(false)
  const selectedPlan = recommendations[activePlan] || recommendations[0]
  const statusText = remaining <= 0
    ? 'Hedef tamamlandı!'
    : pct >= 85
      ? 'Hedefine çok yakınsın!'
      : pct >= 55
        ? 'Harika gidiyorsun!'
        : 'Bugün iyi bir başlangıç yap.'
  const dateLabel = formatLongDateTR(new Date())

  return (
    <main className="appShell themedShell modernHomeShell" ref={screenTopRef}>
      <section className="homeHeroPanel">
        <header className="topbar proTopbar homeTopbarDark">
          <Logo />
          <button className="roundIconButton heroActionButton" onClick={onProfile} aria-label="Profil ve ayarlar">
            <UiIcon name="settings" size={20} />
          </button>
        </header>

        <div className="heroDate">{dateLabel}</div>

        <div className="homeDashboard">
          <div className="heroRingPanel">
            <div className="ring proRing modernHeroRing" style={{ '--pct': `${pct * 3.6}deg` }}>
              <span>%{pct}</span>
            </div>
            <div className="heroRingCopy">
              <div className="heroRingValue">{Math.round(total)} g</div>
              <div className="heroRingTarget">/ {target} g</div>
            </div>
          </div>

          <div className="heroInsightStack">
            <div className="heroInsightCard encouragementCard">
              <div className="insightIcon">🌱</div>
              <div>
                <strong>{statusText}</strong>
                <span>Bugünkü ilerleyişini takip etmeye devam et.</span>
              </div>
            </div>

            <div className="heroInsightCard remainingCard">
              <span className="insightLabel">Kalan</span>
              <strong>{remaining > 0 ? `${Math.round(remaining)} g` : '0 g'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section warmSection homeMealsSection">
        <div className="sectionTitle sectionTitleSpaced">
          <h2>Bugünkü öğünlerin</h2>
          <span>Öğüne dokun ve kayıt ekle</span>
        </div>
        <div className="mealSummaryList proMealList">
          {['Kahvaltı', 'Öğle Yemeği', 'Ara Öğün', 'Akşam Yemeği'].map((meal) => {
            const mealEntries = todayEntries.filter((e) => e.meal === meal)
            const sum = mealEntries.reduce((s, e) => s + Number(e.protein), 0)

            return (
              <button className="mealSummaryCard proMealCard" key={meal} onClick={() => onMeal(meal)}>
                <div className={`mealGlyph ${mealIconName(meal)}`}>
                  <UiIcon name={mealIconName(meal)} size={25} />
                </div>

                <div className="mealCardBody">
                  <div className="mealSummaryTop">
                    <strong>{meal}</strong>
                    <div className="mealSummaryRight">
                      {sum > 0 ? (
                        <>
                          <b>{sum.toFixed(1)} g</b>
                          <span className="mealActionPill">Aç</span>
                        </>
                      ) : (
                        <span className="mealAddPrompt">
                          <UiIcon name="plus" size={13} /> Ekle
                        </span>
                      )}
                    </div>
                  </div>

                  {mealEntries.length > 0 ? (
                    <div className="mealFoods compactMealFoods">
                      <span>{mealEntries.slice(0, 2).map((e) => e.name).join(', ')}</span>
                      {mealEntries.length > 2 && <small> +{mealEntries.length - 2}</small>}
                    </div>
                  ) : (
                    <div className="mealEmptyText">Henüz eklenmedi</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className={`section proRecommendation modernRecommendation ${showPlans ? 'open' : ''}`}>
        <button
          type="button"
          className="recommendationToggle"
          onClick={() => setShowPlans((value) => !value)}
        >
          <div className="recommendationIcon">
            <UiIcon name="bulb" size={28} />
          </div>
          <div className="recommendationToggleCopy">
            <strong>Kalan proteinini nasıl tamamlayabilirsin?</strong>
            <span>
              {remaining > 0
                ? `${Math.round(remaining)} g kaldı. Sana uygun birkaç seçenek.`
                : 'Bugünkü hedefini tamamladın.'}
            </span>
          </div>
          <span className={`toggleChevron ${showPlans ? 'rotated' : ''}`}>
            <UiIcon name="chevron" size={18} />
          </span>
        </button>

        {showPlans && (
          <div className="recommendationBody">
            {remaining > 0 && recommendations.length > 0 ? (
              <>
                <div className="planTabs proPlanTabs">
                  {recommendations.map((plan, index) => (
                    <button
                      key={plan.id}
                      type="button"
                      className={activePlan === index ? 'planTab selected' : 'planTab'}
                      onClick={() => setActivePlan(index)}
                    >
                      {plan.title.replace(' seçenek', '')}
                    </button>
                  ))}
                </div>

                {selectedPlan && (
                  <div className="planCard featuredPlan proPlanCard">
                    <div className="planTop">
                      <div>
                        <strong>{selectedPlan.title}</strong>
                        <span>{selectedPlan.subtitle}</span>
                      </div>
                      <b>≈ {selectedPlan.total.toFixed(1)} g</b>
                    </div>
                    <div className="planFoods">
                      {selectedPlan.items.map((item) => (
                        <div className="planFoodRow" key={`${selectedPlan.id}-${item.food_id}`}>
                          <span>{item.label}</span>
                          <small>{item.protein.toFixed(1)} g</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="successBox proSuccessBox">Bugünkü hedefini tamamladın. 🎉</div>
            )}
          </div>
        )}
      </section>

      <BottomNav
        active="home"
        onHome={() => {}}
        onHistory={onHistory}
        onProfile={onProfile}
      />
    </main>
  )
}

function dateKeyOffset(daysAgo) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return localDateKey(date)
}

function formatHistoryDate(dateKey, withYear = false) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(date)
}

function History({ entries, target, onBackHome, onOpenDay, onProfile }) {
  const screenTopRef = useScreenTop()
  const today = dateKeyOffset(0)
  const historyEntries = entries.filter((entry) => entry.date <= today)

  // Bugün + önceki 6 gün.
  const days = Array.from({ length: 7 }, (_, index) => dateKeyOffset(index))
  const chartDays = [...days].reverse()

  const totalsByDay = days.map((date) => {
    const dayEntries = historyEntries.filter((entry) => entry.date === date)
    const total = dayEntries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)
    return { date, dayEntries, total }
  })

  const recordedDays = totalsByDay.filter((item) => item.dayEntries.length > 0)
  const average = recordedDays.length
    ? recordedDays.reduce((sum, item) => sum + item.total, 0) / recordedDays.length
    : 0
  const averagePct = target > 0 ? Math.round((average / target) * 100) : 0
  const completedDays = totalsByDay.filter((item) => item.total >= target && item.dayEntries.length > 0).length

  const chartValues = chartDays.map((date) => {
    const found = totalsByDay.find((item) => item.date === date)
    return { date, total: found?.total || 0 }
  })
  const chartMax = Math.max(target, ...chartValues.map((item) => item.total), 1)

  const weekdayShort = (dateKey) => {
    const [year, month, day] = dateKey.split('-').map(Number)
    return new Intl.DateTimeFormat('tr-TR', { weekday: 'short' })
      .format(new Date(year, month - 1, day, 12))
      .replace('.', '')
  }

  const statusFor = (total, hasEntries) => {
    if (!hasEntries) return { text: 'Kayıt yok', className: 'historyStatus neutral' }
    const pct = target > 0 ? Math.round((total / target) * 100) : 0
    if (total >= target) return { text: 'Hedef tamam', className: 'historyStatus done' }
    if (pct >= 90) return { text: 'Hedefe yakın', className: 'historyStatus close' }
    if (pct >= 60) return { text: 'Biraz daha var', className: 'historyStatus more' }
    return { text: 'Eksik kaldı', className: 'historyStatus low' }
  }

  const firstDate = chartDays[0]
  const lastDate = chartDays[chartDays.length - 1]

  return (
    <main className="appShell historyShell" ref={screenTopRef}>
      <header className="screenHeader historyHeader">
        <button className="back" onClick={onBackHome}>‹</button>
        <h1>Geçmiş</h1>
        <span />
      </header>

      <div className="historyIntro historyIntroCompact">
        <p>Son 7 günün protein özeti.</p>
      </div>

      <section className="card weeklySummaryCard">
        <div className="weeklySummaryHeader">
          <h2>Haftalık özet</h2>
          <span>{formatHistoryDate(firstDate)} – {formatHistoryDate(lastDate)}</span>
        </div>

        <div className="weeklySummaryGrid">
          <div className="summaryMetric">
            <div className="summaryMetricIcon"><UiIcon name="chart" size={24} /></div>
            <div>
              <span>Günlük ortalama</span>
              <strong>{average.toFixed(0)} g <small>/ {target} g</small></strong>
              <p>Hedefinin %{averagePct}'ini karşıladın.</p>
            </div>
          </div>

          <div className="summaryMetric summaryMetricRight">
            <div className="summaryMetricIcon trophy"><UiIcon name="trophy" size={24} /></div>
            <div>
              <span>Hedef tamamlanan gün</span>
              <strong>{completedDays} <small>/ 7 gün</small></strong>
              <p>{completedDays >= 4 ? 'Harika gidiyorsun!' : 'Devam ettikçe artacak.'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="historySectionHeading">
        <h2>Son günlerin</h2>
      </div>


      <section className="historyList historyListRich">
        {totalsByDay.map(({ date, dayEntries, total }) => {
          const pct = target > 0 ? Math.round((total / target) * 100) : 0
          const clampedPct = Math.min(pct, 100)
          const status = statusFor(total, dayEntries.length > 0)

          return (
            <button
              key={date}
              className="historyDayCard richHistoryDay"
              onClick={() => onOpenDay(date)}
              disabled={dayEntries.length === 0}
            >
              <div className="historyRichDate">
                <strong>
                  {date === today ? 'Bugün' : date === dateKeyOffset(1) ? 'Dün' : formatHistoryDate(date)}
                </strong>
                <span>{formatHistoryDate(date, true)}</span>
              </div>

              <div className="historyRichMiddle">
                <div className="historyProteinLine">
                  <b>{total.toFixed(0)} <small>/ {target} g</small></b>
                  <span>%{pct}</span>
                </div>
                <div className="historyProgressTrack">
                  <div className="historyProgressFill" style={{ width: `${clampedPct}%` }} />
                </div>
              </div>

              <div className={status.className}>
                {status.text}
              </div>

              <span className="historyRowChevron">›</span>
            </button>
          )
        })}
      </section>

      <section className="card weeklyChartCard">
        <div className="weeklyChartHeader">
          <div>
            <h2>Haftalık protein grafiği</h2>
            <p>Günlük protein miktarın. Hedefin {target} g.</p>
          </div>
          <div className="chartLegend">
            <span><i className="legendDot" /> Alınan protein</span>
            <span><i className="legendLine" /> Hedef ({target} g)</span>
          </div>
        </div>

        <div className="weeklyChart">
          <div
            className="chartTargetLine"
            style={{ bottom: `${Math.min((target / chartMax) * 100, 100)}%` }}
          />
          {chartValues.map((item) => {
            const height = item.total > 0 ? Math.max((item.total / chartMax) * 100, 4) : 0
            return (
              <div className="chartColumn" key={item.date}>
                <div className="chartBarArea">
                  <div className={`chartBarWrap ${item.total <= 0 ? 'zeroBar' : ''}`} style={{ height: `${height}%` }}>
                    <span className="chartValue">{item.total.toFixed(0)} g</span>
                    <div className="chartBar" />
                  </div>
                </div>
                <span className="chartDay">{weekdayShort(item.date)}</span>
              </div>
            )
          })}
        </div>
      </section>

      <BottomNav
        active="history"
        onHome={onBackHome}
        onHistory={() => {}}
        onProfile={onProfile}
      />
    </main>
  )
}

function HistoryDay({ date, entries, target, onBack }) {
  const screenTopRef = useScreenTop()
  const dayEntries = entries.filter((entry) => entry.date === date)

  const total = dayEntries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)
  const pct = target > 0 ? Math.min(Math.round((total / target) * 100), 100) : 0

  return (
    <main className="appShell historyDayShell" ref={screenTopRef}>
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>{date === dateKeyOffset(1) ? 'Dün' : formatHistoryDate(date)}</h1>
        <span />
      </header>

      <section className="card historyDaySummary">
        <span>Toplam protein</span>
        <strong>{total.toFixed(1)} <small>/ {target} g</small></strong>
        <div className="historyDayPercent">%{pct}</div>
      </section>

      <section className="historyMealGroups">
        {['Kahvaltı', 'Öğle Yemeği', 'Ara Öğün', 'Akşam Yemeği'].map((meal) => {
          const mealEntries = dayEntries.filter((entry) => entry.meal === meal)
          if (mealEntries.length === 0) return null
          const mealTotal = mealEntries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)

          return (
            <div className="card historyMealCard" key={meal}>
              <div className="historyMealTitle">
                <strong>{meal}</strong>
                <b>{mealTotal.toFixed(1)} g</b>
              </div>
              {mealEntries.map((entry) => (
                <div className="historyFoodRow" key={entry.id}>
                  <span>{entry.name}</span>
                  <small>{entry.amount} {entry.unit} · {Number(entry.protein).toFixed(1)} g</small>
                </div>
              ))}
            </div>
          )
        })}
      </section>

    </main>
  )
}


function AddProtein({ foods, onBack, onSave, onSaveCustomFood, editingEntry = null, presetMeal = '' }) {
  const screenTopRef = useScreenTop()
  const initialFood = editingEntry
    ? foods.find((f) => f.food_id === editingEntry.foodId) || null
    : null

  const [query, setQuery] = useState(initialFood?.name || '')
  const [selected, setSelected] = useState(initialFood)
  const [amount, setAmount] = useState(editingEntry?.amount || initialFood?.default_portion || '')
  const [meal, setMeal] = useState(editingEntry?.meal || presetMeal || '')
  const [showResults, setShowResults] = useState(false)
  const [showProteinEditor, setShowProteinEditor] = useState(false)
  const [customProteinPerBase, setCustomProteinPerBase] = useState(
    editingEntry?.proteinPerBase ?? initialFood?.protein_per_base ?? ''
  )
  const [customProductName, setCustomProductName] = useState(initialFood?.is_custom ? initialFood.name : '')

  const filtered = foods.filter((f) =>
    f.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) ||
    (f.aliases || []).some((a) => a.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))
  ).slice(0, 10)

  function handleQueryChange(value) {
    setQuery(value)
    setShowResults(Boolean(value.trim()))
    if (!editingEntry || value !== initialFood?.name) {
      setSelected(null)
      setAmount('')
      setShowProteinEditor(false)
      setCustomProteinPerBase('')
      setCustomProductName('')
    }
  }

  function choose(f) {
    setSelected(f)
    setAmount(f.default_portion)
    setQuery(f.name)
    setShowResults(false)
    setShowProteinEditor(false)
    setCustomProteinPerBase(f.protein_per_base)
    setCustomProductName(f.is_custom ? f.name : '')
  }

  const effectiveProteinPerBase = Number(customProteinPerBase || selected?.protein_per_base || 0)

  const protein = selected
    ? selected.base_unit === selected.default_unit
      ? (Number(amount || 0) / selected.base_amount) * effectiveProteinPerBase
      : selected.protein_per_default_portion * (
          Number(customProteinPerBase || selected.protein_per_base || 0) /
          Number(selected.protein_per_base || 1)
        )
    : 0

  function saveEntry() {
    if (!selected || Number(amount) <= 0 || !meal) return

    const entry = {
      foodId: selected.food_id,
      name: selected.name,
      amount: Number(amount),
      unit: selected.default_unit,
      protein,
      proteinPerBase: effectiveProteinPerBase,
      meal,
    }

    if (editingEntry) {
      onSave({ ...editingEntry, ...entry })
    } else {
      onSave(entry)
    }
  }

  function saveAsCustomProduct() {
    if (!selected || !customProductName.trim() || effectiveProteinPerBase <= 0) return

    const customFood = onSaveCustomFood({
      ...selected,
      food_id: `custom-${Date.now()}`,
      name: customProductName.trim(),
      protein_per_base: effectiveProteinPerBase,
      protein_per_default_portion:
        selected.base_unit === selected.default_unit
          ? (Number(selected.default_portion) / Number(selected.base_amount)) * effectiveProteinPerBase
          : Number(selected.protein_per_default_portion) * (
              effectiveProteinPerBase / Number(selected.protein_per_base || 1)
            ),
      icon_name: selected.icon_name || 'custom_food',
      is_custom: true,
      aliases: [customProductName.trim(), selected.name],
    })

    setSelected(customFood)
    setQuery(customFood.name)
    setCustomProductName(customFood.name)
    setShowProteinEditor(false)
  }

  const proteinValueChanged =
    selected && Math.abs(effectiveProteinPerBase - Number(selected.protein_per_base || 0)) > 0.01

  return (
    <main className="appShell detailShell" ref={screenTopRef}>
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>{editingEntry ? 'Kaydı Düzenle' : 'Protein Ekle'}</h1>
        <span />
      </header>

      {!presetMeal && !editingEntry && (
        <section className="mealChooser">
          <div className="mealChooserTitle">Hangi öğüne ekliyorsun?</div>
          <div className="mealChooserGrid">
            {['Kahvaltı', 'Öğle Yemeği', 'Ara Öğün', 'Akşam Yemeği'].map((option) => (
              <button
                key={option}
                type="button"
                className={meal === option ? 'mealChoice selected' : 'mealChoice'}
                onClick={() => setMeal(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>
      )}

      {presetMeal && !editingEntry && (
        <div className="presetMealBanner">
          <span>Öğün</span>
          <strong>{presetMeal}</strong>
        </div>
      )}

      <input
        className="search"
        placeholder="Yiyecek / içecek ara veya yaz..."
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => query && setShowResults(true)}
      />

      {showResults && query && (
        <div className="searchResults">
          {filtered.length > 0 ? (
            filtered.map((f) => (
              <button key={f.food_id} onClick={() => choose(f)}>
                <span className="searchFoodName">
                  {f.name}
                  {f.is_custom && <small>Benim ürünüm</small>}
                </span>
                <span>{Number(f.protein_per_default_portion).toFixed(1)} g</span>
              </button>
            ))
          ) : (
            <div className="emptySearch">Bu ürün henüz listede yok.</div>
          )}
        </div>
      )}

      {selected && !showResults && (
        <section className="card addCard">
          <div className="selectedFood">
            <div className="foodIcon big">{iconFor(selected.icon_name)}</div>
            <div><h2>{selected.name}</h2><p>{selected.category}</p></div>
          </div>

          <Field label={`Miktar (${selected.default_unit})`}>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <div className="proteinResult">
            <span>Protein</span>
            <b>{protein.toFixed(1)} g</b>
          </div>

          <button
            type="button"
            className="textAction"
            onClick={() => setShowProteinEditor((value) => !value)}
          >
            {showProteinEditor ? 'Protein değerini kapat' : 'Protein değerini değiştir'}
          </button>

          {showProteinEditor && (
            <div className="proteinEditor">
              <div className="proteinEditorTitle">
                Bu ürünün etiketindeki değeri girebilirsin.
              </div>

              <Field label={`${selected.base_amount} ${selected.base_unit} protein (g)`}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={customProteinPerBase}
                  onChange={(e) => setCustomProteinPerBase(e.target.value)}
                />
              </Field>

              <div className="proteinEditorHint">
                Standart değer: {selected.protein_per_base} g / {selected.base_amount} {selected.base_unit}
              </div>

              {proteinValueChanged && (
                <div className="customProductBox">
                  <input
                    className="customProductInput"
                    type="text"
                    placeholder="Örn. Benim yüksek proteinli yoğurdum"
                    value={customProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="secondaryButton"
                    disabled={!customProductName.trim() || effectiveProteinPerBase <= 0}
                    onClick={saveAsCustomProduct}
                  >
                    Bu ürünü kaydet
                  </button>
                </div>
              )}
            </div>
          )}

          {meal && (
            <div className="selectedMealNote">
              <span>Seçilen öğün</span>
              <strong>{meal}</strong>
            </div>
          )}

          <button
            className="primary wide"
            disabled={Number(amount) <= 0 || !meal}
            onClick={saveEntry}
          >
            {editingEntry ? 'Değişiklikleri Kaydet' : (meal ? addButtonLabel(meal) : 'Öğün Seç')}
          </button>
        </section>
      )}
    </main>
  )
}

function naturalPortionsFor(food) {
  if (!food) return []
  const name = String(food.name || '').toLocaleLowerCase('tr')
  const unit = String(food.default_unit || food.base_unit || 'g').toLocaleLowerCase('tr')

  const make = (label, amount) => ({ label, amount })

  if (/(yumurta|egg)/.test(name) && unit.includes('adet')) {
    return [make('1 adet', 1), make('2 adet', 2), make('3 adet', 3)]
  }

  if (/(süt|kefir|ayran)/.test(name) && unit.includes('ml')) {
    return [make('1 bardak · 200 ml', 200), make('1 büyük bardak · 250 ml', 250)]
  }

  if (/(yoğurt|yogurt)/.test(name) && (unit === 'g' || unit.includes('gram'))) {
    return [make('1 küçük kase · 150 g', 150), make('1 kase · 200 g', 200)]
  }

  if (/(peynir|kaşar|lor|cottage)/.test(name) && (unit === 'g' || unit.includes('gram'))) {
    return [make('1 dilim · 30 g', 30), make('2 dilim · 60 g', 60), make('50 g', 50)]
  }

  if (/(tavuk|hindi|somon|ton balığı|balık|et|köfte)/.test(name) && (unit === 'g' || unit.includes('gram'))) {
    return [make('100 g', 100), make('150 g', 150), make('200 g', 200)]
  }

  if (unit === 'g' || unit.includes('gram')) {
    return [make('50 g', 50), make('100 g', 100), make('150 g', 150)]
  }

  if (unit.includes('ml')) {
    return [make('200 ml', 200), make('250 ml', 250)]
  }

  return []
}

function MealDetails({ meal, entries, foods, recentFoods = [], onBack, onDelete, onEdit, onSave, onSaveCustomFood, onHome, onHistory, onProfile }) {
  const screenTopRef = useScreenTop()
  const total = entries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [showProteinEditor, setShowProteinEditor] = useState(false)
  const [customProteinPerBase, setCustomProteinPerBase] = useState('')
  const [customProductName, setCustomProductName] = useState('')
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [barcodeResult, setBarcodeResult] = useState('')
  const [barcodeStatus, setBarcodeStatus] = useState('')
  const [barcodeError, setBarcodeError] = useState('')
  const [barcodeProduct, setBarcodeProduct] = useState(null)
  const [barcodeAmount, setBarcodeAmount] = useState('')
  const [barcodeManualName, setBarcodeManualName] = useState('')
  const [barcodeManualProtein, setBarcodeManualProtein] = useState('')
  const barcodeScannerRef = useRef(null)

  async function lookupBarcode(code) {
    const normalized = String(code || '').trim()
    if (!normalized) return

    setBarcodeError('')
    setBarcodeProduct(null)
    setBarcodeManualName('')
    setBarcodeManualProtein('')
    setBarcodeAmount('')

    const localProduct = foods.find((food) => String(food.barcode || '') === normalized)
    if (localProduct) {
      setBarcodeProduct({
        code: normalized,
        name: localProduct.name,
        brand: localProduct.brand || 'Kayıtlı ürünün',
        protein100: Number(localProduct.protein_per_base || 0),
        source: 'Protik',
      })
      setBarcodeStatus('Ürün Protik kayıtlarında bulundu ✓')
      return
    }

    setBarcodeStatus('Ürün bilgisi aranıyor…')
    try {
      const fields = 'code,product_name,product_name_tr,brands,nutriments,serving_size,image_front_small_url'
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(normalized)}.json?fields=${fields}`)
      if (!response.ok) throw new Error('network')
      const data = await response.json()
      const product = data?.product
      const protein100 = Number(product?.nutriments?.proteins_100g)
      const name = (product?.product_name_tr || product?.product_name || '').trim()

      if (data?.status === 1 && product && name && Number.isFinite(protein100) && protein100 >= 0) {
        setBarcodeProduct({
          code: normalized,
          name,
          brand: (product.brands || '').split(',')[0]?.trim() || '',
          protein100,
          servingSize: product.serving_size || '',
          image: product.image_front_small_url || '',
          source: 'Open Food Facts',
        })
        setBarcodeManualName(name)
        setBarcodeManualProtein(String(protein100))
        setBarcodeStatus('Ürün bulundu ✓')
      } else {
        setBarcodeStatus('Ürün bulunamadı. Etiketteki bilgiyi bir kez ekleyebilirsin.')
        setBarcodeManualName(name || '')
      }
    } catch {
      setBarcodeStatus('Veritabanına ulaşılamadı. Ürünü elle ekleyebilirsin.')
    }
  }

  function addBarcodeProduct() {
    const protein100 = Number(barcodeProduct?.protein100 ?? barcodeManualProtein)
    const amount = Number(barcodeAmount)
    const name = (barcodeProduct?.name || barcodeManualName || '').trim()
    if (!barcodeResult || !name || !Number.isFinite(protein100) || protein100 < 0 || !Number.isFinite(amount) || amount <= 0) return

    const savedFood = onSaveCustomFood({
      food_id: `barcode-${barcodeResult}`,
      name,
      base_amount: 100,
      base_unit: 'g',
      protein_per_base: protein100,
      default_portion: 100,
      default_unit: 'g',
      protein_per_default_portion: protein100,
      icon_name: 'custom_food',
      barcode: barcodeResult,
      brand: barcodeProduct?.brand || '',
      aliases: [name, barcodeProduct?.brand].filter(Boolean),
      is_custom: true,
    })

    onSave({
      foodId: savedFood.food_id,
      name: savedFood.name,
      amount,
      unit: 'g',
      protein: (amount / 100) * protein100,
      proteinPerBase: protein100,
      meal,
    })
    setBarcodeOpen(false)
    setBarcodeProduct(null)
  }

  useEffect(() => {
    if (!barcodeOpen) return undefined

    let cancelled = false
    let startTimer = null

    async function bootScanner() {
      try {
        setBarcodeError('')
        setBarcodeStatus('Kamera hazırlanıyor…')
        await loadBarcodeLibrary()
        if (cancelled || !window.Html5Qrcode) return

        const F = window.Html5QrcodeSupportedFormats
        const preferredFormats = F
          ? [
              F.EAN_13,
              F.EAN_8,
              F.UPC_A,
              F.UPC_E,
              F.CODE_128,
              F.CODE_39,
            ].filter(Boolean)
          : undefined

        const scanner = new window.Html5Qrcode('protik-barcode-reader', {
          ...(preferredFormats ? { formatsToSupport: preferredFormats } : {}),
          verbose: false,
        })
        barcodeScannerRef.current = scanner

        await scanner.start(
          {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          {
            fps: 18,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
              width: Math.max(240, Math.floor(viewfinderWidth * 0.90)),
              height: Math.max(96, Math.min(140, Math.floor(viewfinderHeight * 0.34))),
            }),
            aspectRatio: 1.777778,
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          },
          async (decodedText) => {
            if (!decodedText || cancelled) return
            setBarcodeResult(decodedText)
            setBarcodeStatus('Barkod okundu ✓')
            lookupBarcode(decodedText)
            try {
              if (scanner.isScanning) await scanner.stop()
              scanner.clear()
            } catch {
              // Tarama sonucu alındı; kapatma hatası kullanıcı akışını etkilemez.
            }
          },
          () => {}
        )

        // iPhone/iPad destekliyorsa sürekli odaklamayı özellikle iste.
        try {
          const video = document.querySelector('#protik-barcode-reader video')
          const track = video?.srcObject?.getVideoTracks?.()[0]
          const capabilities = track?.getCapabilities?.() || {}
          if (track && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] })
          }
        } catch {
          // Odak iyileştirmesi desteklenmiyorsa normal tarama devam eder.
        }

        if (!cancelled) setBarcodeStatus('Barkodu yatay tutup geniş çerçevenin içine getir.')
      } catch (error) {
        if (cancelled) return
        const message = String(error?.message || error || '')
        const permissionDenied = /permission|notallowed|denied/i.test(message)
        setBarcodeError(
          permissionDenied
            ? 'Kamera izni verilmedi. Safari ayarlarından kamera iznini açıp tekrar deneyebilirsin.'
            : 'Kamera başlatılamadı. Sayfayı yenileyip tekrar deneyebilirsin.'
        )
        setBarcodeStatus('')
      }
    }

    startTimer = window.setTimeout(bootScanner, 60)

    return () => {
      cancelled = true
      if (startTimer) window.clearTimeout(startTimer)
      const scanner = barcodeScannerRef.current
      barcodeScannerRef.current = null
      if (scanner) {
        Promise.resolve(scanner.isScanning ? scanner.stop() : null)
          .catch(() => null)
          .finally(() => {
            try { scanner.clear() } catch {}
          })
      }
    }
  }, [barcodeOpen])

  const filtered = foods.filter((f) =>
    f.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) ||
    (f.aliases || []).some((a) => a.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))
  ).slice(0, 10)

  function resetForm() {
    setQuery('')
    setSelected(null)
    setAmount('')
    setShowResults(false)
    setShowProteinEditor(false)
    setCustomProteinPerBase('')
    setCustomProductName('')
  }

  function handleQueryChange(value) {
    setQuery(value)
    setShowResults(Boolean(value.trim()))
    setSelected(null)
    setAmount('')
    setShowProteinEditor(false)
    setCustomProteinPerBase('')
    setCustomProductName('')
  }

  function choose(food) {
    setSelected(food)
    setQuery(food.name)
    setAmount(food.recent_amount || food.default_portion)
    setShowResults(false)
    setShowProteinEditor(false)
    setCustomProteinPerBase(food.protein_per_base)
    setCustomProductName(food.is_custom ? food.name : '')
  }

  const effectiveProteinPerBase = Number(customProteinPerBase || selected?.protein_per_base || 0)

  const protein = selected
    ? selected.base_unit === selected.default_unit
      ? (Number(amount || 0) / Number(selected.base_amount)) * effectiveProteinPerBase
      : Number(selected.protein_per_default_portion || 0) * (
          effectiveProteinPerBase / Number(selected.protein_per_base || 1)
        ) * (Number(amount || 0) / Number(selected.default_portion || 1))
    : 0

  const proteinValueChanged =
    selected && Math.abs(effectiveProteinPerBase - Number(selected.protein_per_base || 0)) > 0.01

  function saveEntryInline() {
    if (!selected || Number(amount) <= 0) return
    onSave({
      foodId: selected.food_id,
      name: selected.name,
      amount: Number(amount),
      unit: selected.default_unit,
      protein,
      proteinPerBase: effectiveProteinPerBase,
      meal,
    })
    resetForm()
  }

  function saveAsCustomProduct() {
    if (!selected || !customProductName.trim() || effectiveProteinPerBase <= 0) return

    const customFood = onSaveCustomFood({
      ...selected,
      food_id: `custom-${Date.now()}`,
      name: customProductName.trim(),
      protein_per_base: effectiveProteinPerBase,
      protein_per_default_portion:
        selected.base_unit === selected.default_unit
          ? (Number(selected.default_portion) / Number(selected.base_amount)) * effectiveProteinPerBase
          : Number(selected.protein_per_default_portion || 0) * (
              effectiveProteinPerBase / Number(selected.protein_per_base || 1)
            ),
      icon_name: selected.icon_name || 'custom_food',
      is_custom: true,
      aliases: [customProductName.trim(), selected.name],
    })

    setSelected(customFood)
    setQuery(customFood.name)
    setCustomProductName(customFood.name)
    setShowProteinEditor(false)
  }

  return (
    <main className="appShell detailShell" ref={screenTopRef}>
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>{meal}</h1>
        <span />
      </header>

      <section className="card mealDetailCard mealDetailRedesign">
        <div className="mealSummaryTop">
          <div className="mealSummaryText">
            <span className="muted">Toplam protein</span>
            <strong>{total.toFixed(1)} g</strong>
            {entries.length === 0 && (
              <p className="mealEmptyMessage">Henüz protein eklenmedi.</p>
            )}
          </div>

          <div className={`mealVisual ${mealIconName(meal)}`} aria-hidden="true">
            <UiIcon name={mealIconName(meal)} size={38} />
          </div>
        </div>

        {entries.length > 0 && (
          <section className="mealExistingEntries" aria-label="Bu öğüne eklenenler">
            <div className="mealExistingEntriesHead">
              <strong>Bu öğüne eklediklerin</strong>
              <span>{entries.length} kayıt</span>
            </div>
            <div className="entryList">
              {entries.map((entry) => (
                <div className="entryRow" key={entry.id}>
                  <div>
                    <strong>{entry.name}</strong>
                    <span>{entry.amount} {entry.unit} · {Number(entry.protein).toFixed(1)} g protein</span>
                  </div>
                  <div className="entryActions">
                    <button className="smallAction" onClick={() => onEdit(entry)}>Düzenle</button>
                    <button
                      className="smallAction danger"
                      onClick={() => {
                        if (window.confirm(`${entry.name} kaydını silmek istiyor musun?`)) {
                          onDelete(entry.id)
                        }
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="inlineAddArea mealEntryChooser">
          {recentFoods.length > 0 && (
            <section className="recentFoodsSection">
              <div className="recentFoodsHead">
                <div>
                  <strong>Son eklediklerin</strong>
                  <span>Tekrar eklemek için dokun.</span>
                </div>
              </div>
              <div className="recentFoodsRow">
                {recentFoods.map((food) => (
                  <button
                    type="button"
                    key={food.food_id || food.name}
                    className={`recentFoodChip ${selected?.food_id === food.food_id ? 'selected' : ''}`}
                    onClick={() => choose(food)}
                  >
                    <span className="recentFoodPlus">+</span>
                    <strong>{food.name}</strong>
                    <small>{Number(food.recent_amount || food.default_portion || 0)} {food.recent_unit || food.default_unit || 'g'}</small>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="manualEntrySection">
            <div className="entryMethodHead">
              <span className="entryMethodIcon" aria-hidden="true">⌕</span>
              <div>
                <strong>Yiyecek / içecek ara</strong>
                <span>Listeden seç, tükettiğin miktarı gir.</span>
              </div>
            </div>
            <input
              className="search mealSearch"
              placeholder="Örn. tavuk, yoğurt, kefir..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => query && setShowResults(true)}
            />
          </section>

          {showResults && query && (
            <div className="searchResults inlineResults">
              {filtered.length > 0 ? (
                filtered.map((food) => (
                  <button key={food.food_id} onClick={() => choose(food)}>
                    <span className="searchFoodName">
                      {food.name}
                      {food.is_custom && <small>Benim ürünüm</small>}
                    </span>
                    <span>{Number(food.protein_per_default_portion).toFixed(1)} g</span>
                  </button>
                ))
              ) : (
                <div className="emptySearch">Bu ürün henüz listede yok.</div>
              )}
            </div>
          )}

          {selected && !showResults && (
            <div className="inlineSelectedFood">
              <div className="selectedFood">
                <div className="foodIcon big">{iconFor(selected.icon_name)}</div>
                <div>
                  <h2>{selected.name}</h2>
                  <p>{selected.category}</p>
                </div>
              </div>

              {naturalPortionsFor(selected).length > 0 && (
                <div className="naturalPortionBox">
                  <div className="naturalPortionHead">
                    <strong>Kolay porsiyon seç</strong>
                    <span>İstersen aşağıdan miktarı kendin de girebilirsin.</span>
                  </div>
                  <div className="naturalPortionChips">
                    {naturalPortionsFor(selected).map((portion) => (
                      <button
                        type="button"
                        key={`${portion.label}-${portion.amount}`}
                        className={Number(amount) === Number(portion.amount) ? 'naturalPortionChip selected' : 'naturalPortionChip'}
                        onClick={() => setAmount(portion.amount)}
                      >
                        {portion.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Field label={`Miktar (${selected.default_unit})`}>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>

              <div className="proteinResult">
                <span>Protein</span>
                <b>{protein.toFixed(1)} g</b>
              </div>

              <button
                type="button"
                className="textAction"
                onClick={() => setShowProteinEditor((value) => !value)}
              >
                {showProteinEditor ? 'Protein değerini kapat' : 'Protein değerini değiştir'}
              </button>

              {showProteinEditor && (
                <div className="proteinEditor">
                  <div className="proteinEditorTitle">
                    Bu ürünün etiketindeki değeri girebilirsin.
                  </div>

                  <Field label={`${selected.base_amount} ${selected.base_unit} protein (g)`}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={customProteinPerBase}
                      onChange={(e) => setCustomProteinPerBase(e.target.value)}
                    />
                  </Field>

                  <div className="proteinEditorHint">
                    Standart değer: {selected.protein_per_base} g / {selected.base_amount} {selected.base_unit}
                  </div>

                  {proteinValueChanged && (
                    <div className="customProductBox">
                      <input
                        className="customProductInput"
                        type="text"
                        placeholder="Örn. Benim yüksek proteinli yoğurdum"
                        value={customProductName}
                        onChange={(e) => setCustomProductName(e.target.value)}
                      />
                      <button
                        type="button"
                        className="secondaryButton"
                        disabled={!customProductName.trim() || effectiveProteinPerBase <= 0}
                        onClick={saveAsCustomProduct}
                      >
                        Bu ürünü kaydet
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="inlineAddActions">
                <button type="button" className="smallAction" onClick={resetForm}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className="primary inlineSaveButton"
                  disabled={!selected || Number(amount) <= 0}
                  onClick={saveEntryInline}
                >
                  {meal === 'Kahvaltı' ? 'Kahvaltıya Ekle' :
                   meal === 'Öğle Yemeği' ? 'Öğle Yemeğine Ekle' :
                   meal === 'Ara Öğün' ? 'Ara Öğüne Ekle' :
                   'Akşam Yemeğine Ekle'}
                </button>
              </div>
            </div>
          )}

          <div className="entryMethodDivider"><span>veya</span></div>

          <section className="barcodeEntrySection">
            <div className="barcodeEntryCopy">
              <span className="barcodeGlyph barcodeGlyphLarge" aria-hidden="true"><i /><i /><i /><i /><i /></span>
              <div>
                <strong>Paketli ürün mü yedin?</strong>
                <span>Barkodu tara; ürünün protein değerini bulalım. Sen sadece ne kadar yediğini yaz.</span>
              </div>
            </div>
            <button
              type="button"
              className="barcodeTestButton barcodePrimaryButton"
              onClick={() => {
                setBarcodeResult('')
                setBarcodeError('')
                setBarcodeStatus('')
                setBarcodeProduct(null)
                setBarcodeManualName('')
                setBarcodeManualProtein('')
                setBarcodeAmount('')
                setBarcodeOpen(true)
              }}
            >
              <span>
                <strong>Barkodu Tara</strong>
                <small>Kamerayı aç</small>
              </span>
              <b>›</b>
            </button>
          </section>

          {barcodeOpen && (
            <section className="barcodeTestPanel" aria-label="Barkod tarama">
              <div className="barcodeTestPanelHead">
                <div>
                  <strong>Barkod tara</strong>
                  <span>Ürünü bulalım, miktarı seç ve öğününe ekle.</span>
                </div>
                <button
                  type="button"
                  className="barcodeCloseButton"
                  aria-label="Barkod tarayıcıyı kapat"
                  onClick={() => setBarcodeOpen(false)}
                >×</button>
              </div>

              {!barcodeResult && !barcodeError && (
                <div className="barcodeCameraFrame">
                  <div id="protik-barcode-reader" />
                </div>
              )}

              {barcodeStatus && <div className="barcodeStatus">{barcodeStatus}</div>}

              {barcodeResult && (
                <div className="barcodeLookupResult">
                  <div className="barcodeNumberLine">
                    <span>Barkod</span>
                    <strong>{barcodeResult}</strong>
                  </div>

                  {barcodeProduct ? (
                    <div className="barcodeProductCard">
                      {barcodeProduct.image ? <img src={barcodeProduct.image} alt="" /> : <div className="barcodeProductFallback">▥</div>}
                      <div>
                        <strong>{barcodeProduct.name}</strong>
                        {barcodeProduct.brand && <span>{barcodeProduct.brand}</span>}
                        <b>{Number(barcodeProduct.protein100).toFixed(1)} g protein / 100 g</b>
                      </div>
                    </div>
                  ) : (
                    <div className="barcodeManualBox">
                      <strong>Ürünü bir kez kaydedelim</strong>
                      <p>Paketteki ürün adını ve 100 g’daki protein değerini gir.</p>
                      <label>
                        <span>Ürün adı</span>
                        <input value={barcodeManualName} onChange={(e) => setBarcodeManualName(e.target.value)} placeholder="Örn. Protein yoğurt" />
                      </label>
                      <label>
                        <span>Protein / 100 g</span>
                        <input type="number" inputMode="decimal" min="0" step="0.1" value={barcodeManualProtein} onChange={(e) => setBarcodeManualProtein(e.target.value)} placeholder="Örn. 10" />
                      </label>
                    </div>
                  )}

                  <div className="barcodeAmountIntro">
                    <strong>Ne kadar yedin?</strong>
                    <span>100 g yalnızca ürünün referans değeridir. Öğüne eklenecek protein, yazdığın miktara göre hesaplanır.</span>
                  </div>
                  <label className="barcodeAmountField">
                    <span>Yediğin miktar</span>
                    <div><input type="number" inputMode="decimal" min="1" step="1" value={barcodeAmount} onChange={(e) => setBarcodeAmount(e.target.value)} placeholder="Örn. 30" /><b>g</b></div>
                  </label>

                  {(barcodeProduct || (barcodeManualName.trim() && Number(barcodeManualProtein) >= 0 && barcodeManualProtein !== '')) && (
                    <div className="barcodeProteinPreview">
                      <span>Bu miktarda yaklaşık</span>
                      <strong>{((Number(barcodeAmount || 0) / 100) * Number(barcodeProduct?.protein100 ?? (barcodeManualProtein || 0))).toFixed(1)} g protein</strong>
                    </div>
                  )}

                  <button
                    type="button"
                    className="primary wide barcodeAddButton"
                    disabled={!Number(barcodeAmount) || !(barcodeProduct || (barcodeManualName.trim() && barcodeManualProtein !== '' && Number(barcodeManualProtein) >= 0))}
                    onClick={addBarcodeProduct}
                  >Öğüne ekle</button>
                  <button
                    type="button"
                    className="barcodeRetryButton"
                    onClick={() => {
                      setBarcodeOpen(false)
                      window.setTimeout(() => {
                        setBarcodeResult('')
                        setBarcodeError('')
                        setBarcodeStatus('')
                        setBarcodeProduct(null)
                        setBarcodeManualName('')
                        setBarcodeManualProtein('')
                        setBarcodeAmount('')
                        setBarcodeOpen(true)
                      }, 80)
                    }}
                  >Başka barkod tara</button>
                </div>
              )}

              {barcodeError && (
                <div className="barcodeErrorBox">
                  <strong>Kamera açılamadı</strong>
                  <p>{barcodeError}</p>
                  <button type="button" className="secondaryButton" onClick={() => setBarcodeOpen(false)}>Kapat</button>
                </div>
              )}
            </section>
          )}

        </div>

      </section>
      <BottomNav
        active=""
        onHome={onHome}
        onHistory={onHistory}
        onProfile={onProfile}
      />
    </main>
  )
}

function PrivacyPolicy({ onBack }) {
  const topRef = useScreenTop()
  return (
    <main className="appShell privacyPolicyShell" ref={topRef}>
      <header className="screenHeader proScreenHeader">
        <button className="back" onClick={onBack} aria-label="Geri">‹</button>
        <h1>Gizlilik Politikası</h1>
        <div style={{ width: 42 }} />
      </header>

      <section className="privacyPolicyCard card">
        <p className="privacyUpdated">Son güncelleme: 17 Eylül 2026</p>
        <h2>Protik verilerinizi nasıl kullanır?</h2>
        <p>Protik, günlük protein takibi yapmanıza yardımcı olan bir uygulamadır. Profil bilgileriniz, protein hedefiniz ve eklediğiniz protein kayıtları bu sürümde cihazınızın tarayıcı depolamasında saklanır.</p>

        <h3>Cihazda saklanan bilgiler</h3>
        <p>Ad, yaş, cinsiyet, boy, kilo, hedef ve aktivite gibi profil bilgileri ile öğün ve protein kayıtları cihazınızda tutulur. Protik şu anda kullanıcı hesabı veya bulut senkronizasyonu kullanmaz.</p>

        <h3>Verilerin silinmesi</h3>
        <p>Tarayıcı veya uygulama verilerini temizlerseniz cihazda saklanan Protik kayıtları silinebilir. Bu sürümde otomatik bulut yedeği bulunmaz.</p>

        <h3>Kamera ve barkod</h3>
        <p>Barkod tarama özelliğini kullandığınızda kamera yalnızca barkodu okumak için kullanılır. Kamera görüntüsü Protik tarafından saklanmaz.</p>

        <h3>Open Food Facts</h3>
        <p>Barkod ile ürün aradığınızda okunan barkod numarası ürün bilgisini bulmak amacıyla Open Food Facts hizmetine gönderilebilir. Bu hizmetin kendi gizlilik koşulları geçerlidir.</p>

        <h3>Reklam ve analitik</h3>
        <p>Bu sürümde Protik reklam ağı veya kullanıcı davranışını izleyen bir analitik hizmeti kullanmaz.</p>

        <h3>Sağlık bilgisi</h3>
        <p>Protik tıbbi cihaz değildir ve tıbbi tavsiye vermez. Uygulamadaki protein hedefleri genel bilgilendirme amacıyla sunulur.</p>

        <h3>Değişiklikler</h3>
        <p>Uygulamanın özellikleri değiştikçe bu gizlilik politikası da güncellenebilir.</p>
      </section>
    </main>
  )
}

function Profile({ profile, onBack, onHome, onHistory, onPrivacy, onSave }) {
  const screenTopRef = useScreenTop()
  const [p, setP] = useState(profile)
  const [editing, setEditing] = useState(false)
  const [profileError, setProfileError] = useState('')

  const calculateSuggestedTarget = (draft) => {
    const weight = Number(draft.weight)
    const multiplier = getProteinMultiplier(draft.activity, draft.goal)
    if (!(weight > 0) || !(multiplier > 0)) return 0
    return Math.max(40, Math.round((weight * multiplier) / 5) * 5)
  }

  const inferredMode = profile.proteinTargetMode ||
    (Number(profile.proteinTarget) === calculateSuggestedTarget(profile) ? 'suggested' : 'custom')
  const [proteinTargetMode, setProteinTargetMode] = useState(inferredMode)

  const suggestedProfileTarget = calculateSuggestedTarget(p)
  const effectiveProteinTarget = proteinTargetMode === 'suggested'
    ? suggestedProfileTarget
    : Number(p.proteinTarget)

  const requiredProfileValid =
    Number(p.age) > 0 &&
    Number(p.height) > 0 &&
    Number(p.weight) > 0 &&
    Boolean(p.activity) &&
    Boolean(p.goal) &&
    Number(effectiveProteinTarget) > 0

  const startEditing = () => {
    const mode = profile.proteinTargetMode ||
      (Number(profile.proteinTarget) === calculateSuggestedTarget(profile) ? 'suggested' : 'custom')
    setP(profile)
    setProteinTargetMode(mode)
    setProfileError('')
    setEditing(true)
  }

  const saveProfile = () => {
    if (!requiredProfileValid) {
      setProfileError('Yaş, boy, kilo, hareket düzeni, hedef ve protein hedefi zorunludur.')
      return
    }
    setProfileError('')
    const nextProfile = {
      ...p,
      proteinTarget: effectiveProteinTarget,
      proteinTargetMode,
    }
    setP(nextProfile)
    onSave(nextProfile)
    setEditing(false)
  }

  const rows = [
    { key: 'name', label: 'Adın', icon: 'profile', value: p.name || '—', tone: 'violet' },
    { key: 'age', label: 'Yaşın', icon: 'age', value: p.age ? `${p.age}` : '—', tone: 'violet' },
    { key: 'gender', label: 'Cinsiyetin', icon: 'gender', value: p.gender || '—', tone: 'pink' },
    { key: 'weight', label: 'Kilon', icon: 'weight', value: p.weight ? `${p.weight} kg` : '—', tone: 'blue' },
    { key: 'height', label: 'Boyun', icon: 'height', value: p.height ? `${p.height} cm` : '—', tone: 'green' },
    { key: 'goal', label: 'Hedefin', icon: 'goal', value: p.goal || '—', tone: 'orange' },
    { key: 'activity', label: 'Hareket düzenin', icon: 'activity', value: p.activity || '—', tone: 'purple' },
  ]

  return (
    <main className="appShell themedShell profileShell" ref={screenTopRef}>
      <header className="screenHeader proScreenHeader profileHeaderClean">
        <button className="back" onClick={onBack} aria-label="Geri">
          ‹
        </button>
        <h1>Profil</h1>
        <button
          className={`settingsButton ${editing ? 'active' : ''}`}
          onClick={() => {
            if (editing) {
              setP(profile)
              setProfileError('')
              setEditing(false)
            } else {
              startEditing()
            }
          }}
          aria-label="Profili düzenle"
        >
          <UiIcon name="settings" size={21} />
        </button>
      </header>

      <section className="profileQuote profileQuoteLarge card">
        <div className="quoteText">
          “İyi beslenmek sadece bir hedef değil,<br />
          daha iyi bir yaşam biçimidir.”
        </div>
        <div className="quoteHeart">♥</div>
        <div className="quoteLeaf">❧</div>
      </section>

      {!editing ? (
        <>
          <div className="profileSectionTitle">
            <h2>Kişisel Bilgiler</h2>
          </div>

          <section className="profileInfoCard card">
            {rows.map((row) => (
              <div className="profileInfoRow profileInfoStatic" key={row.key}>
                <div className={`profileInfoIcon ${row.tone}`}>
                  <UiIcon name={row.icon} size={24} />
                </div>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </section>

          <section className="proteinGoalCard card">
            <div className="profileInfoIcon goalLarge targetTone">
              <UiIcon name="goal" size={27} />
            </div>
            <div>
              <span>Günlük protein hedefin</span>
              <strong>{p.proteinTarget} g</strong>
            </div>
            <button className="goalEditPill" onClick={startEditing}>Düzenle <UiIcon name="chevron" size={15} /></button>
          </section>

          <section className="privacyCard card">
            <div className="privacyCardIcon">
              <UiIcon name="settings" size={22} />
            </div>
            <div className="privacyCardCopy">
              <strong>Veri ve Gizlilik</strong>
              <span>Profilin ve protein kayıtların bu cihazda saklanır. Protik şu anda hesap veya bulut senkronizasyonu kullanmaz.</span>
              <button type="button" className="privacyLinkButton" onClick={onPrivacy}>Gizlilik Politikasını Gör <UiIcon name="chevron" size={15} /></button>
            </div>
          </section>

          <section className="profileMotivation profileMotivationLarge card">
            <div className="motivationLeaf">🌿</div>
            <div>
              <strong>Daha sağlıklı,<br />daha güçlü bir sen ♡</strong>
              <span>Küçük adımlar, büyük değişimler yaratır.</span>
            </div>
          </section>
        </>
      ) : (
        <section className="card profileEditCard">
          <div className="profileEditTitle">
            <h2>Bilgilerini düzenle</h2>
            <p>Değişikliklerini kaydettiğinde profilin güncellenecek.</p>
          </div>

          <Field label="Sana nasıl hitap edelim?">
            <input
              type="text"
              placeholder="Örn. Özlem"
              value={p.name || ''}
              onChange={(e) => setP({ ...p, name: e.target.value })}
            />
          </Field>

          <Field label="Yaşın">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              required
              value={p.age || ''}
              onChange={(e) => {
                setProfileError('')
                setP({ ...p, age: e.target.value === '' ? '' : Number(e.target.value) })
              }}
            />
          </Field>

          <Field label="Cinsiyetin">
            <select value={p.gender || ''} onChange={(e) => setP({ ...p, gender: e.target.value })}>
              <option value="">Seç</option>
              <option>Kadın</option>
              <option>Erkek</option>
              <option>Belirtmek istemiyorum</option>
            </select>
          </Field>

          <Field label="Boyun (cm)">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              required
              value={p.height || ''}
              onChange={(e) => {
                setProfileError('')
                setP({ ...p, height: e.target.value === '' ? '' : Number(e.target.value) })
              }}
            />
          </Field>

          <Field label="Kilon (kg)">
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.1"
              required
              value={p.weight || ''}
              onChange={(e) => {
                setProfileError('')
                setP({ ...p, weight: e.target.value === '' ? '' : Number(e.target.value) })
              }}
            />
          </Field>

          <Field label="Hareket düzeyin">
            <select
              value={p.activity}
              onChange={(e) => {
                setProfileError('')
                setP({ ...p, activity: e.target.value })
              }}
            >
              <option>Düşük</option>
              <option>Orta</option>
              <option>Yüksek</option>
            </select>
          </Field>

          <Field label="Hedefin">
            <select
              value={p.goal}
              onChange={(e) => {
                setProfileError('')
                setP({ ...p, goal: e.target.value })
              }}
            >
              <option>Genel sağlık</option>
              <option>Kilo verme sürecinde</option>
              <option>Kas koruma / geliştirme</option>
            </select>
          </Field>

          <div className="proteinTargetModeBlock">
            <div className="proteinTargetModeIntro">
              <strong>Günlük protein hedefin</strong>
              <span>İstersen Protik hesaplasın, istersen kendi hedefini kullan.</span>
            </div>

            <div className="proteinTargetModeChoices" role="radiogroup" aria-label="Protein hedefi yöntemi">
              <button
                type="button"
                className={`proteinTargetModeChoice ${proteinTargetMode === 'suggested' ? 'active' : ''}`}
                onClick={() => {
                  setProfileError('')
                  setProteinTargetMode('suggested')
                }}
                role="radio"
                aria-checked={proteinTargetMode === 'suggested'}
              >
                <span className="modeRadio" aria-hidden="true" />
                <span>
                  <strong>Önerilen hedef</strong>
                  <small>Kilo, hareket düzeni ve hedefine göre otomatik güncellenir.</small>
                </span>
              </button>

              <button
                type="button"
                className={`proteinTargetModeChoice ${proteinTargetMode === 'custom' ? 'active' : ''}`}
                onClick={() => {
                  setProfileError('')
                  setProteinTargetMode('custom')
                  if (!(Number(p.proteinTarget) > 0)) {
                    setP({ ...p, proteinTarget: suggestedProfileTarget || '' })
                  }
                }}
                role="radio"
                aria-checked={proteinTargetMode === 'custom'}
              >
                <span className="modeRadio" aria-hidden="true" />
                <span>
                  <strong>Özel hedef</strong>
                  <small>Protein hedefini kendin belirle.</small>
                </span>
              </button>
            </div>

            {proteinTargetMode === 'suggested' ? (
              <div className="suggestedTargetPreview">
                <div>
                  <span>Yeni önerilen hedefin</span>
                  <strong>{suggestedProfileTarget || '—'} g</strong>
                </div>
                <small>Kilo, hareket düzeni veya hedefin değişirse bu değer otomatik değişir.</small>
              </div>
            ) : (
              <Field label="Özel protein hedefin (g)">
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  required
                  value={p.proteinTarget || ''}
                  onChange={(e) => {
                    setProfileError('')
                    setP({ ...p, proteinTarget: e.target.value === '' ? '' : Number(e.target.value) })
                  }}
                />
              </Field>
            )}
          </div>

          {!requiredProfileValid && (
            <p className="profileRequiredNote">Yaş, boy, kilo, hareket düzeni, hedef ve protein hedefi zorunludur.</p>
          )}
          {profileError && <p className="profileFormError" role="alert">{profileError}</p>}

          <div className="profileEditActions">
            <button
              className="secondaryButton"
              onClick={() => {
                setP(profile)
                setProteinTargetMode(profile.proteinTargetMode || (Number(profile.proteinTarget) === calculateSuggestedTarget(profile) ? 'suggested' : 'custom'))
                setProfileError('')
                setEditing(false)
              }}
            >
              İptal
            </button>
            <button className="primary" onClick={saveProfile} disabled={!requiredProfileValid}>Kaydet</button>
          </div>
        </section>
      )}

      <BottomNav
        active="profile"
        onHome={onHome}
        onHistory={onHistory}
        onProfile={() => {}}
      />
    </main>
  )
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function ChoiceGroup({ value, onChange, options }) {
  return (
    <div className="choices richChoices">
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'selected richChoiceCard' : 'richChoiceCard'}
          onClick={() => onChange(option.value)}
        >
          <div className="choiceIcon">{option.icon}</div>
          <div>
            <strong>{option.title}</strong>
            {option.description && <span>{option.description}</span>}
          </div>
        </button>
      ))}
    </div>
  )
}

function isBasicsValid(form) {
  return Number(form.age) > 0 && Number(form.height) > 0 && Number(form.weight) > 0
}

function getProteinMultiplier(activity, goal) {
  if (goal === 'Kas koruma / geliştirme') return 1.7
  if (goal === 'Kilo verme sürecinde') return 1.5
  if (activity === 'Yüksek') return 1.3
  if (activity === 'Orta') return 1.2
  if (activity === 'Düşük') return 1.0
  return 0
}

function buildCompletionPlans(foods, remaining) {
  const findFood = (name) =>
    foods.find((food) =>
      food.name.toLocaleLowerCase('tr').includes(name.toLocaleLowerCase('tr'))
    )

  const proteinFor = (food, amount) => {
    if (!food) return 0
    if (food.base_unit === food.default_unit) {
      return (Number(amount) / Number(food.base_amount)) * Number(food.protein_per_base)
    }

    const defaultAmount = Number(food.default_portion || 1)
    return Number(food.protein_per_default_portion || 0) * (Number(amount) / defaultAmount)
  }

  const portion = (foodName, amount, unitLabel = null) => {
    const food = findFood(foodName)
    if (!food) return null
    const unit = unitLabel || food.default_unit
    return {
      food_id: food.food_id,
      name: food.name,
      amount,
      unit,
      label: `${amount} ${unit} ${food.name}`,
      protein: proteinFor(food, amount),
    }
  }

  // Gerçek hayatta sık kullanılan, yuvarlak porsiyonlar.
  const libraries = {
    balanced: [
      portion('Tavuk göğsü', 100, 'g'),
      portion('Tavuk göğsü', 120, 'g'),
      portion('Tavuk göğsü', 150, 'g'),
      portion('Hindi göğsü', 100, 'g'),
      portion('Hindi göğsü', 120, 'g'),
      portion('Somon', 100, 'g'),
      portion('Somon', 150, 'g'),
      portion('Süzme yoğurt', 100, 'g'),
      portion('Süzme yoğurt', 150, 'g'),
      portion('Süzme yoğurt', 200, 'g'),
      portion('Yumurta', 1, 'adet'),
      portion('Yumurta', 2, 'adet'),
      portion('Kaşar peyniri', 30, 'g'),
      portion('Lor peyniri', 50, 'g'),
    ].filter(Boolean),

    practical: [
      portion('Whey protein', 1, 'ölçek'),
      portion('Ton balığı', 80, 'g'),
      portion('Ton balığı', 120, 'g'),
      portion('Proteinli yoğurt', 1, 'kase'),
      portion('Proteinli süt', 1, 'şişe'),
      portion('Yumurta', 1, 'adet'),
      portion('Yumurta', 2, 'adet'),
      portion('İnek sütü', 200, 'ml'),
      portion('İnek sütü', 250, 'ml'),
      portion('Süzme yoğurt', 150, 'g'),
    ].filter(Boolean),

    vegetarian: [
      portion('Tofu', 100, 'g'),
      portion('Tofu', 150, 'g'),
      portion('Yeşil mercimek', 150, 'g'),
      portion('Yeşil mercimek', 200, 'g'),
      portion('Edamame', 100, 'g'),
      portion('Edamame', 150, 'g'),
      portion('Süzme yoğurt', 100, 'g'),
      portion('Süzme yoğurt', 150, 'g'),
      portion('Süzme yoğurt', 200, 'g'),
      portion('Yumurta', 1, 'adet'),
      portion('Yumurta', 2, 'adet'),
      portion('Cottage cheese', 100, 'g'),
      portion('Lor peyniri', 50, 'g'),
    ].filter(Boolean),
  }

  // Kullanıcının kaydettiği özel ürünleri pratik ve dengeli seçeneklerde
  // doğal varsayılan porsiyonuyla hesaba kat.
  const customPortions = foods
    .filter((food) => food.is_custom)
    .map((food) => ({
      food_id: food.food_id,
      name: food.name,
      amount: Number(food.default_portion),
      unit: food.default_unit,
      label: `${food.default_portion} ${food.default_unit} ${food.name}`,
      protein: Number(food.protein_per_default_portion || 0),
    }))
    .filter((item) => item.protein > 0)

  libraries.practical.push(...customPortions)
  libraries.balanced.push(...customPortions)

  const uniqueByLabel = (items) => {
    const seen = new Set()
    return items.filter((item) => {
      if (!item || seen.has(item.label)) return false
      seen.add(item.label)
      return true
    })
  }

  Object.keys(libraries).forEach((key) => {
    libraries[key] = uniqueByLabel(libraries[key])
  })

  const scoreCombo = (items, total, target) => {
    const diff = Math.abs(total - target)
    const overshoot = Math.max(total - target, 0)

    // 2 ürün genellikle daha "öneri" hissi verir; ama tek doğal porsiyon
    // hedefe çok yakınsa onu da kabul et.
    const itemPenalty =
      items.length === 1 && diff > 3 ? 5 :
      items.length === 3 ? 1.5 :
      0

    // Fazla aşmayı, az eksik kalmaya göre biraz daha çok cezalandır.
    const overshootPenalty = overshoot * 0.35

    // Aynı yiyeceğin iki farklı porsiyonunu aynı planda kullanma.
    const names = items.map((item) => item.name)
    const duplicatePenalty = new Set(names).size !== names.length ? 100 : 0

    return diff + overshootPenalty + itemPenalty + duplicatePenalty
  }

  const bestCombination = (library, target) => {
    let best = null

    const consider = (items) => {
      const total = items.reduce((sum, item) => sum + Number(item.protein || 0), 0)
      if (total <= 0) return

      // Çok küçük hedeflerde devasa plan göstermeyelim.
      if (total > target + 12) return

      const score = scoreCombo(items, total, target)
      if (!best || score < best.score) {
        best = { items, total, score }
      }
    }

    // 1 ürün
    for (let i = 0; i < library.length; i++) {
      consider([library[i]])
    }

    // 2 ürün
    for (let i = 0; i < library.length; i++) {
      for (let j = i + 1; j < library.length; j++) {
        consider([library[i], library[j]])
      }
    }

    // 3 ürün — sadece daha yüksek kalan hedeflerde.
    if (target >= 45) {
      for (let i = 0; i < library.length; i++) {
        for (let j = i + 1; j < library.length; j++) {
          for (let k = j + 1; k < library.length; k++) {
            consider([library[i], library[j], library[k]])
          }
        }
      }
    }

    return best
  }

  const definitions = [
    {
      id: 'balanced',
      title: 'Dengeli seçenek',
      subtitle: 'Doğal porsiyonlarla dengeli bir kombinasyon',
    },
    {
      id: 'practical',
      title: 'Pratik seçenek',
      subtitle: 'Hazırlaması kolay seçenekler',
    },
    {
      id: 'vegetarian',
      title: 'Vejetaryen seçenek',
      subtitle: 'Et ve balık olmadan',
    },
  ]

  return definitions
    .map((definition) => {
      const result = bestCombination(libraries[definition.id], remaining)
      if (!result) return null
      return {
        ...definition,
        items: result.items,
        total: result.total,
      }
    })
    .filter(Boolean)
}

function addButtonLabel(meal) {
  if (meal === 'Kahvaltı') return 'Kahvaltıya Ekle'
  if (meal === 'Öğle Yemeği') return 'Öğle Yemeğine Ekle'
  if (meal === 'Ara Öğün') return 'Ara Öğüne Ekle'
  if (meal === 'Akşam Yemeği') return 'Akşam Yemeğine Ekle'
  return 'Öğüne Ekle'
}

function autoMeal() {
  const h = new Date().getHours()

  if (h >= 5 && h < 11) return 'Kahvaltı'
  if (h >= 11 && h < 15) return 'Öğle Yemeği'
  if (h >= 15 && h < 18) return 'Ara Öğün'
  if (h >= 18 && h < 23) return 'Akşam Yemeği'
  return 'Ara Öğün'
}

function iconFor(name = '') {
  if (name.includes('egg')) return '🥚'
  if (name.includes('milk') || name.includes('yogurt') || name.includes('kefir')) return '🥛'
  if (name.includes('chicken') || name.includes('turkey')) return '🍗'
  if (name.includes('fish') || name.includes('salmon') || name.includes('tuna') || name.includes('seabass') || name.includes('seabream')) return '🐟'
  if (name.includes('cheese') || name.includes('lor') || name.includes('feta')) return '🧀'
  if (name.includes('lentil') || name.includes('beans') || name.includes('chickpea')) return '🫘'
  if (name.includes('whey') || name.includes('protein')) return '🥤'
  return '🍽️'
}

export default App
