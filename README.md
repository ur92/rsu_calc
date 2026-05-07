# מחשבון מניות ואופציות — JFrog (FROG)

כלי ניתוח מס לעובדי JFrog בישראל. מקבל קובץ ExcelMode מ-eTrade ומחשב נטו אחרי מס לכל RSU, אופציה ו-ESPP לפי סעיף 102.

🔗 **חי**: [rsucalcjfrog.netlify.app](https://rsucalcjfrog.netlify.app)

## איך משתמשים

1. ב-eTrade: My Portfolio → My Account → Benefit History → Export → **By Benefit Type (Expanded)** → קובץ `.xlsx`
2. פתח את [rsucalcjfrog.netlify.app](https://rsucalcjfrog.netlify.app)
3. גרור את הקובץ + הזן שכר שנתי ברוטו (₪)
4. קבל ניתוח מלא: שווי נטו, סדר עדיפות למכירה, לוח הבשלות

## מה הכלי מציג

- **חישוב מס לפי סעיף 102** — מסלול הוני (24+ חודשים מהענקה) ומסלול רגיל
- **RSU, אופציות NQ ו-ESPP** — שווי ברוטו ונטו לכל מענק
- **סדר עדיפות למכירה** — מסודר משיעור מס אפקטיבי הנמוך ביותר
- **לוח הבשלות 12 חודשים** — תרזימה לפי חודש ומסלול
- **סימולטור** — מחיר מניה ושער דולר אינטראקטיביים

## פרטיות

כל העיבוד קורה בדפדפן בלבד. שום נתון לא נשלח לשרת.

## הרצה מקומית

```bash
cd app
npm install
npm run dev
```

## תוכן הקובץ של eTrade

הפורמט הצפוי הוא `ByBenefitType_expanded.xlsx` עם שלושה גליונות:
- `ESPP` — רכישות ESPP
- `Restricted Stock` — מענקי RSU + לוח הבשלות
- `Options` — אופציות NQ + לוח הבשלות

## הסתייגות

הכלי מבוסס על כללי מס כלליים ולא מהווה ייעוץ מס. לתכנון מדויק התייעץ עם רואה חשבון.

## טכנולוגיה

React 19 · TypeScript · Vite · Tailwind CSS v4 · Recharts · SheetJS · Netlify

## סקיל ל-Cursor

ב-`.cursor/skills/jfrog-equity-analyzer/` יש סקיל שמאפשר לסוכן AI לנתח את הקובץ ולבנות canvas אינטראקטיבי. מי שמשתמש ב-Cursor ופותח את הריפו — הסקיל זמין אוטומטית.
