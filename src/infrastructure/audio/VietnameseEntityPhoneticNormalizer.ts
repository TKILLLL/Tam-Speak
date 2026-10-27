/**
 * VietnameseEntityPhoneticNormalizer
 * Contextual phonetic mapper that corrects common English STT misrecognitions
 * for Vietnamese proper nouns, cities, provinces, foods, and cultural terms.
 */

const VIETNAMESE_PHONETIC_REPLACEMENTS: Array<{ regex: RegExp; replacement: string }> = [
  // --- Foods & Beverages ---
  { regex: /\b(ban\s*me|bun\s*me|pan\s*me|bang\s*me|barney|bind\s*me|bun\s*mi|ban\s*my)\b/gi, replacement: 'banh mi' },
  { regex: /\b(pho|fur|foe)\s+(bo|ga|tai|nam|bo\s*vien)\b/gi, replacement: 'pho $2' },
  { regex: /\b(a\s+bowl\s+of\s+)(fur|foe|fa)\b/gi, replacement: '$1pho' },
  { regex: /\b(eat|enjoy|order|traditional)\s+(fur|foe)\b/gi, replacement: '$1 pho' },
  { regex: /\b(boon\s*cha|poon\s*cha|bun\s*ja)\b/gi, replacement: 'bun cha' },
  { regex: /\b(boon\s*bo|bun\s*bowl)\s+hue\b/gi, replacement: 'bun bo Hue' },
  { regex: /\b(cafe\s+so\s+the|coffee\s+sweater|coffee\s+soda)\b/gi, replacement: 'ca phe sua da' },
  { regex: /\b(vietnamese\s+iced\s+coffee)\b/gi, replacement: 'ca phe sua da (Vietnamese iced coffee)' },
  { regex: /\b(ow\s*die|out\s*die|al\s*die|ao\s*dye)\b/gi, replacement: 'ao dai' },
  { regex: /\b(ban\s*chung|chung\s*cake)\b/gi, replacement: 'banh chung' },
  { regex: /\b(ban\s*xeo|crispy\s*pancake)\b/gi, replacement: 'banh xeo' },

  // --- Southern & Southeast Regions ---
  { regex: /\b(done\s*i|donai|dong\s*night|dung\s*nai|do\s*nay|dong\s*nye)\b/gi, replacement: 'Dong Nai' },
  { regex: /\b(hoshimin|ho\s*chi\s*mean|ho\s*chi\s*ming)\b/gi, replacement: 'Ho Chi Minh' },
  { regex: /\b(sai\s*gon|psycho)\s*(city)?\b/gi, replacement: 'Saigon' },
  { regex: /\b(been\s*tre|ben\s*tray)\b/gi, replacement: 'Ben Tre' },
  { regex: /\b(bin\s*duong|been\s*young)\b/gi, replacement: 'Binh Duong' },
  { regex: /\b(vung\s*tau|vung\s*tao)\b/gi, replacement: 'Vung Tau' },
  { regex: /\b(tay\s*ninh|tie\s*ninh)\b/gi, replacement: 'Tay Ninh' },
  { regex: /\b(can\s*tho|gun\s*tho)\b/gi, replacement: 'Can Tho' },
  { regex: /\b(an\s*giang|on\s*giang)\b/gi, replacement: 'An Giang' },
  { regex: /\b(kien\s*giang|kin\s*giang)\b/gi, replacement: 'Kien Giang' },
  { regex: /\b(ca\s*mau|ka\s*mau)\b/gi, replacement: 'Ca Mau' },
  { regex: /\b(foo\s*quoc|phu\s*cock|phu\s*kwork)\b/gi, replacement: 'Phu Quoc' },

  // --- Central & Highlands ---
  { regex: /\b(the\s*nang|the\s*nun|da\s*nan)\b/gi, replacement: 'Da Nang' },
  { regex: /\b(hoy\s*an|hoy\s*on)\b/gi, replacement: 'Hoi An' },
  { regex: /\b(hue\s+city|way\s+city)\b/gi, replacement: 'Hue city' },
  { regex: /\b(na\s*trang|ya\s*trang|natural\s*beach)\b/gi, replacement: 'Nha Trang' },
  { regex: /\b(da\s*lat|the\s*lat)\b/gi, replacement: 'Da Lat' },
  { regex: /\b(phan\s*thiet|fun\s*thiet)\b/gi, replacement: 'Phan Thiet' },
  { regex: /\b(binh\s*thuan|been\s*tuan)\b/gi, replacement: 'Binh Thuan' },
  { regex: /\b(quy\s*nhon|we\s*nhon)\b/gi, replacement: 'Quy Nhon' },
  { regex: /\b(dak\s*lak|dark\s*lak)\b/gi, replacement: 'Dak Lak' },

  // --- Northern Region ---
  { regex: /\b(ha\s*noy|ha\s*no\b)/gi, replacement: 'Hanoi' },
  { regex: /\b(ha\s*long\s*bay|halon\s*bay)\b/gi, replacement: 'Ha Long Bay' },
  { regex: /\b(hi\s*fong|high\s*fong)\b/gi, replacement: 'Hai Phong' },
  { regex: /\b(sa\s*pa|sah\s*pah)\b/gi, replacement: 'Sapa' },
  { regex: /\b(ninh\s*bin|nin\s*bin)\b/gi, replacement: 'Ninh Binh' },
  { regex: /\b(quang\s*ninh|kwang\s*ninh)\b/gi, replacement: 'Quang Ninh' },
  { regex: /\b(bac\s*ninh|back\s*ninh)\b/gi, replacement: 'Bac Ninh' },
  { regex: /\b(bac\s*giang|back\s*giang)\b/gi, replacement: 'Bac Giang' },
  { regex: /\b(thai\s*nguyen|tie\s*nguyen)\b/gi, replacement: 'Thai Nguyen' },
];

export class VietnameseEntityPhoneticNormalizer {
  /**
   * Normalizes spoken transcript by mapping phonetic misrecognitions of
   * Vietnamese food, places, and terms to their standard proper nouns.
   */
  public static normalizeTranscript(rawTranscript: string): string {
    if (!rawTranscript || rawTranscript.trim().length === 0) {
      return rawTranscript;
    }

    let normalized = rawTranscript;

    for (const rule of VIETNAMESE_PHONETIC_REPLACEMENTS) {
      normalized = normalized.replace(rule.regex, rule.replacement);
    }

    return normalized;
  }
}
