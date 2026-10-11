/**
 * Business details. Everything marked PLACEHOLDER needs the real value before launch.
 */
export const site = {
  name: "Play Smart Performance Center",
  shortName: "Play Smart",
  url: "https://playsmart.example", // PLACEHOLDER: production domain
  description:
    "Play Smart Performance Center: coach-led strength, conditioning and athletic performance training. Book a free trial session.",
  contact: {
    phone: "+91 00000 00000", // PLACEHOLDER
    whatsapp: "910000000000", // PLACEHOLDER: digits only, with country code
    email: "hello@playsmart.example", // PLACEHOLDER
    address: {
      street: "Your street address", // PLACEHOLDER
      city: "City", // PLACEHOLDER
    },
    mapUrl: "https://maps.google.com", // PLACEHOLDER: Google Maps share link
  },
  hours: [
    { days: "Mon – Sat", time: "5:00 am – 11:00 pm" }, // PLACEHOLDER
    { days: "Sunday", time: "7:00 am – 1:00 pm" }, // PLACEHOLDER
  ],
  hoursSchema: ["Mo-Sa 05:00-23:00", "Su 07:00-13:00"], // PLACEHOLDER, keep in sync with `hours`
  social: [
    { label: "Instagram", href: "https://instagram.com/" }, // PLACEHOLDER
    { label: "YouTube", href: "https://youtube.com/" }, // PLACEHOLDER
  ],
};
