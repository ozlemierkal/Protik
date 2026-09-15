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

  if (screen === 'add') {
    return (
      <AddProtein
        foods={allFoods}
        onBack={() => setScreen(selectedMeal ? 'meal' : 'home')}
        onSave={addEntry}
        onSaveCustomFood={saveCustomFood}
        presetMeal={selectedMeal}
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
        onBack={() => setScreen('home')}
        onDelete={deleteEntry}
        onAdd={() => setScreen('add')}
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

function Home({ target, total, remaining, recommendations, todayEntries, onProfile, onMeal }) {
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
        <button>▥<span>Geçmiş</span></button>
        <button>💡<span>Öneriler</span></button>
        <button onClick={onProfile}>◯<span>Profil</span></button>
      </nav>
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

function MealDetails({ meal, entries, onBack, onDelete, onEdit, onAdd }) {
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

        <button className="primary wide mealAddButton" onClick={onAdd}>
          + {meal} için protein ekle
        </button>

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
