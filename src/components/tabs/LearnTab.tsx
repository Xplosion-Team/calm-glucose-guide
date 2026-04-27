import { useMemo, useState } from "react";
import { useScreenContext } from "@/hooks/useScreenContext";
import { BookOpen, Search, Clock, ChevronRight, Bookmark, BookmarkCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface Lesson {
  id: string;
  title: string;
  category: "Basics" | "Food" | "Movement" | "Mindset";
  readTime: string;
  preview: string;
  body: string[];
}

const LESSONS: Lesson[] = [
  {
    id: "what-is-glucose",
    title: "What is blood glucose, really?",
    category: "Basics",
    readTime: "3 min",
    preview: "A friendly explanation of the sugar that fuels your day.",
    body: [
      "Glucose is the body's main fuel — a simple sugar your cells use for energy.",
      "It comes mostly from the food you eat, especially carbohydrates. Your liver also makes some on its own, particularly overnight.",
      "Insulin is the key that lets glucose move from your blood into your cells. When that flow is smooth, your reading stays steady.",
      "A reading is just a snapshot. Trends over time tell a much richer story than any single number.",
    ],
  },
  {
    id: "in-range",
    title: "What does 'in range' mean?",
    category: "Basics",
    readTime: "2 min",
    preview: "The gentle target zone — and why it's a range, not a single number.",
    body: [
      "Most people aim to keep their glucose between 70 and 180 mg/dL most of the day.",
      "Your care team may set a slightly different range based on your goals.",
      "Spending more time in range is more important than chasing a 'perfect' number.",
    ],
  },
  {
    id: "carbs",
    title: "How carbs change your reading",
    category: "Food",
    readTime: "4 min",
    preview: "Some carbs lift you gently. Others sprint. Here's how to tell.",
    body: [
      "Simple carbs (juice, white bread, sweets) raise glucose quickly. Useful for low readings, less so otherwise.",
      "Complex carbs (oats, beans, vegetables) raise it more gently and steadily.",
      "Pairing carbs with protein, fat, or fiber slows the rise. A handful of nuts with fruit is a classic example.",
    ],
  },
  {
    id: "walking",
    title: "Why a short walk helps so much",
    category: "Movement",
    readTime: "2 min",
    preview: "10 minutes of gentle movement can do more than you'd expect.",
    body: [
      "Walking after a meal can lower the post-meal glucose spike noticeably.",
      "You don't need a workout — even 10 minutes of strolling helps your muscles use glucose.",
      "If you're not able to walk, light arm movements while seated can also help.",
    ],
  },
  {
    id: "stress",
    title: "Stress and your numbers",
    category: "Mindset",
    readTime: "3 min",
    preview: "When you feel pressure, your body sometimes raises glucose to help — even without food.",
    body: [
      "Stress hormones can nudge glucose up, even on an empty stomach. This is normal.",
      "Slow breathing, a short walk, or a kind moment to yourself can all help.",
      "Notice patterns over a week — Sunday-night spikes are surprisingly common.",
    ],
  },
  {
    id: "sleep",
    title: "Sleep is glucose medicine",
    category: "Mindset",
    readTime: "3 min",
    preview: "A solid night of sleep makes the next day's readings smoother.",
    body: [
      "Even one short night can raise next-day glucose readings.",
      "A consistent bedtime helps your body's overnight rhythm stabilize glucose.",
      "If you wake up high, that's information — not failure.",
    ],
  },
];

const CATEGORIES = ["All", "Basics", "Food", "Movement", "Mindset"] as const;
type Category = (typeof CATEGORIES)[number];

const FEATURED = LESSONS[0];

export function LearnTab() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  useScreenContext(
    useMemo(
      () => ({
        screen: "Learn",
        status: `${LESSONS.length} short lessons about glucose, food, movement, and mindset.`,
        highlights: [
          `Today's pick: "${FEATURED.title}" — ${FEATURED.preview}`,
          `Lessons are grouped into Basics, Food, Movement, and Mindset.`,
          `You can search for a topic or bookmark lessons to read later.`,
        ],
        data: { lessonCount: LESSONS.length, featured: FEATURED.title },
        fallback: `You're on the Learn screen. There are ${LESSONS.length} short lessons here, organized by Basics, Food, Movement, and Mindset. Today's pick is "${FEATURED.title}". Want more detail?`,
      }),
      [],
    ),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LESSONS.filter((l) => {
      const inCat = category === "All" || l.category === category;
      const inQuery =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.preview.toLowerCase().includes(q);
      return inCat && inQuery;
    });
  }, [query, category]);

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-4">
      {/* Hero */}
      <div className="text-center py-4">
        <div className="inline-flex items-center gap-2 mb-2">
          <BookOpen className="w-6 h-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-foreground">Learn</h2>
        </div>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Bite-sized lessons, written like a kind friend explaining.
        </p>
      </div>

      {/* Featured */}
      <button onClick={() => setSelected(FEATURED)} className="w-full text-left">
        <Card className="glass-card border-0 bg-gradient-to-br from-primary/10 to-accent/40 overflow-hidden">
          <CardContent className="p-5">
            <Badge variant="secondary" className="mb-2">Today's pick</Badge>
            <h3 className="text-xl font-semibold text-foreground">{FEATURED.title}</h3>
            <p className="text-base text-muted-foreground mt-1.5 leading-relaxed">
              {FEATURED.preview}
            </p>
            <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-4 h-4" aria-hidden="true" /> {FEATURED.readTime}
              </span>
              <span>·</span>
              <span>{FEATURED.category}</span>
            </div>
          </CardContent>
        </Card>
      </button>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lessons…"
          className="pl-11 h-12 text-base"
          aria-label="Search lessons"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
              aria-pressed={active}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Lesson list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="glass-card border-0">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
              <p className="font-medium text-foreground">No lessons match your search</p>
              <p className="text-sm text-muted-foreground mt-1">Try a different word or category.</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((lesson) => {
            const bookmarked = bookmarks.has(lesson.id);
            return (
              <Card key={lesson.id} className="glass-card border-0">
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <button
                      onClick={() => setSelected(lesson)}
                      className="flex-1 text-left p-4 hover:bg-secondary/30 transition-colors rounded-l-2xl"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="font-normal text-xs">
                          {lesson.category}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" aria-hidden="true" /> {lesson.readTime}
                        </span>
                      </div>
                      <p className="font-semibold text-foreground">{lesson.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {lesson.preview}
                      </p>
                    </button>
                    <div className="flex flex-col items-center justify-between p-3 border-l border-border">
                      <button
                        onClick={() => toggleBookmark(lesson.id)}
                        className="p-2 rounded-full hover:bg-secondary/40 transition-colors"
                        aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
                        aria-pressed={bookmarked}
                      >
                        {bookmarked ? (
                          <BookmarkCheck className="w-5 h-5 text-primary" />
                        ) : (
                          <Bookmark className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {selected.category}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" aria-hidden="true" /> {selected.readTime}
                  </span>
                </div>
                <SheetTitle className="text-2xl">{selected.title}</SheetTitle>
                <SheetDescription className="text-base">{selected.preview}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {selected.body.map((p, i) => (
                  <p key={i} className="text-base text-foreground leading-relaxed">
                    {p}
                  </p>
                ))}
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground italic">
                    Always discuss changes to your care plan with your team.
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <p className="text-center text-sm text-muted-foreground max-w-sm mx-auto pt-4 border-t">
        Knowledge is care. Read at your own pace — there's no test.
      </p>
    </div>
  );
}
