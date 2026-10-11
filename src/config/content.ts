/** Page copy. Prices and anything marked PLACEHOLDER should be confirmed by the gym. */

export const hero = {
  eyebrow: "Play Smart Performance Center",
  title: ["Built to", "perform."],
  body: "Coach-led strength and conditioning for athletes and everyday lifters. Every rep has a reason.",
  primary: "Book a free trial",
  secondary: "Explore programmes",
};

export const chapters = [
  {
    id: "strength",
    index: "01",
    tag: "Strength",
    lift: "Dumbbell curl",
    title: ["Strength", "is a skill."],
    body: "Form first, load second. Our coaches teach you to own every rep, then build strength that carries into sport and life.",
    points: ["1:1 and small-group coaching", "Technique checked on every set", "Programmes that progress weekly"],
  },
  {
    id: "power",
    index: "02",
    tag: "Power",
    lift: "Barbell back squat",
    title: ["Built from", "the ground up."],
    body: "Legs drive everything. Structured squat, jump and sprint blocks develop the power behind every sprint, tackle and PR.",
    points: ["Competition-grade racks and bars", "Velocity-based strength blocks", "Mobility built into every session"],
  },
  {
    id: "performance",
    index: "03",
    tag: "Performance",
    lift: "Conventional deadlift",
    title: ["Lift what", "matters."],
    body: "We test, track and re-test. Measurable progress, smarter recovery and coaching that adapts to how your body responds.",
    points: ["Performance testing every block", "Recovery and nutrition guidance", "A community that shows up"],
  },
] as const;

export const programmes = [
  {
    title: "Strength & Hypertrophy",
    body: "Barbell-based programmes to build muscle and raw strength, with progressive overload you can see on paper.",
    tag: "Most popular",
  },
  {
    title: "Athletic Performance",
    body: "Speed, power, agility and conditioning for field, court and combat athletes. In-season and off-season blocks.",
  },
  {
    title: "Fat Loss & Conditioning",
    body: "High-output small-group sessions paired with simple, sustainable nutrition coaching.",
  },
  {
    title: "Personal Training",
    body: "1:1 coaching built entirely around your goals, history and schedule. Assessment included.",
  },
];

export const features = [
  { title: "Certified coaches", body: "Every session is planned and coached, never just supervised." },
  { title: "Serious equipment", body: "Competition racks, calibrated bumpers, sleds, turf and conditioning machines." },
  { title: "Measured progress", body: "Strength, power and body-composition testing at the end of every block." },
  { title: "Recovery zone", body: "Mobility area, recovery tools and guidance to keep you training consistently." },
];

/** PLACEHOLDER pricing. Replace with the gym's real plans. */
export const plans = [
  {
    name: "Monthly",
    price: "₹2,499",
    period: "/ month",
    features: ["Full gym access", "Group conditioning classes", "Onboarding assessment"],
  },
  {
    name: "Quarterly",
    price: "₹6,499",
    period: "/ 3 months",
    features: ["Everything in Monthly", "Monthly progress testing", "Personalised training plan", "Nutrition starter guide"],
    featured: true,
  },
  {
    name: "Annual",
    price: "₹21,999",
    period: "/ year",
    features: ["Everything in Quarterly", "4 personal-training sessions", "Priority class booking", "Member events"],
  },
];

export const goals = ["Build muscle", "Lose fat", "Get stronger", "Athletic performance", "Personal training", "General fitness"];
export const times = ["Early morning (5–8 am)", "Morning (8–12)", "Afternoon (12–5 pm)", "Evening (5–11 pm)"];

export const nav = [
  { label: "Training", href: "#strength" },
  { label: "Programmes", href: "#programmes" },
  { label: "Membership", href: "#membership" },
  { label: "Contact", href: "#enquiry" },
];
