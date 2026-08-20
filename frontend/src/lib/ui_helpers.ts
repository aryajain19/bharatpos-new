export function cleanAndMapCategory(categoryStr: string) {
  if (!categoryStr) return { cleanName: 'Uncategorized', icon: 'shape' };

  // Strip emojis from the string
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{1FB00}-\u{1FBFF}\u{2000}-\u{206F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{2500}-\u{257F}\u{25A0}-\u{25FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2800}-\u{28FF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{2C60}-\u{2C7F}\u{2E00}-\u{2E7F}\u{3000}-\u{303F}\u{A490}-\u{A4CF}\u{E000}-\u{F8FF}\u{FE00}-\u{FE0F}\u{FE30}-\u{FE4F}\u{FE50}-\u{FE6F}\u{FF00}-\u{FFEF}]/gu;
  
  // Clean up extra spaces
  let cleanName = categoryStr.replace(emojiRegex, '').trim();
  if (!cleanName) cleanName = 'Category';

  // Try to find a matching icon based on keyword
  const lower = cleanName.toLowerCase();
  let icon = 'shape';
  
  if (lower.includes('food') || lower.includes('snack') || lower.includes('burger')) icon = 'food';
  else if (lower.includes('drink') || lower.includes('beverage') || lower.includes('liquid') || lower.includes('juice')) icon = 'cup-water';
  else if (lower.includes('clothing') || lower.includes('shirt') || lower.includes('apparel') || lower.includes('garment')) icon = 'tshirt-crew';
  else if (lower.includes('shoe') || lower.includes('footwear')) icon = 'shoe-sneaker';
  else if (lower.includes('electronic') || lower.includes('tech') || lower.includes('gadget')) icon = 'laptop';
  else if (lower.includes('grocery') || lower.includes('staple') || lower.includes('produce')) icon = 'basket';
  else if (lower.includes('health') || lower.includes('medicine') || lower.includes('pharmacy')) icon = 'pill';
  else if (lower.includes('beauty') || lower.includes('cosmetic') || lower.includes('makeup')) icon = 'lipstick';
  else if (lower.includes('toy') || lower.includes('game') || lower.includes('kid')) icon = 'toy-brick';
  else if (lower.includes('book') || lower.includes('stationery')) icon = 'book-open-page-variant';
  else if (lower.includes('home') || lower.includes('kitchen') || lower.includes('furniture')) icon = 'home-outline';
  else if (lower.includes('pet')) icon = 'paw';
  else if (lower.includes('sport') || lower.includes('fitness')) icon = 'dumbbell';
  else if (lower.includes('fruit') || lower.includes('veg')) icon = 'food-apple';
  else if (lower.includes('meat') || lower.includes('chicken') || lower.includes('fish')) icon = 'food-drumstick';
  else if (lower.includes('dairy') || lower.includes('milk')) icon = 'cheese';
  else if (lower.includes('bakery') || lower.includes('bread') || lower.includes('cake')) icon = 'bread-slice';
  
  return { cleanName, icon };
}
