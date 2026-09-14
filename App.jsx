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
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayEntries = entries.filter((e) => e.date === todayKey)
  const totalProtein = todayEntries.reduce((sum, e) => sum + Number(e.protein || 0), 0)

  const target = profile?.proteinTarget || 90
  const remaining = Math.max(target - totalProtein, 0)

  const recommendations = useMemo(() => {
    if (remaining <= 0) return []
    return buildCompletionPlans(foods, remaining)
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

  if (screen === 'onboarding') {
    return <Onboarding onFinish={finishOnboarding} />
  }

  if (screen === 'add') {
    return (
      <AddProtein
        foods={foods}
        onBack={() => setScreen('home')}
        onSave={addEntry}
      />
    )
  }

  if (screen === 'edit' && editingEntry) {
    return (
      <AddProtein
        foods={foods}
        onBack={() => {
          setEditingEntry(null)
          setScreen('meal')
        }}
        onSave={updateEntry}
        editingEntry={editingEntry}
      />
    )
  }

  if (screen === 'meal' && selectedMeal) {
    return (
      <MealDetails
        meal={selectedMeal}
        entries={todayEntries.filter((entry) => entry.meal === selectedMeal)}
        onBack={() => setScreen('home')}
        onDelete={deleteEntry}
        onEdit={(entry) => {
          setEditingEntry(entry)
          setScreen('edit')
        }}
      />
    )
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
      target={target}
      total={totalProtein}
      remaining={remaining}
      recommendations={recommendations}
      todayEntries={todayEntries}
      onAdd={() => setScreen('add')}
      onProfile={() => setScreen('profile')}
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
          <section className="onboardingStep centered choiceStep">
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
          <section className="onboardingStep centered choiceStep">
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

function Home({ target, total, remaining, recommendations, todayEntries, onAdd, onProfile, onMeal }) {
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
        <div className="sectionTitle recommendationHeader">
          <div>
            <h2>Kalan proteini tamamla</h2>
            {remaining > 0 && <p>{Math.round(remaining)} g için birkaç farklı yol.</p>}
          </div>
        </div>

        {remaining > 0 ? (
          <div className="planList">
            {recommendations.map((plan) => (
              <div className="planCard" key={plan.id}>
                <div className="planTop">
                  <div>
                    <strong>{plan.title}</strong>
                    <span>{plan.subtitle}</span>
                  </div>
                  <b>≈ {plan.total.toFixed(1)} g</b>
                </div>

                <div className="planFoods">
                  {plan.items.map((item) => (
                    <div className="planFoodRow" key={`${plan.id}-${item.food_id}`}>
                      <span>{item.label}</span>
                      <small>{item.protein.toFixed(1)} g</small>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="successBox">Bugünkü hedefini tamamladın. 🎉</div>}
      </section>

      <section className="section">
        <div className="sectionTitle"><h2>Bugünkü öğünlerin</h2></div>
        <div className="mealSummaryList">
          {['Kahvaltı', 'Öğle Yemeği', 'Ara Öğün', 'Akşam Yemeği'].map((meal) => {
            const mealEntries = todayEntries.filter((e) => e.meal === meal)
            const sum = mealEntries.reduce((s, e) => s + Number(e.protein), 0)

            return (
              <button className="mealSummaryCard" key={meal} onClick={() => onMeal(meal)}>
                <div className="mealSummaryTop">
                  <strong>{meal}</strong>
                  <div className="mealSummaryRight">
                    <b>{sum ? `${sum.toFixed(1)} g` : '—'}</b>
                    <span className="mealChevron">›</span>
                  </div>
                </div>

                {mealEntries.length > 0 ? (
                  <div className="mealFoods">
                    {mealEntries.slice(0, 3).map((entry) => (
                      <div className="mealFoodLine" key={entry.id}>
                        <span>{entry.name}</span>
                        <small>{Number(entry.protein).toFixed(1)} g</small>
                      </div>
                    ))}
                    {mealEntries.length > 3 && (
                      <div className="mealMore">+{mealEntries.length - 3} kayıt daha</div>
                    )}
                  </div>
                ) : (
                  <div className="mealEmptyText">Henüz eklenmedi</div>
                )}
              </button>
            )
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

function AddProtein({ foods, onBack, onSave, editingEntry = null }) {
  const initialFood = editingEntry
    ? foods.find((f) => f.food_id === editingEntry.foodId) || null
    : null

  const [query, setQuery] = useState(initialFood?.name || '')
  const [selected, setSelected] = useState(initialFood)
  const [amount, setAmount] = useState(editingEntry?.amount || initialFood?.default_portion || '')
  const [meal, setMeal] = useState(editingEntry?.meal || '')
  const [showResults, setShowResults] = useState(false)

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
    }
  }

  function choose(f) {
    setSelected(f)
    setAmount(f.default_portion)
    setQuery(f.name)
    setShowResults(false)
  }

  const protein = selected
    ? selected.base_unit === selected.default_unit
      ? (Number(amount || 0) / selected.base_amount) * selected.protein_per_base
      : selected.protein_per_default_portion
    : 0

  function saveEntry() {
    if (!selected || Number(amount) <= 0 || !meal) return

    const entry = {
      foodId: selected.food_id,
      name: selected.name,
      amount: Number(amount),
      unit: selected.default_unit,
      protein,
      meal,
    }

    if (editingEntry) {
      onSave({ ...editingEntry, ...entry })
    } else {
      onSave(entry)
    }
  }

  return (
    <main className="appShell">
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>{editingEntry ? 'Kaydı Düzenle' : 'Protein Ekle'}</h1>
        <span />
      </header>

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

      <input
        className="search"
        placeholder="Yiyecek ara veya yaz..."
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => query && setShowResults(true)}
      />

      {showResults && query && (
        <div className="searchResults">
          {filtered.length > 0 ? (
            filtered.map((f) => (
              <button key={f.food_id} onClick={() => choose(f)}>
                {f.name}
                <span>{f.protein_per_default_portion} g</span>
              </button>
            ))
          ) : (
            <div className="emptySearch">Bu yiyecek henüz listede yok.</div>
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

function MealDetails({ meal, entries, onBack, onDelete, onEdit }) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)

  return (
    <main className="appShell">
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>{meal}</h1>
        <span />
      </header>

      <section className="card mealDetailCard">
        <div className="mealDetailHeader">
          <div>
            <span className="muted">Toplam protein</span>
            <strong>{total.toFixed(1)} g</strong>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="emptyMeal">
            <strong>Bu öğünde henüz kayıt yok.</strong>
            <span>Ana ekrandan Protein Ekle ile yeni kayıt ekleyebilirsin.</span>
          </div>
        ) : (
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
        )}
      </section>
    </main>
  )
}

function Profile({ profile, onBack, onSave }) {
  const [p, setP] = useState(profile)

  return (
    <main className="appShell">
      <header className="screenHeader">
        <button className="back" onClick={onBack}>‹</button>
        <h1>Profil</h1>
        <span />
      </header>

      <section className="card">
        <Field label="Kilo (kg)">
          <input type="number" value={p.weight} onChange={(e) => setP({ ...p, weight: +e.target.value })} />
        </Field>

        <Field label="Aktivite">
          <select value={p.activity} onChange={(e) => setP({ ...p, activity: e.target.value })}>
            <option>Düşük</option>
            <option>Orta</option>
            <option>Yüksek</option>
          </select>
        </Field>

        <Field label="Hedef">
          <select value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })}>
            <option>Genel sağlık</option>
            <option>Kilo verme sürecinde</option>
            <option>Kas koruma / geliştirme</option>
          </select>
        </Field>

        <Field label="Günlük protein hedefi (g)">
          <input
            type="number"
            value={p.proteinTarget}
            onChange={(e) => setP({ ...p, proteinTarget: +e.target.value })}
          />
        </Field>

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
  const byName = (needle) =>
    foods.find((food) => food.name.toLocaleLowerCase('tr').includes(needle.toLocaleLowerCase('tr')))

  const presets = [
    {
      id: 'balanced',
      title: 'Dengeli seçenek',
      subtitle: 'Ana öğün + süt ürünü + yumurta',
      names: ['Tavuk göğsü', 'Süzme yoğurt', 'Yumurta', 'Kaşar peyniri'],
    },
    {
      id: 'practical',
      title: 'Pratik seçenek',
      subtitle: 'Hazırlaması kolay proteinler',
      names: ['Whey protein', 'Ton balığı', 'Proteinli yoğurt', 'Yumurta'],
    },
    {
      id: 'vegetarian',
      title: 'Vejetaryen seçenek',
      subtitle: 'Et olmadan tamamla',
      names: ['Tofu', 'Yeşil mercimek', 'Süzme yoğurt', 'Edamame'],
    },
  ]

  return presets.map((preset) => {
    const pool = preset.names.map(byName).filter(Boolean)
    const items = []
    let total = 0

    for (const food of pool) {
      if (items.length >= 4) break
      const protein = Number(food.protein_per_default_portion || 0)
      if (!protein) continue

      const currentGap = Math.max(remaining - total, 0)

      if (currentGap <= 0) break

      // Son ürünü gerektiğinde daha küçük bir porsiyona ölçekle.
      if (protein > currentGap && currentGap >= 5) {
        const ratio = currentGap / protein
        const amount = Math.max(
          food.default_unit === 'adet' || food.default_unit === 'ölçek' ? 1 : 10,
          Math.round(Number(food.default_portion) * ratio)
        )

        const scaledProtein = food.base_unit === food.default_unit
          ? (amount / Number(food.base_amount)) * Number(food.protein_per_base)
          : protein

        items.push({
          food_id: food.food_id,
          label: `${amount} ${food.default_unit} ${food.name}`,
          protein: scaledProtein,
        })
        total += scaledProtein
        break
      }

      items.push({
        food_id: food.food_id,
        label: `${food.default_portion} ${food.default_unit} ${food.name}`,
        protein,
      })
      total += protein
    }

    return { ...preset, items, total }
  }).filter((plan) => plan.items.length > 0)
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
