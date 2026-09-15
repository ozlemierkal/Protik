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

function App() {
  const [profile, setProfile] = useState(loadProfile)
  const [entries, setEntries] = useState(loadEntries)
  const [customFoods, setCustomFoods] = useState(loadCustomFoods)
  const [screen, setScreen] = useState(profile ? 'home' : 'onboarding')
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayEntries = entries.filter((e) => e.date === todayKey)
  const totalProtein = todayEntries.reduce((sum, e) => sum + Number(e.protein || 0), 0)

  const target = profile?.proteinTarget || 90
  const remaining = Math.max(target - totalProtein, 0)
  const allFoods = useMemo(() => [...foods, ...customFoods], [customFoods])

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
    const next = [...entries, { ...entry, id: Date.now(), date: todayKey }]
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
    return <Onboarding onFinish={finishOnboarding} />
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
        onBack={() => setScreen('home')}
        onDelete={deleteEntry}
        onSave={addEntry}
        onSaveCustomFood={saveCustomFood}
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

function Home({ target, total, remaining, recommendations, todayEntries, onProfile, onHistory, onMeal }) {
  const pct = Math.min(Math.round((total / target) * 100), 100)
  const [activePlan, setActivePlan] = useState(0)
  const selectedPlan = recommendations[activePlan] || recommendations[0]

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
                    {sum > 0 ? (
                      <>
                        <b>{sum.toFixed(1)} g</b>
                        <span className="mealChevron">›</span>
                      </>
                    ) : (
                      <span className="mealAddPrompt">Ekle +</span>
                    )}
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

      <section className="section compactRecommendation">
        <div className="sectionTitle recommendationHeader">
          <div>
            <h2>Kalan proteinini nasıl tamamlayabilirsin?</h2>
            {remaining > 0 && <p>{Math.round(remaining)} g kaldı. Sana uygun birkaç seçenek.</p>}
          </div>
        </div>

        {remaining > 0 && recommendations.length > 0 ? (
          <>
            <div className="planTabs">
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
              <div className="planCard featuredPlan">
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
        ) : remaining <= 0 ? (
          <div className="successBox">Bugünkü hedefini tamamladın. 🎉</div>
        ) : null}
      </section>

      <nav className="bottomNav fourItems">
        <button className="active">⌂<span>Ana Sayfa</span></button>
        <button onClick={onHistory}>▥<span>Geçmiş</span></button>
        <button>💡<span>Öneriler</span></button>
        <button onClick={onProfile}>◯<span>Profil</span></button>
      </nav>
    </main>
  )
}

function dateKeyOffset(daysAgo) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function createHistoryTestEntries() {
  const templates = [
    {
      day: 1,
      rows: [
        ['Kahvaltı', 'Yumurta', 2, 'adet', 13.0],
        ['Kahvaltı', 'İnek sütü', 200, 'ml', 6.6],
        ['Öğle Yemeği', 'Tavuk göğsü, pişmiş', 120, 'g', 37.2],
        ['Akşam Yemeği', 'Süzme yoğurt', 200, 'g', 18.0],
      ],
    },
    {
      day: 2,
      rows: [
        ['Kahvaltı', 'Pınar protein yoğurt', 1, 'kase', 25.0],
        ['Öğle Yemeği', 'Somon, pişmiş', 120, 'g', 26.4],
        ['Ara Öğün', 'Badem', 30, 'g', 6.3],
      ],
    },
    {
      day: 3,
      rows: [
        ['Kahvaltı', 'Yumurta', 2, 'adet', 13.0],
        ['Öğle Yemeği', 'Ton balığı, süzülmüş', 100, 'g', 25.0],
        ['Akşam Yemeği', 'Tofu', 150, 'g', 19.5],
        ['Akşam Yemeği', 'Süzme yoğurt', 150, 'g', 13.5],
        ['Ara Öğün', 'İnek sütü', 250, 'ml', 8.3],
      ],
    },
  ]

  let id = 900000
  return templates.flatMap((template) =>
    template.rows.map(([meal, name, amount, unit, protein]) => ({
      id: id++,
      date: dateKeyOffset(template.day),
      meal,
      name,
      amount,
      unit,
      protein,
      foodId: `test-${id}`,
      isHistoryTest: true,
    }))
  )
}

