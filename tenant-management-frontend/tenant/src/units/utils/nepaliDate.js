// Simple Nepali date conversion utility
export function getNepaliDate() {
  // For demonstration, adding ~57 years to convert to BS (Bikram Sambat)
  const date = new Date();
  const year = date.getFullYear() + 57;
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const nepaliMonths = [
    "Baishakh",
    "Jestha",
    "Ashadh",
    "Shrawan",
    "Bhadra",
    "Ashwin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
  ];

  // Approximate conversion (not exact)
  const monthIndex = month >= 4 ? month - 4 : month + 8;

  return `${nepaliMonths[monthIndex]} ${day}, ${year}`;
}
