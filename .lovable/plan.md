
# Photo Food Logging with Computer Vision

Add a camera button to the Today tab so users can snap a photo of their food, have AI identify it, and auto-log the entry with estimated carbs and portion size.

## How it works

1. User taps a camera icon next to the Food button (or inside the food preset panel)
2. Browser opens the device camera (or photo library) via a file input
3. Photo is compressed client-side (canvas resize to ~1MB max) before sending
4. Photo is sent to a new edge function that uses Lovable AI (Gemini 2.5 Flash with vision) to identify the food
5. AI returns structured data: food name, estimated carb count (grams), and portion size (small/medium/large)
6. Result is shown pre-filled so the user can review and edit before confirming
7. Logged entry displays food name, carbs, and portion size in the Today log

## What the AI returns (structured via tool calling)

| Field | Type | Example |
|-------|------|---------|
| foodName | string | "Grilled chicken with rice" |
| carbsGrams | number | 45 |
| portionSize | "small" / "medium" / "large" | "medium" |
| category | "meal" / "snack" / "drink" | "meal" |

The food name is returned in the user's current language (en/es).

## Changes

### 1. New edge function: `analyze-food`

- Receives base64 image + language preference
- Calls Lovable AI (Gemini 2.5 Flash) with vision prompt
- Uses tool calling to extract structured output (name, carbs, portion size, category)
- Returns structured JSON to the client
- Handles 429/402 errors gracefully

### 2. Updated TodayTab component

- Add a camera/photo button in the food logging area
- Client-side image compression before upload
- Show loading state while AI processes
- Display result card with: food name, estimated carbs (e.g. "~45g carbs"), portion size
- User can edit any field before confirming
- On confirm, log entry includes carbs and portion size
- If AI fails, fall back to manual text input

### 3. Updated log entry display

- Each food entry in the Today log shows carbs and portion size alongside the food name
- Example: "Grilled chicken with rice · ~45g carbs · Medium"

### 4. Translations

- Add new keys for: camera button, processing state, carbs label, portion size labels, error messages

### 5. Safety note

- Carb estimates are approximate and labeled as such ("~45g carbs")
- A gentle disclaimer: "Estimates are approximate — check with your care team for precise carb counting"

No database changes needed — logged entries stay in local state.