function History({ entries, target, onBackHome, onOpenDay, onProfile }) {
  const testEntries = createHistoryTestEntries()
  const realPastEntries = entries.filter((entry) => entry.date < dateKeyOffset(0))

  // Test aşamasında gerçek geçmiş olmayan günleri geçici örnek verilerle dolduruyoruz.
  const historyEntries = [...realPastEntries]
  testEntries.forEach((testEntry) => {
    const hasRealDataForDay = realPastEntries.some((entry) => entry.date === testEntry.date)
    if (!hasRealDataForDay) historyEntries.push(testEntry)
  })

  const days = Array.from({ length: 7 }, (_, index) => dateKeyOffset(index + 1))

  return (
    <main className="appShell">
      <header className="screenHeader historyHeader">
        <span />
        <h1>Geçmiş</h1>
        <span />
      </header>

      <div className="historyIntro">
        <h2>Son 7 gün</h2>
        <p>Günlük protein toplamını ve öğünlerini burada görebilirsin.</p>
      </div>

      <div className="historyTestNote">Test için geçmiş günlere örnek kayıtlar eklendi.</div>

      <section className="historyList">
        {days.map((date) => {
          const dayEntries = historyEntries.filter((entry) => entry.date === date)
          const total = dayEntries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)
          const pct = target > 0 ? Math.min(Math.round((total / target) * 100), 100) : 0
          const remaining = Math.max(target - total, 0)

          return (
            <button
              key={date}
              className="historyDayCard"
              onClick={() => onOpenDay(date)}
              disabled={dayEntries.length === 0}
            >
              <div className="historyDayMain">
                <div>
                  <strong>{date === dateKeyOffset(1) ? 'Dün' : formatHistoryDate(date)}</strong>
                  <span className="historyDateSmall">{formatHistoryDate(date, true)}</span>
                </div>
                <div className="historyTotal">
                  <b>{total.toFixed(1)} <small>/ {target} g</small></b>
                  {dayEntries.length > 0 ? (
                    <span className={remaining <= 0 ? 'historyDone' : 'historyMissing'}>
                      {remaining <= 0 ? 'Hedef tamamlandı' : `${remaining.toFixed(0)} g eksik`}
                    </span>
                  ) : (
                    <span>Kayıt yok</span>
                  )}
                </div>
              </div>

              <div className="historyProgressTrack" aria-hidden="true">
                <div className="historyProgressFill" style={{ width: `${pct}%` }} />
              </div>

              <div className="historyCardFooter">
                <span>%{pct}</span>
                {dayEntries.length > 0 && <span>Detayı gör ›</span>}
              </div>
            </button>
          )
        })}
      </section>

      <nav className="bottomNav fourItems">
        <button onClick={onBackHome}>⌂<span>Ana Sayfa</span></button>
        <button className="active">▥<span>Geçmiş</span></button>
        <button>💡<span>Öneriler</span></button>
        <button onClick={onProfile}>◯<span>Profil</span></button>
      </nav>
    </main>
  )
}

function HistoryDay({ date, entries, target, onBack }) {
  const testEntries = createHistoryTestEntries()
  const realDayEntries = entries.filter((entry) => entry.date === date)
  const dayEntries = realDayEntries.length > 0
    ? realDayEntries
    : testEntries.filter((entry) => entry.date === date)

  const total = dayEntries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)
  const pct = target > 0 ? Math.min(Math.round((total / target) * 100), 100) : 0

  return (
    <main className="appShell">
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

      <div className="historyReadonlyNote">Geçmiş kayıtlar yalnızca görüntülenir.</div>
    </main>
  )
}


function AddProtein({ foods, onBack, onSave, onSaveCustomFood, editingEntry = null, presetMeal = '' }) {
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
    <main className="appShell">
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
                <span className="searchFoodName">
                  {f.name}
                  {f.is_custom && <small>Benim ürünüm</small>}
                </span>
                <span>{Number(f.protein_per_default_portion).toFixed(1)} g</span>
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

function MealDetails({ meal, entries, foods, onBack, onDelete, onEdit, onSave, onSaveCustomFood }) {
  const total = entries.reduce((sum, entry) => sum + Number(entry.protein || 0), 0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [showProteinEditor, setShowProteinEditor] = useState(false)
  const [customProteinPerBase, setCustomProteinPerBase] = useState('')
  const [customProductName, setCustomProductName] = useState('')

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
    setAmount(food.default_portion)
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
    <main className="appShell">
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

          <div className="mealVisual" aria-hidden="true">
            <span>
              {meal === 'Kahvaltı' ? '☕' :
               meal === 'Öğle Yemeği' ? '🥗' :
               meal === 'Ara Öğün' ? '🍎' :
               '🍽️'}
            </span>
          </div>
        </div>

        <div className="inlineAddArea">
          <input
            className="search mealSearch"
            placeholder="Yiyecek ara veya yaz..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => query && setShowResults(true)}
          />
          <div className="mealSearchHint">Yazarak veya arayarak ekleyebilirsin.</div>

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
                <div className="emptySearch">Bu yiyecek henüz listede yok.</div>
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
        </div>

        <div className="mealEntriesDivider" />

        {entries.length > 0 && (
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
