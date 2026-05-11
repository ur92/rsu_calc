// Curated manually — do NOT run generate-changelog.js at build time.
// To add an entry: follow the workflow in .cursor/rules/changelog.mdc
export interface ChangelogEntry {
  id: string;
  date: string;
  message: string;
  type: 'feature' | 'data' | 'docs' | 'fix' | 'update';
}

export const changelog: ChangelogEntry[] = [
  {
    "id": "5d5d2e3",
    "date": "2026-05-11",
    "message": "תיקון גלילה אופקית לא רצויה במובייל (iOS Safari)",
    "type": "fix"
  },
  {
    "id": "469114d",
    "date": "2026-05-11",
    "message": "תיקוני מובייל: כותרת תמיד גלויה, פאנל 'מה חדש' לא חורג מהמסך, פירוט מס לחיץ בנגיעה, כרטיסי מניות מוצגים אנכית",
    "type": "fix"
  },
  {
    "id": "dc4db62",
    "date": "2026-05-11",
    "message": "תיקון שיעורי ביטוח לאומי ומס בריאות לשנת 2026 (ב״ל 1.04%+7%, בריאות 3.23%+5.17%) וכלל תקרת שכר: מי שמשכורתו החודשית עולה על 51,910 ₪ לא משלם ב״ל/בריאות על הכנסה פירותית ממניות",
    "type": "data"
  },
  {
    "id": "4ddade3",
    "date": "2026-05-10",
    "message": "חישוב FMV ביום הענקה אוטומטי — ממוצע 20 ימי מסחר לפי שיטת JFrog (במקום הערכה לפי vest ראשון)",
    "type": "feature"
  },
  {
    "id": "b2f5a0e",
    "date": "2026-05-10",
    "message": "ממשק תוכנית מכירה — סליידרים לכמות, מיון יציב, חישוב יסף על מכירה מלאה",
    "type": "feature"
  },
  {
    "id": "2a75704",
    "date": "2026-05-09",
    "message": "הוספת חישוב מס יסף 3% + 2% (תיקון 276 / הוראת ביצוע 5/2025), סימולטור כמויות מכירה לפי lot, ושדה הכנסה הונית אחרת",
    "type": "feature"
  },
  {
    "id": "8afef4b",
    "date": "2026-05-09",
    "message": "הוספת לשונית 'מה חדש' לכותרת עם מעקב אחר עדכונים חדשים",
    "type": "feature"
  },
  {
    "id": "528584a",
    "date": "2026-05-09",
    "message": "איחוד 'זמין עכשיו' ועדיפות מכירה לתצוגת עדיפות אחת",
    "type": "feature"
  },
  {
    "id": "67da02f",
    "date": "2026-05-08",
    "message": "סנכרון מדרגות מס הכנסה לישראל ושיפור ממשק הניתוח",
    "type": "feature"
  },
  {
    "id": "dbb4a14",
    "date": "2026-05-08",
    "message": "מחירים חיים, סקירת תיק, תיקון מס ESPP ועדיפויות מכירה ב-₪",
    "type": "feature"
  },
  {
    "id": "99b4919",
    "date": "2026-05-07",
    "message": "שחרור ראשוני של מחשבון RSU/אופציות ל-JFrog",
    "type": "feature"
  }
];
