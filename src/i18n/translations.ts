export type Lang = "en" | "es";

const translations = {
  // Header
  "header.subtitle": { en: "Your Health Guide", es: "Tu Guía de Salud" },

  // Bottom nav
  "nav.journey": { en: "Journey", es: "Camino" },
  "nav.circles": { en: "Circles", es: "Círculos" },
  "nav.explore": { en: "Explore", es: "Explorar" },

  // Journey sub-tabs
  "journey.today": { en: "Today", es: "Hoy" },
  "journey.now": { en: "Now", es: "Ahora" },
  "journey.progress": { en: "Progress", es: "Progreso" },

  // Explore sub-tabs
  "explore.whatif": { en: "What If", es: "¿Y si…?" },
  "explore.insights": { en: "Insights", es: "Análisis" },
  "explore.health": { en: "Health", es: "Salud" },

  // Today tab
  "today.title": { en: "Today", es: "Hoy" },
  "today.subtitle": { en: "What have you had so far?", es: "¿Qué has tenido hasta ahora?" },
  "today.food": { en: "Food", es: "Comida" },
  "today.drink": { en: "Drink", es: "Bebida" },
  "today.medication": { en: "Medication", es: "Medicamento" },
  "today.quickPicks": { en: "Quick picks", es: "Opciones rápidas" },
  "today.typeOwn": { en: "Or type your own…", es: "O escribe el tuyo…" },
  "today.log": { en: "Today's log", es: "Registro de hoy" },
  "today.startLogging": { en: "Tap a button above to start logging", es: "Toca un botón arriba para empezar" },
  "today.trackingHelps": { en: "Keeping track helps you and your care team see patterns", es: "Llevar un registro ayuda a ti y a tu equipo médico a ver patrones" },

  // Food presets
  "preset.breakfast": { en: "Breakfast", es: "Desayuno" },
  "preset.lunch": { en: "Lunch", es: "Almuerzo" },
  "preset.dinner": { en: "Dinner", es: "Cena" },
  "preset.snack": { en: "Snack", es: "Merienda" },
  "preset.fruit": { en: "Fruit", es: "Fruta" },
  "preset.salad": { en: "Salad", es: "Ensalada" },
  // Drink presets
  "preset.water": { en: "Water", es: "Agua" },
  "preset.coffee": { en: "Coffee", es: "Café" },
  "preset.tea": { en: "Tea", es: "Té" },
  "preset.juice": { en: "Juice", es: "Jugo" },
  "preset.milk": { en: "Milk", es: "Leche" },
  // Med presets
  "preset.morningMeds": { en: "Morning meds", es: "Medicinas de la mañana" },
  "preset.eveningMeds": { en: "Evening meds", es: "Medicinas de la noche" },
  "preset.insulin": { en: "Insulin", es: "Insulina" },
  "preset.vitamins": { en: "Vitamins", es: "Vitaminas" },

  // What If
  "whatif.title": { en: "What if I…?", es: "¿Y si yo…?" },
  "whatif.subtitle": { en: "Wonder how something might affect your blood sugar? Ask in your own words, or pick a common scenario below. Just for learning — not medical advice.", es: "¿Te preguntas cómo algo podría afectar tu azúcar? Pregunta con tus propias palabras, o elige un escenario común. Solo para aprender — no es consejo médico." },
  "whatif.orPick": { en: "or pick a common scenario", es: "o elige un escenario común" },
  "whatif.simulate": { en: "See what might happen", es: "Ver qué podría pasar" },
  "whatif.chooseOne": { en: "Choose at least one option above to explore", es: "Elige al menos una opción arriba para explorar" },
  "whatif.tryAnother": { en: "Try another scenario", es: "Probar otro escenario" },

  // Journey / Progress
  "progress.title": { en: "Your Journey", es: "Tu Camino" },
  "progress.subtitle": { en: "A gentle look at how far you've come.", es: "Una mirada amable a lo que has logrado." },
  "progress.weeklyGoal": { en: "Weekly goal", es: "Meta semanal" },
  "progress.milestones": { en: "Milestones", es: "Logros" },
  "progress.daysTracked": { en: "Days tracked", es: "Días registrados" },
  "progress.timeInRange": { en: "Time in range", es: "Tiempo en rango" },
  "progress.avgGlucose": { en: "Avg. glucose", es: "Glucosa prom." },
  "progress.bestStreak": { en: "Best streak", es: "Mejor racha" },

  // Circles
  "circles.title": { en: "Your Circles", es: "Tus Círculos" },
  "circles.subtitle": { en: "Connect with others who understand your journey.", es: "Conéctate con otros que entienden tu camino." },

  // Safety footer
  "safety.footer": { en: "This is your health companion, not medical advice. Always talk to your care team about concerns.", es: "Este es tu compañero de salud, no un consejo médico. Siempre habla con tu equipo médico sobre tus dudas." },
  "safety.whatif": { en: "This is for learning only. Always follow your care team's guidance for medication and treatment decisions.", es: "Esto es solo para aprender. Siempre sigue las indicaciones de tu equipo médico para decisiones de medicamentos y tratamiento." },

  // Auth
  "auth.signOut": { en: "Sign out", es: "Cerrar sesión" },

  // Health connect
  "health.connected": { en: "Health connected", es: "Salud conectada" },
  "health.connect": { en: "Connect Health", es: "Conectar Salud" },

  // Twin / Insights
  "twin.title": { en: "What if I…", es: "¿Y si yo…" },
  "twin.subtitle": { en: "Your personal glucose guide — ask questions and see what might happen.", es: "Tu guía personal de glucosa — haz preguntas y mira qué podría pasar." },

  // Language
  "lang.switch": { en: "Español", es: "English" },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}

export default translations;
