import React, { useMemo, useState } from 'react'
import foods from './foods.json'

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

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function App() {
  const [profile, setProfile] = useState(loadProfile)
  const [entries, setEntries] = useState(loadEntries)
  const [screen, setScreen] = useState(profile ? 'home' : 'onboarding')

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayEntries = entries.filter((e) => e.date === todayKey)
  const totalProtein = todayEntries.reduce((sum, e) => sum + Number(e.protein || 0), 0)

  const target = profile?.proteinTarget || 90
  const remaining = Math.max(target - totalProtein, 0)

  const recommendations = useMemo(() => {
    if (remaining <= 0) return []
    return foods
      .map((f) => {
        const portionProtein = Number(f.protein_per_default_portion || 0)
        return { ...f, distance: Math.abs(portionProtein - remaining) }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
  }, [remaining])

  function finishOnboarding(nextProfile) {
    save('protik_profile', nextProfile)
    setProfile(nextProfile)
    setScreen('home')
  }

  function addEntry(entry) {
    const next = [...entries, { ...entry, id: Date.now(), date: todayKey }]
    save('protik_entries', next)
    setEntries(next)
    setScreen('home')
  }

  if (screen === 'onboarding') {
    return <Onboarding onFinish={finishOnboarding} />
  }

  if (screen === 'add') {
    return <AddProtein foods={foods} onBack={() => setScreen('home')} onSave={addEntry} />
  }

  if (screen === 'profile') {
    return (
      <Profile
        profile={profile}
        onBack={() => setScreen('home')}
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
      profile={profile}
      target={target}
      total={totalProtein}
      remaining={remaining}
      recommendations={recommendations}
      todayEntries={todayEntries}
      onAdd={() => setScreen('add')}
      onProfile={() => setScreen('profile')}
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

function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    activity: '',
    goal: '',
  })
  const [manualTarget, setManualTarget] = useState(null)

  const weightNumber = Number(form.weight)
  const multiplier = getProteinMultiplier(form.activity, form.goal)
  const suggested = weightNumber > 0 && multiplier > 0
    ? Math.max(40, Math.round((weightNumber * multiplier) / 5) * 5)
    : 40
  const target = manualTarget ?? suggested

  const activityOptions = [
    { value: 'Düşük', title: 'Düşük', description: 'Çoğunlukla masa başı veya az hareketli bir gün.' },
    { value: 'Orta', title: 'Orta', description: 'Haftada 1–3 gün egzersiz veya düzenli yürüyüş.' },
    { value: 'Yüksek', title: 'Yüksek', description: 'Haftada 4+ gün düzenli egzersiz veya yoğun hareket.' },
  ]

  const goalOptions = [
    { value: 'Genel sağlık', title: 'Genel sağlık', description: 'Günlük proteinini daha dengeli tutmak istiyorum.' },
    { value: 'Kilo verme sürecinde', title: 'Kilo verme sürecinde', description: 'Kilo verirken kas kaybını azaltmak istiyorum.' },
    { value: 'Kas koruma / geliştirme', title: 'Kas koruma / geliştirme', description: 'Kas kütlemi korumak veya artırmak istiyorum.' },
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
    <main className="appShell onboarding warmBackground">
      <div className="topDots">{step + 1} / 5</div>

      <div className="panel">
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
            <div className="miniFeatureRow">
              <div className="miniFeature">Hedefini gör</div>
              <div className="miniFeature">Kolayca ekle</div>
              <div className="miniFeature">Eksik kalanı tamamla</div>
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
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </Field>
            </div>
            {!isBasicsValid(form) && (
              <div className="helperText">Devam etmek için yaşını, boyunu ve kilonu gir.</div>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="onboardingStep centered compactStep">
            <div className="stepIntro centered">
              <h2>Günlük hareketin nasıl?</h2>
              <p className="muted">Sana daha uygun bir protein hedefi önermemize yardımcı olur.</p>
            </div>
            <ChoiceGroup
              value={form.activity}
              onChange={(value) => setForm({ ...form, activity: value })}
              options={activityOptions}
            />
          </section>
        )}

        {step === 3 && (
          <section className="onboardingStep centered compactStep">
            <div className="stepIntro centered">
              <h2>Hedefin ne?</h2>
              <p className="muted">Protein hedefini buna göre ayarlayacağız.</p>
            </div>
            <ChoiceGroup
              value={form.goal}
              onChange={(value) => setForm({ ...form, goal: value })}
              options={goalOptions}
            />
          </section>
        )}

        {step === 4 && (
          <section className="onboardingStep centered targetStep warmTargetStep">
            <div className="stepIntro centered narrow">
              <h2>Önerilen başlangıç hedefin</h2>
              <p className="muted">Kilon, hareket düzeyin ve hedefine göre hesaplandı.</p>
            </div>
            <div className="targetSummaryCard warmCard">
              <div className="targetPreviewCircle">
                <span>{target}</span>
                <small>g / gün</small>
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
          <button className="ghost" onClick={() => setStep(step - 1)}>
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

function Home({ target, total, remaining, recommendations, todayEntries, onAdd, onProfile }) {
  const pct = Math.min(Math.round((total / target) * 100), 100)
  return (
    <main className="appShell">
      <header className="topbar">
        <Logo />
        <button className="iconButton" onClick={onProfile}>◯</button>
      </header>

      <div className="hello">
        <h1>Merhaba!</h1>
        <p>Bugün hedefin için bir adım daha at.</p>
      </div>

      <section className="card progressCard">
        <div>
          <span className="eyebrow">Bugünkü protein</span>
          <div className="proteinValue">{Math.round(total)} <small>/ {target} g</small></div>
          <div className="remaining">{remaining > 0 ? `${Math.round(remaining)} g kaldı` : 'Hedef tamamlandı ✓'}</div>
        </div>
        <div className="ring" style={{ '--pct': `${pct * 3.6}deg` }}>
          <span>%{pct}</span>
        </div>
        <button className="primary wide" onClick={onAdd}>＋ Protein Ekle</button>
      </section>

      <section className="section">
        <div className="sectionTitle">
          <h2>Kalan proteini tamamla</h2>
        </div>
        {remaining > 0 ? (
          <div className="recommendGrid">
            {recommendations.map((f) => (
              <button className="foodMini" key={f.food_id} onClick={onAdd}>
                <div className="foodIcon">{iconFor(f.icon_name)}</div>
                <strong>{f.name}</strong>
                <span>{f.default_portion} {f.default_unit}</span>
                <b>{f.protein_per_default_portion} g protein</b>
              </button>
            ))}
          </div>
        ) : <div className="successBox">Bugünkü hedefini tamamladın. 🎉</div>}
      </section>

      <section className="section">
        <div className="sectionTitle"><h2>Bugünkü öğünler</h2></div>
        <div className="mealList">
          {['Kahvaltı', 'Öğle Yemeği', 'Ara Öğün', 'Akşam Yemeği'].map((meal) => {
            const sum = todayEntries.filter((e) => e.meal === meal).reduce((s, e) => s + Number(e.protein), 0)
            return <div className="mealRow" key={meal}><span>{meal}</span><b>{sum ? `${Math.round(sum)} g` : '—'}</b></div>
          })}
        </div>
      </section>

      <nav className="bottomNav">
        <button className="active">⌂<span>Ana Sayfa</span></button>
        <button>▥<span>Geçmiş</span></button>
        <button className="fab" onClick={onAdd}>＋<span>Ekle</span></button>
        <button>💡<span>Öneriler</span></button>
        <button onClick={onProfile}>◯<span>Profil</span></button>
      </nav>
    </main>
  )
}

function AddProtein({ foods, onBack, onSave }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(foods[0])
  const [amount, setAmount] = useState(foods[0].default_portion)
  const [meal, setMeal] = useState(autoMeal())

  const filtered = foods.filter((f) =>
    f.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) ||
    (f.aliases || []).some((a) => a.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))
  ).slice(0, 10)

  function choose(f) {
    setSelected(f)
    setAmount(f.default_portion)
    setQuery(f.name)
  }

  const protein = selected
    ? selected.base_unit === selected.default_unit
      ? (amount / selected.base_amount) * selected.protein_per_base
      : selected.protein_per_default_portion
    : 0

  return (
    <main className="appShell">
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>Protein Ekle</h1>
        <span />
      </header>

      <input className="search" placeholder="Yiyecek ara veya yaz..." value={query} onChange={(e) => setQuery(e.target.value)} />
      {query && (
        <div className="searchResults">
          {filtered.map((f) => <button key={f.food_id} onClick={() => choose(f)}>{f.name}<span>{f.protein_per_default_portion} g</span></button>)}
        </div>
      )}

      {selected && (
        <section className="card addCard">
          <div className="selectedFood">
            <div className="foodIcon big">{iconFor(selected.icon_name)}</div>
            <div><h2>{selected.name}</h2><p>{selected.category}</p></div>
          </div>
          <Field label={`Miktar (${selected.default_unit})`}>
            <input type="number" min="1" value={amount} onChange={(e) => setAmount(+e.target.value)} />
          </Field>
          <div className="proteinResult"><span>Protein</span><b>{protein.toFixed(1)} g</b></div>
          <Field label="Öğün">
            <select value={meal} onChange={(e) => setMeal(e.target.value)}>
              <option>Kahvaltı</option><option>Öğle Yemeği</option><option>Ara Öğün</option><option>Akşam Yemeği</option>
            </select>
          </Field>
          <button className="primary wide" onClick={() => onSave({
            foodId: selected.food_id,
            name: selected.name,
            amount,
            unit: selected.default_unit,
            protein,
            meal,
          })}>Kaydet</button>
        </section>
      )}
    </main>
  )
}

function Profile({ profile, onBack, onSave }) {
  const [p, setP] = useState(profile)
  return (
    <main className="appShell">
      <header className="screenHeader"><button className="back" onClick={onBack}>‹</button><h1>Profil</h1><span /></header>
      <section className="card">
        <Field label="Kilo (kg)"><input type="number" value={p.weight} onChange={(e) => setP({ ...p, weight: +e.target.value })} /></Field>
        <Field label="Aktivite">
          <select value={p.activity} onChange={(e) => setP({ ...p, activity: e.target.value })}>
            <option>Düşük</option><option>Orta</option><option>Yüksek</option>
          </select>
        </Field>
        <Field label="Hedef">
          <select value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })}>
            <option>Genel sağlık</option><option>Kilo verme sürecinde</option><option>Kas koruma / geliştirme</option>
          </select>
        </Field>
        <Field label="Günlük protein hedefi (g)"><input type="number" value={p.proteinTarget} onChange={(e) => setP({ ...p, proteinTarget: +e.target.value })} /></Field>
        <button className="primary wide" onClick={() => onSave(p)}>Kaydet</button>
      </section>
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
          <strong>{option.title}</strong>
          {option.description && <span>{option.description}</span>}
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

function autoMeal() {
  const h = new Date().getHours()
  if (h < 11) return 'Kahvaltı'
  if (h < 15) return 'Öğle Yemeği'
  if (h < 18) return 'Ara Öğün'
  return 'Akşam Yemeği'
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
