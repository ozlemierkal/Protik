import React, { useMemo, useState } from 'react'
import foods from './foods.json'

const PURPLE = '#54208C'
const YELLOW = '#F6B21A'

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
    age: 35,
    gender: 'Kadın',
    height: 165,
    weight: 65,
    activity: 'Orta',
    goal: 'Genel sağlık',
  })

  const multiplier = form.goal === 'Kas koruma / geliştirme'
    ? 1.7
    : form.goal === 'Kilo verme sürecinde'
      ? 1.5
      : form.activity === 'Yüksek'
        ? 1.3
        : form.activity === 'Orta'
          ? 1.2
          : 1.0

  const suggested = Math.max(40, Math.round((form.weight * multiplier) / 5) * 5)
  const [manualTarget, setManualTarget] = useState(null)
  const target = manualTarget ?? suggested

  const steps = [
    <section className="onboardingHero" key="welcome">
      <Logo />
      <div className="heroEmoji">💪</div>
      <h1>Protein hedefini takip et.</h1>
      <p>Eksik kalan proteini nasıl tamamlayacağını da Protik sana önersin.</p>
    </section>,
    <section key="about">
      <h2>Seni biraz tanıyalım</h2>
      <p className="muted">Daha uygun bir başlangıç hedefi önerebilmemiz için.</p>
      <Field label="Yaş"><input type="number" value={form.age} onChange={e => setForm({...form, age:+e.target.value})}/></Field>
      <Field label="Cinsiyet">
        <select value={form.gender} onChange={e => setForm({...form, gender:e.target.value})}>
          <option>Kadın</option><option>Erkek</option><option>Belirtmek istemiyorum</option>
        </select>
      </Field>
      <Field label="Boy (cm)"><input type="number" value={form.height} onChange={e => setForm({...form, height:+e.target.value})}/></Field>
      <Field label="Kilo (kg)"><input type="number" value={form.weight} onChange={e => setForm({...form, weight:+e.target.value})}/></Field>
    </section>,
    <section key="activity">
      <h2>Günlük hareketin nasıl?</h2>
      <ChoiceGroup value={form.activity} onChange={v => setForm({...form, activity:v})}
        options={['Düşük','Orta','Yüksek']} />
    </section>,
    <section key="goal">
      <h2>Hedefin ne?</h2>
      <ChoiceGroup value={form.goal} onChange={v => setForm({...form, goal:v})}
        options={['Genel sağlık','Kilo verme sürecinde','Kas koruma / geliştirme']} />
    </section>,
    <section key="target" className="targetStep">
      <h2>Önerilen başlangıç hedefin</h2>
      <div className="targetBig">{target} g</div>
      <p className="muted">İstersen şimdi değiştirebilirsin.</p>
      <input className="range" type="range" min="40" max="200" step="5" value={target}
        onChange={e => setManualTarget(+e.target.value)} />
    </section>,
  ]

  return (
    <main className="appShell onboarding">
      <div className="topDots">{step+1} / {steps.length}</div>
      <div className="panel">{steps[step]}</div>
      <div className="onboardingActions">
        {step > 0 && <button className="ghost" onClick={() => setStep(step-1)}>Geri</button>}
        {step < steps.length - 1
          ? <button className="primary" onClick={() => setStep(step+1)}>Devam</button>
          : <button className="primary" onClick={() => onFinish({...form, proteinTarget:target})}>Protik’i kullanmaya başla</button>}
      </div>
    </main>
  )
}

function Home({ profile, target, total, remaining, recommendations, todayEntries, onAdd, onProfile }) {
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
        <div className="ring" style={{'--pct': `${pct * 3.6}deg`}}>
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
          {['Kahvaltı','Öğle Yemeği','Ara Öğün','Akşam Yemeği'].map(meal => {
            const sum = todayEntries.filter(e => e.meal === meal).reduce((s,e)=>s+Number(e.protein),0)
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

  const filtered = foods.filter(f =>
    f.name.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')) ||
    (f.aliases || []).some(a => a.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))
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

      <input className="search" placeholder="Yiyecek ara veya yaz..." value={query} onChange={e => setQuery(e.target.value)} />
      {query && (
        <div className="searchResults">
          {filtered.map(f => <button key={f.food_id} onClick={() => choose(f)}>{f.name}<span>{f.protein_per_default_portion} g</span></button>)}
        </div>
      )}

      {selected && (
        <section className="card addCard">
          <div className="selectedFood">
            <div className="foodIcon big">{iconFor(selected.icon_name)}</div>
            <div><h2>{selected.name}</h2><p>{selected.category}</p></div>
          </div>
          <Field label={`Miktar (${selected.default_unit})`}>
            <input type="number" min="1" value={amount} onChange={e => setAmount(+e.target.value)} />
          </Field>
          <div className="proteinResult"><span>Protein</span><b>{protein.toFixed(1)} g</b></div>
          <Field label="Öğün">
            <select value={meal} onChange={e => setMeal(e.target.value)}>
              <option>Kahvaltı</option><option>Öğle Yemeği</option><option>Ara Öğün</option><option>Akşam Yemeği</option>
            </select>
          </Field>
          <button className="primary wide" onClick={() => onSave({
            foodId:selected.food_id,
            name:selected.name,
            amount,
            unit:selected.default_unit,
            protein,
            meal
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
        <Field label="Kilo (kg)"><input type="number" value={p.weight} onChange={e=>setP({...p,weight:+e.target.value})}/></Field>
        <Field label="Aktivite">
          <select value={p.activity} onChange={e=>setP({...p,activity:e.target.value})}>
            <option>Düşük</option><option>Orta</option><option>Yüksek</option>
          </select>
        </Field>
        <Field label="Hedef">
          <select value={p.goal} onChange={e=>setP({...p,goal:e.target.value})}>
            <option>Genel sağlık</option><option>Kilo verme sürecinde</option><option>Kas koruma / geliştirme</option>
          </select>
        </Field>
        <Field label="Günlük protein hedefi (g)"><input type="number" value={p.proteinTarget} onChange={e=>setP({...p,proteinTarget:+e.target.value})}/></Field>
        <button className="primary wide" onClick={()=>onSave(p)}>Kaydet</button>
      </section>
    </main>
  )
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

function ChoiceGroup({ value, onChange, options }) {
  return <div className="choices">{options.map(o => <button key={o} className={value===o?'selected':''} onClick={()=>onChange(o)}>{o}</button>)}</div>
}

function autoMeal() {
  const h = new Date().getHours()
  if (h < 11) return 'Kahvaltı'
  if (h < 15) return 'Öğle Yemeği'
  if (h < 18) return 'Ara Öğün'
  return 'Akşam Yemeği'
}

function iconFor(name='') {
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
